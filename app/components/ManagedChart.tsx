// components/ManagedChart.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { chartManager, type ChartDataPoint, type CandleDataPoint } from './ChartManager';
import type { StockItem } from './stock-table';

interface ManagedChartProps {
  stockData: StockItem;
  chartType?: 'area' | 'candlestick';
  onChartReady?: () => void;
}

const ManagedChart: React.FC<ManagedChartProps> = ({ 
  stockData, 
  chartType = 'candlestick',
  onChartReady 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!containerRef.current || isInitialized.current) return;

    const initializeChart = async () => {
      try {
        // Create initial data point from current stock data if available
        let initialData: ChartDataPoint[] | CandleDataPoint[] | undefined = undefined;
        
        if (stockData.price && stockData.timestamp) {
          // Convert to seconds for lightweight-charts consistency - ALWAYS divide by 1000 like working version
          const timestampMs = typeof stockData.timestamp === 'string' ? 
            new Date(stockData.timestamp).getTime() : 
            stockData.timestamp;
          const timestampSeconds = Math.floor(timestampMs / 1000);
          
          console.log(`ManagedChart: Creating initial data for ${stockData.ticker} with timestamp ${timestampSeconds}s (from ${timestampMs}ms)`);
          
          if (chartType === 'candlestick') {
            initialData = [{
              time: timestampSeconds,
              open: stockData.price,
              high: stockData.price,
              low: stockData.price,
              close: stockData.price,
            }] as CandleDataPoint[];
          } else {
            initialData = [{
              time: timestampSeconds,
              value: stockData.price,
            }] as ChartDataPoint[];
          }
        }

        // Create chart using ChartManager with initial data
        chartManager.createChart(
          stockData.ticker,
          containerRef.current!,
          chartType,
          initialData
        );

        isInitialized.current = true;
        onChartReady?.();
      } catch (error) {
        console.error('Failed to initialize chart for', stockData.ticker, error);
      }
    };

    initializeChart();

    // Cleanup function
    return () => {
      chartManager.destroyChart(stockData.ticker);
      isInitialized.current = false;
    };
  }, [stockData.ticker, stockData.price, stockData.timestamp, chartType, onChartReady]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-96 bg-gray-900 rounded-lg"
      style={{ minHeight: '400px' }}
    />
  );
};

export default ManagedChart;