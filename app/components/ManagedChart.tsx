// components/ManagedChart.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { chartManager } from './ChartManager';
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

    // Create chart using ChartManager
    chartManager.createChart(
      stockData.ticker,
      containerRef.current,
      chartType
    );

    isInitialized.current = true;
    onChartReady?.();

    // Cleanup function
    return () => {
      chartManager.destroyChart(stockData.ticker);
      isInitialized.current = false;
    };
  }, [stockData.ticker, chartType, onChartReady]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-96 bg-gray-900 rounded-lg"
      style={{ minHeight: '400px' }}
    />
  );
};

export default ManagedChart;