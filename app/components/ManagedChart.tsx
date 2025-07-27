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
      
      // Convert timestamp to seconds for lightweight-charts (ensure it's a number)
      const timeInSeconds = Math.floor(timestamp / 1000);
      
      console.log(`ManagedChart: Updating ${chartType} chart for ${stockData.ticker} with price ${price} at ${timestamp}ms (${timeInSeconds}s)`);
      console.log(`ManagedChart: timestamp type:`, typeof timestamp, `timeInSeconds type:`, typeof timeInSeconds);
      
      if (chartType === 'candlestick') {
        // 1-minute candlestick aggregation using official pattern
        const bucketTime = Math.floor(timeInSeconds / 60) * 60; // Round down to nearest minute
        
        if (currentCandleStartTime.current !== bucketTime) {
          // Starting a new minute - start new candle
          console.log(`ManagedChart: Starting NEW 1-minute candle for ${stockData.ticker} at bucket ${bucketTime} (${new Date(bucketTime * 1000).toISOString()})`);
          
          currentCandle.current = {
            time: bucketTime * 1000, // Chart.tsx expects milliseconds and will convert to seconds
            open: price,
            high: price,
            low: price,
            close: price,
          };
          currentCandleStartTime.current = bucketTime;
          
          // Send new candle to chart
          chartRef.current.updateData(currentCandle.current);
        } else {
          // Update current candle using official lightweight-charts pattern
          if (currentCandle.current) {
            // Official pattern: preserve time/open, update close/high/low
            const updatedCandle = {
              time: currentCandle.current.time,                           // Keep SAME timestamp
              open: currentCandle.current.open,                           // Keep original open
              close: price,                                               // Update close to latest price
              low: Math.min(currentCandle.current.low, price),            // Extend low if needed
              high: Math.max(currentCandle.current.high, price),          // Extend high if needed
            };
            
            // Update our stored candle
            currentCandle.current = updatedCandle;
            
            console.log(`ManagedChart: Updating current 1-min candle for ${stockData.ticker} - close: ${price}, high: ${updatedCandle.high}, low: ${updatedCandle.low}, time: ${updatedCandle.time} (type: ${typeof updatedCandle.time})`);
            
            // Send updated candle to chart with SAME timestamp (officially supported)
            chartRef.current.updateData(updatedCandle);
          }
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