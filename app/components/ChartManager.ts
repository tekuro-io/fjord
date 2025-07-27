// components/ChartManager.ts
'use client';

import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, createTextWatermark, CandlestickSeries, AreaSeries, Time } from 'lightweight-charts';

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
    
    // Clear any existing candle aggregation data for this ticker
    this.currentCandles.delete(ticker);
    const tickerTimers = this.candleTimers.get(ticker);
    if (tickerTimers) {
      tickerTimers.forEach(timer => clearTimeout(timer));
      this.candleTimers.delete(ticker);
    }
    
    console.log(`ChartManager: Creating fresh chart for ${ticker}, cleared existing data`);

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
        // Ensure initial data has proper time format (numbers in seconds)
        const processedInitialData = (initialData as CandleDataPoint[]).map(point => {
          const timeValue = typeof point.time === 'number' ? 
            (point.time > 1e12 ? Math.floor(point.time / 1000) : point.time) : 
            Math.floor(new Date(point.time).getTime() / 1000);
            
          return {
            time: Number(timeValue), // Force to number
            open: Number(point.open),
            high: Number(point.high), 
            low: Number(point.low),
            close: Number(point.close)
          };
        });
        
        console.log(`ChartManager: Setting initial candlestick data for ${ticker}:`, processedInitialData);
        console.log(`ChartManager: Sample initial data time types:`, processedInitialData.slice(0, 2).map(d => ({ time: d.time, type: typeof d.time })));
        
        // CRITICAL: Use setData for initial data, not individual updates
        candleSeries.setData(processedInitialData as CandlestickData[]);
        console.log(`ChartManager: Initial data set, series now has ${candleSeries.data().length} data points`);
        
        // Log the initial data timestamps for debugging
        if (processedInitialData.length > 0) {
          const firstPoint = processedInitialData[0];
          console.log(`ChartManager: Initial data first point time: ${firstPoint.time} (${new Date(firstPoint.time * 1000).toISOString()})`);
        }
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

    // Convert timestamp to seconds (lightweight-charts expects seconds) - ALWAYS divide by 1000 like the working version
    const timeInSeconds = Math.floor(timestamp / 1000);

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
    console.log(`ChartManager: Tick for ${ticker} - original timestamp: ${timestamp}s, bucket: ${bucketTime}s, bucket date: ${new Date(bucketTime * 1000).toISOString()}`);
    
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
      const oldHigh = currentCandle.high;
      const oldLow = currentCandle.low;
      currentCandle.high = Math.max(currentCandle.high, price);
      currentCandle.low = Math.min(currentCandle.low, price);
      currentCandle.close = price; // Close is always the latest price
      console.log(`ChartManager: Updated existing 1-min candle for ${ticker} - price: ${price}, high: ${oldHigh}->${currentCandle.high}, low: ${oldLow}->${currentCandle.low}`);
    }
    
    // Update the chart with current candle
    console.log(`ChartManager: Updating 1-min candle for ${ticker}:`, currentCandle);
    console.log(`ChartManager: Candle time type for ${ticker}:`, typeof currentCandle.time, currentCandle.time);
    
    // Ensure the candle time is a proper number
    const candleForChart = {
      time: Number(currentCandle.time), // Force conversion to number
      open: Number(currentCandle.open),
      high: Number(currentCandle.high),
      low: Number(currentCandle.low),
      close: Number(currentCandle.close)
    };
    
    console.log(`ChartManager: Final candle data for chart:`, candleForChart);
    console.log(`ChartManager: Final candle time type and value:`, typeof candleForChart.time, candleForChart.time);
    
    // Validate that all values are proper numbers
    const invalidFields = Object.entries(candleForChart).filter(([, value]) => typeof value !== 'number' || isNaN(value));
    if (invalidFields.length > 0) {
      console.error(`ChartManager: Invalid fields in candle data:`, invalidFields);
      return;
    }
    
    // Safety check: ensure we're not updating with old data
    try {
      const existingData = series.data();
      if (existingData.length > 0) {
        const lastPoint = existingData[existingData.length - 1];
        const lastTime = Number(lastPoint.time);
        if (candleForChart.time < lastTime) {
          console.warn(`ChartManager: Skipping update for ${ticker} - new time ${candleForChart.time} < last time ${lastTime}`);
          console.warn(`ChartManager: Time difference: ${lastTime - candleForChart.time} seconds`);
          console.warn(`ChartManager: New time: ${new Date(candleForChart.time * 1000).toISOString()}`);
          console.warn(`ChartManager: Last time: ${new Date(lastTime * 1000).toISOString()}`);
          
          // If the difference is small (< 2 minutes), allow the update anyway
          if (lastTime - candleForChart.time < 120) {
            console.warn(`ChartManager: Time difference is small (${lastTime - candleForChart.time}s), allowing update anyway`);
          } else {
            return;
          }
        } else if (candleForChart.time === lastTime) {
          console.log(`ChartManager: Updating existing candle for ${ticker} at time ${candleForChart.time}`);
        }
      }
    } catch (dataCheckError) {
      console.warn(`ChartManager: Could not check existing data for ${ticker}:`, dataCheckError);
    }

    try {
      // Use the same pattern as the working Chart.tsx - pass complete OHLC data
      series.update({
        time: candleForChart.time as Time,
        open: candleForChart.open,
        high: candleForChart.high,
        low: candleForChart.low,
        close: candleForChart.close
      });
      console.log(`ChartManager: Successfully updated candlestick for ${ticker} with OHLC data`);
    } catch (error) {
      console.error(`ChartManager: Failed to update candlestick for ${ticker}:`, error);
      console.error(`ChartManager: Attempted to update with data:`, candleForChart);
      
      // Try to get the last data point to see what's causing the conflict
      try {
        const chartData = series.data();
        console.error(`ChartManager: Current series has ${chartData.length} data points`);
        if (chartData.length > 0) {
          const lastPoint = chartData[chartData.length - 1];
          const lastTime = Number(lastPoint.time);
          console.error(`ChartManager: Last data point:`, lastPoint);
          console.error(`ChartManager: Time comparison - last: ${lastTime} (${typeof lastTime}), new: ${candleForChart.time} (${typeof candleForChart.time})`);
        }
      } catch (dataError) {
        console.error(`ChartManager: Could not retrieve series data:`, dataError);
      }
    }
    
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