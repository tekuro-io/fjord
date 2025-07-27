// components/ManagedChart.tsx
'use client';

import React, { useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { ChartComponent, type ChartHandle } from './Chart';
import type { ChartDataPoint, CandleDataPoint } from './stock-table/types';
import type { StockItem } from './stock-table/types';
import { useTheme } from './ThemeContext';

interface ManagedChartProps {
  stockData: StockItem;
  chartType?: 'area' | 'candlestick';
  onChartReady?: () => void;
  historicalCandles?: CandleDataPoint[]; // Add optional historical data
  isExpanded?: boolean; // Whether this is an expanded chart with enhanced features
}

// Define the shape of the ref handle that this component will expose to its parent
export interface ManagedChartHandle {
  updateWithPrice: (timestamp: number, price: number) => void;
}

// Use forwardRef to allow StockTable to get a ref to this component
const ManagedChart = forwardRef<ManagedChartHandle, ManagedChartProps>(({ 
  stockData, 
  chartType = 'candlestick',
  onChartReady,
  historicalCandles = [], // Default to empty array if no historical data
  isExpanded = false
}, ref) => {
  const chartRef = useRef<ChartHandle>(null);
  const { colors } = useTheme();
  
  // Track completed and current candles for 1-minute aggregation
  const completedCandles = useRef<CandleDataPoint[]>([]);
  const currentCandle = useRef<CandleDataPoint | null>(null);
  const currentCandleStartTime = useRef<number | null>(null);
  
  // Initialize tracking from historical data if available
  React.useEffect(() => {
    if (historicalCandles.length > 0) {
      // If we have historical data, use the last candle as our starting point
      const lastCandle = historicalCandles[historicalCandles.length - 1];
      const timeInSeconds = Math.floor(lastCandle.time / 1000);
      const bucketTime = Math.floor(timeInSeconds / 60) * 60;
      
      // Set the current candle tracking to match the last historical candle
      currentCandle.current = { ...lastCandle };
      currentCandleStartTime.current = bucketTime;
    }
  }, [historicalCandles, stockData.ticker]);

  // Expose updateWithPrice method to parent via ref
  useImperativeHandle(ref, () => ({
    updateWithPrice: (timestamp: number, price: number) => {
      if (!chartRef.current) return;
      
      // Convert timestamp to seconds for lightweight-charts (ensure it's a number)
      const timeInSeconds = Math.floor(timestamp / 1000);
      
      if (chartType === 'candlestick') {
        // 1-minute candlestick aggregation using official pattern
        const bucketTime = Math.floor(timeInSeconds / 60) * 60; // Round down to nearest minute
        
        if (currentCandleStartTime.current !== bucketTime) {
          // Starting a new minute - finalize previous candle and start new one
          if (currentCandle.current && currentCandleStartTime.current !== null) {
            // Move current candle to completed candles
            completedCandles.current.push(currentCandle.current);
          }
          
          // Start new current candle
          currentCandle.current = {
            time: bucketTime * 1000, // Chart.tsx expects milliseconds and will convert to seconds
            open: price,
            high: price,
            low: price,
            close: price,
          };
          currentCandleStartTime.current = bucketTime;
          
          chartRef.current.updateData(currentCandle.current);
        } else {
          // Update current candle - keep same timestamp, update OHLC
          if (currentCandle.current) {
            // Update the growing candle with new tick data
            currentCandle.current = {
              time: currentCandle.current.time,                           // Keep SAME timestamp
              open: currentCandle.current.open,                           // Keep original open
              close: price,                                               // Update close to latest price
              low: Math.min(currentCandle.current.low, price),            // Extend low if needed
              high: Math.max(currentCandle.current.high, price),          // Extend high if needed
            };
            
            chartRef.current.updateData(currentCandle.current);
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

  // Create initial data from historical candles or current stock data
  const initialData = useMemo(() => {
    // If we have historical candles, use them
    if (historicalCandles.length > 0 && chartType === 'candlestick') {
      return historicalCandles;
    }
    
    // Fallback to current stock data if no historical data
    if (!stockData.price || !stockData.timestamp) {
      return [];
    }
    
    const timestampMs = typeof stockData.timestamp === 'string' ? 
      new Date(stockData.timestamp).getTime() : 
      stockData.timestamp;
    
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
  }, [stockData.ticker, stockData.price, stockData.timestamp, chartType, historicalCandles]);

  return (
    <div className={`w-full ${colors.chartBackground} rounded-lg overflow-hidden border ${colors.border}`} style={{ height: '400px' }}>
      <ChartComponent
        ref={chartRef}
        initialData={initialData}
        chartType={chartType}
        watermarkText={stockData.ticker}
        onChartReady={onChartReady}
        isExpanded={isExpanded}
        colors={{
          backgroundColor: colors.chartBackgroundHex,
          textColor: colors.chartTextColor,
          upColor: colors.candleUpColor,
          downColor: colors.candleDownColor,
          wickUpColor: colors.candleWickUpColor,
          wickDownColor: colors.candleWickDownColor,
          vertLinesColor: colors.gridLines,
          horzLinesColor: colors.gridLines,
          watermarkTextColor: colors.chartWatermark,
        }}
      />
    </div>
  );
});

ManagedChart.displayName = 'ManagedChart';

export default ManagedChart;