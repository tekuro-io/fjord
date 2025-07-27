// components/ChartManager.ts
'use client';

import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, createTextWatermark, CandlestickSeries, AreaSeries } from 'lightweight-charts';

export interface ChartDataPoint {
  time: number;
  value: number;
}

export interface CandleDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export class ChartManager {
  private charts: Map<string, IChartApi> = new Map();
  private areaSeries: Map<string, ISeriesApi<'Area'>> = new Map();
  private candlestickSeries: Map<string, ISeriesApi<'Candlestick'>> = new Map();
  private chartTypes: Map<string, 'area' | 'candlestick'> = new Map();
  private resizeObservers: Map<string, ResizeObserver> = new Map();
  private destroyed: Set<string> = new Set();

  createChart(
    ticker: string, 
    container: HTMLDivElement, 
    chartType: 'area' | 'candlestick' = 'candlestick',
    initialData?: ChartDataPoint[] | CandleDataPoint[]
  ): void {
    // Clean up existing chart if it exists
    this.destroyChart(ticker);

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 400,
      layout: {
        background: { color: '#1f2937' },
        textColor: '#e5e7eb',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      timeScale: {
        borderColor: '#4b5563',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#4b5563',
      },
    });

    // Add watermark
    createTextWatermark(chart.panes()[0], {
      horzAlign: 'right',
      vertAlign: 'bottom',
      lines: [
        {
          text: ticker,
          color: 'rgba(8, 242, 246, 0.3)',
          fontSize: 24,
          fontStyle: 'normal',
        },
      ],
    });

    if (chartType === 'candlestick') {
      console.log(`ChartManager: Creating candlestick series for ${ticker}`);
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
      this.candlestickSeries.set(ticker, candleSeries);
      console.log(`ChartManager: Candlestick series created for ${ticker}, stored in map:`, this.candlestickSeries.has(ticker));
      
      if (initialData) {
        console.log(`ChartManager: Setting initial candlestick data for ${ticker}:`, initialData);
        candleSeries.setData(initialData as CandlestickData[]);
      }
    } else {
      console.log(`ChartManager: Creating area series for ${ticker}`);
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: '#08f2f6',
        topColor: 'rgba(8, 242, 246, 0.4)',
        bottomColor: 'rgba(8, 242, 246, 0.0)',
      });
      this.areaSeries.set(ticker, areaSeries);
      console.log(`ChartManager: Area series created for ${ticker}, stored in map:`, this.areaSeries.has(ticker));
      
      if (initialData) {
        console.log(`ChartManager: Setting initial area data for ${ticker}:`, initialData);
        const areaData = (initialData as ChartDataPoint[]).map(point => ({
          time: point.time,
          value: point.value
        }));
        areaSeries.setData(areaData as LineData[]);
      }
    }

    this.charts.set(ticker, chart);
    this.chartTypes.set(ticker, chartType);

    // Handle resize with error protection
    const resizeObserver = new ResizeObserver(() => {
      if (!this.destroyed.has(ticker) && this.charts.has(ticker)) {
        try {
          chart.applyOptions({ width: container.clientWidth });
        } catch {
          console.warn(`ChartManager: Resize failed for ${ticker}, chart may be destroyed`);
        }
      }
    });
    resizeObserver.observe(container);
    this.resizeObservers.set(ticker, resizeObserver);

    // Mark as not destroyed
    this.destroyed.delete(ticker);
  }

  updateChart(ticker: string, dataPoint: ChartDataPoint | CandleDataPoint): void {
    // Don't update destroyed charts
    if (this.destroyed.has(ticker)) {
      return;
    }

    const chartType = this.chartTypes.get(ticker);
    
    try {
      if (chartType === 'candlestick') {
        const series = this.candlestickSeries.get(ticker);
        if (series && 'open' in dataPoint) {
          series.update(dataPoint as CandlestickData);
        }
      } else {
        const series = this.areaSeries.get(ticker);
        if (series && 'value' in dataPoint) {
          series.update({ time: dataPoint.time, value: dataPoint.value } as LineData);
        }
      }
    } catch (error) {
      console.warn(`ChartManager: Update failed for ${ticker}, chart may be destroyed:`, error);
      // Mark as destroyed to prevent future updates
      this.destroyed.add(ticker);
    }
  }

  updateChartWithPrice(ticker: string, timestamp: number, price: number): void {
    // Don't update destroyed charts
    if (this.destroyed.has(ticker)) {
      return;
    }

    const chartType = this.chartTypes.get(ticker);
    console.log(`ChartManager: Updating ${chartType} chart for ${ticker} with price ${price} at ${timestamp}`);
    
    try {
      if (chartType === 'candlestick') {
        const series = this.candlestickSeries.get(ticker);
        if (series) {
          // Create a candlestick where OHLC are all the same price (tick candle)
          const candleData = {
            time: timestamp,
            open: price,
            high: price,
            low: price,
            close: price,
          } as CandlestickData;
          console.log(`ChartManager: Adding candlestick data for ${ticker}:`, candleData);
          series.update(candleData);
        } else {
          console.warn(`ChartManager: No candlestick series found for ${ticker}`);
        }
      } else {
        const series = this.areaSeries.get(ticker);
        if (series) {
          const lineData = {
            time: timestamp,
            value: price,
          } as LineData;
          console.log(`ChartManager: Adding line data for ${ticker}:`, lineData);
          series.update(lineData);
        } else {
          console.warn(`ChartManager: No area series found for ${ticker}`);
        }
      }
    } catch (error) {
      console.error(`ChartManager: Price update failed for ${ticker}:`, error);
      this.destroyed.add(ticker);
    }
  }

  addBatchData(ticker: string, dataPoints: ChartDataPoint[] | CandleDataPoint[]): void {
    // Don't update destroyed charts
    if (this.destroyed.has(ticker)) {
      return;
    }

    const chartType = this.chartTypes.get(ticker);
    
    try {
      if (chartType === 'candlestick') {
        const series = this.candlestickSeries.get(ticker);
        if (series) {
          dataPoints.forEach(point => {
            if ('open' in point) {
              series.update(point as CandlestickData);
            }
          });
        }
      } else {
        const series = this.areaSeries.get(ticker);
        if (series) {
          dataPoints.forEach(point => {
            if ('value' in point) {
              series.update({ time: point.time, value: point.value } as LineData);
            }
          });
        }
      }
    } catch (error) {
      console.warn(`ChartManager: Batch update failed for ${ticker}, chart may be destroyed:`, error);
      this.destroyed.add(ticker);
    }
  }

  fitContent(ticker: string): void {
    if (this.destroyed.has(ticker)) {
      return;
    }

    const chart = this.charts.get(ticker);
    if (chart) {
      try {
        chart.timeScale().fitContent();
      } catch (error) {
        console.warn(`ChartManager: fitContent failed for ${ticker}:`, error);
        this.destroyed.add(ticker);
      }
    }
  }

  destroyChart(ticker: string): void {
    // Mark as destroyed first to prevent any pending operations
    this.destroyed.add(ticker);

    // Clean up resize observer
    const resizeObserver = this.resizeObservers.get(ticker);
    if (resizeObserver) {
      resizeObserver.disconnect();
      this.resizeObservers.delete(ticker);
    }

    // Destroy chart with error protection
    const chart = this.charts.get(ticker);
    if (chart) {
      try {
        chart.remove();
      } catch (error) {
        console.warn(`ChartManager: Error destroying chart for ${ticker}:`, error);
      }
    }

    // Clean up all references
    this.charts.delete(ticker);
    this.areaSeries.delete(ticker);
    this.candlestickSeries.delete(ticker);
    this.chartTypes.delete(ticker);
  }

  destroyAllCharts(): void {
    this.charts.forEach((chart, ticker) => {
      this.destroyChart(ticker);
    });
  }

  getChart(ticker: string): IChartApi | undefined {
    return this.charts.get(ticker);
  }

  getSeries(ticker: string): ISeriesApi<'Area'> | ISeriesApi<'Candlestick'> | undefined {
    const chartType = this.chartTypes.get(ticker);
    if (chartType === 'candlestick') {
      return this.candlestickSeries.get(ticker);
    } else {
      return this.areaSeries.get(ticker);
    }
  }
}

// Global chart manager instance
export const chartManager = new ChartManager();