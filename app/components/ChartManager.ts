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
  
  // 1-minute candlestick aggregation data
  private currentCandles: Map<string, Map<number, CandleDataPoint>> = new Map();
  private candleTimers: Map<string, Map<number, NodeJS.Timeout>> = new Map();

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

  private get1MinuteBucket(timestamp: number): number {
    // Round down to the nearest minute (expects timestamp in seconds)
    return Math.floor(timestamp / 60) * 60;
  }

  updateChartWithPrice(ticker: string, timestamp: number, price: number): void {
    // Don't update destroyed charts
    if (this.destroyed.has(ticker)) {
      return;
    }

    // Only update charts that actually exist
    if (!this.charts.has(ticker)) {
      return; // No chart created for this ticker yet
    }

    // Convert timestamp to seconds if it's in milliseconds (lightweight-charts expects seconds)
    const timeInSeconds = timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;

    const chartType = this.chartTypes.get(ticker);
    console.log(`ChartManager: Updating ${chartType} chart for ${ticker} with price ${price} at ${timestamp} (${timeInSeconds}s)`);
    
    try {
      if (chartType === 'candlestick') {
        this.updateCandlestickWithTick(ticker, timeInSeconds, price);
      } else {
        const series = this.areaSeries.get(ticker);
        if (series) {
          const lineData = {
            time: timeInSeconds,
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

  private updateCandlestickWithTick(ticker: string, timestamp: number, price: number): void {
    const series = this.candlestickSeries.get(ticker);
    if (!series) {
      console.warn(`ChartManager: No candlestick series found for ${ticker}`);
      return;
    }

    // Get the 1-minute bucket for this timestamp
    const bucketTime = this.get1MinuteBucket(timestamp);
    
    // Initialize ticker candle tracking if needed
    if (!this.currentCandles.has(ticker)) {
      this.currentCandles.set(ticker, new Map());
    }
    if (!this.candleTimers.has(ticker)) {
      this.candleTimers.set(ticker, new Map());
    }
    
    const tickerCandles = this.currentCandles.get(ticker)!;
    const tickerTimers = this.candleTimers.get(ticker)!;
    
    // Get or create current candle for this minute bucket
    let currentCandle = tickerCandles.get(bucketTime);
    if (!currentCandle) {
      // Start new candle
      currentCandle = {
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
      };
      tickerCandles.set(bucketTime, currentCandle);
      console.log(`ChartManager: Starting new 1-min candle for ${ticker} at ${new Date(bucketTime * 1000).toISOString()}`);
    } else {
      // Update existing candle
      currentCandle.high = Math.max(currentCandle.high, price);
      currentCandle.low = Math.min(currentCandle.low, price);
      currentCandle.close = price; // Close is always the latest price
    }
    
    // Update the chart with current candle
    console.log(`ChartManager: Updating 1-min candle for ${ticker}:`, currentCandle);
    series.update(currentCandle as CandlestickData);
    
    // Set/reset timer to finalize this candle (1 minute from bucket start + buffer)
    if (tickerTimers.has(bucketTime)) {
      clearTimeout(tickerTimers.get(bucketTime));
    }
    
    const timeUntilNextBucket = (bucketTime + 60) * 1000 - Date.now() + 1000; // 1 second buffer
    if (timeUntilNextBucket > 0) {
      const timer = setTimeout(() => {
        console.log(`ChartManager: Finalizing 1-min candle for ${ticker} at ${new Date(bucketTime * 1000).toISOString()}`);
        tickerCandles.delete(bucketTime);
        tickerTimers.delete(bucketTime);
        // Auto-fit content periodically
        this.fitContent(ticker);
      }, timeUntilNextBucket);
      
      tickerTimers.set(bucketTime, timer);
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

    // Clean up candlestick aggregation timers
    const tickerTimers = this.candleTimers.get(ticker);
    if (tickerTimers) {
      tickerTimers.forEach(timer => clearTimeout(timer));
      this.candleTimers.delete(ticker);
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
    this.currentCandles.delete(ticker);
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