// components/ManagedChart.tsx
'use client';

import React, { useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { ChartComponent, type ChartHandle } from './Chart';
import type { ChartDataPoint, CandleDataPoint } from './stock-table/types';
import type { StockItem } from './stock-table/types';

interface ManagedChartProps {
  stockData: StockItem;
  chartType?: 'area' | 'candlestick';
  onChartReady?: () => void;
}

// Define the shape of the ref handle that this component will expose to its parent
export interface ManagedChartHandle {
  updateWithPrice: (timestamp: number, price: number) => void;
}

// Use forwardRef to allow StockTable to get a ref to this component
const ManagedChart = forwardRef<ManagedChartHandle, ManagedChartProps>(({ 
  stockData, 
  chartType = 'candlestick',
  onChartReady 
}, ref) => {
  const chartRef = useRef<ChartHandle>(null);
  
  // Track current 1-minute candle data for aggregation
  const currentCandle = useRef<CandleDataPoint | null>(null);
  const currentCandleStartTime = useRef<number | null>(null);

  // Expose updateWithPrice method to parent via ref
  useImperativeHandle(ref, () => ({
    updateWithPrice: (timestamp: number, price: number) => {
      if (!chartRef.current) return;
      
      // Convert timestamp to seconds for lightweight-charts
      const timeInSeconds = Math.floor(timestamp / 1000);
      
      console.log(`ManagedChart: Updating ${chartType} chart for ${stockData.ticker} with price ${price} at ${timestamp} (${timeInSeconds}s)`);
      
      if (chartType === 'candlestick') {
        // 1-minute candlestick aggregation
        const bucketTime = Math.floor(timeInSeconds / 60) * 60; // Round down to nearest minute
        
        if (currentCandleStartTime.current !== bucketTime) {
          // Starting a new candle - finalize previous one if exists
          if (currentCandle.current && currentCandleStartTime.current !== null) {
            console.log(`ManagedChart: Finalizing candle for ${stockData.ticker} at ${new Date(currentCandleStartTime.current * 1000).toISOString()}`);
            chartRef.current.updateData(currentCandle.current);
          }
          
          // Start new candle
          currentCandle.current = {
            time: bucketTime * 1000, // Chart.tsx expects milliseconds and will convert to seconds
            open: price,
            high: price,
            low: price,
            close: price,
          };
          currentCandleStartTime.current = bucketTime;
          
          console.log(`ManagedChart: Started new candle for ${stockData.ticker} at ${new Date(bucketTime * 1000).toISOString()}`);
        } else {
          // Update current candle
          if (currentCandle.current) {
            currentCandle.current.high = Math.max(currentCandle.current.high, price);
            currentCandle.current.low = Math.min(currentCandle.current.low, price);
            currentCandle.current.close = price;
          }
        }
        
        // Always update chart with current candle state
        if (currentCandle.current) {
          chartRef.current.updateData(currentCandle.current);
        }
      } else {
        // Area chart - simple point update
        const areaPoint: ChartDataPoint = {
          time: timestamp, // Chart.tsx expects milliseconds and will convert to seconds
          value: price,
        };
        chartRef.current.updateData(areaPoint);
      }
    }
  }));

  // Create initial data from current stock data
  const initialData = useMemo(() => {
    if (!stockData.price || !stockData.timestamp) {
      return [];
    }
    
    const timestampMs = typeof stockData.timestamp === 'string' ? 
      new Date(stockData.timestamp).getTime() : 
      stockData.timestamp;
    
    console.log(`ManagedChart: Creating initial data for ${stockData.ticker} with timestamp ${timestampMs}ms`);
    
    if (chartType === 'candlestick') {
      return [{
        time: timestampMs, // Chart.tsx expects milliseconds and will convert to seconds
        open: stockData.price,
        high: stockData.price,
        low: stockData.price,
        close: stockData.price,
      }] as CandleDataPoint[];
    } else {
      return [{
        time: timestampMs, // Chart.tsx expects milliseconds and will convert to seconds
        value: stockData.price,
      }] as ChartDataPoint[];
    }
  }, [stockData.ticker, stockData.price, stockData.timestamp, chartType]);

  return (
    <div className="w-full h-96 bg-gray-900 rounded-lg" style={{ minHeight: '400px' }}>
      <ChartComponent
        ref={chartRef}
        initialData={initialData}
        chartType={chartType}
        watermarkText={stockData.ticker}
        onChartReady={onChartReady}
      />
    </div>
  );
});

ManagedChart.displayName = 'ManagedChart';

export default ManagedChart;