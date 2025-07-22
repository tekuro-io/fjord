// components/LiveChart.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
// Removed: import { useWebSocket } from '../lib/websocket'; // No longer needed
import { ChartComponent, ChartHandle } from './Chart';
import { StockItem, ChartDataPoint } from './StockTable'; // Still need StockItem and ChartDataPoint types

interface LiveChartProps {
  stockData: StockItem;
  // This prop will now contain both historical and live data, pushed from StockTable
  initialChartData: ChartDataPoint[];
}

export default function LiveChart({ stockData, initialChartData }: LiveChartProps) {
  const chartRef = useRef<ChartHandle | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasReceivedFirstData, setHasReceivedFirstData] = useState(false);

  // Effect to set initial chart data and update it as initialChartData prop changes
  useEffect(() => {
    console.log(`LiveChart (${stockData.ticker}): initialChartData received:`, initialChartData);
    if (chartRef.current) {
      if (initialChartData && initialChartData.length > 0) {
        // Set the entire dataset. This will also handle new live points
        // because StockTable updates the initialChartData array with new points.
        chartRef.current.setData(initialChartData);
        setLoading(false);
        setHasReceivedFirstData(true);
      } else {
        // If initial data is empty, keep loading and wait for data
        setLoading(true);
        setHasReceivedFirstData(false);
        // Explicitly set empty data on the chart if the array is empty
        chartRef.current.setData([]);
      }
    }
  }, [initialChartData, stockData.ticker]); // Dependencies: re-run if initialChartData or ticker changes

  // Simplified loading/no data messages
  if (loading && !hasReceivedFirstData) {
    return <div className="text-gray-400 p-4">Loading chart for {stockData.ticker}...</div>;
  }
  if (!hasReceivedFirstData && initialChartData.length === 0) {
    return <div className="text-gray-400 p-4">No historical data available for {stockData.ticker}. Waiting for live data...</div>;
  }

  return (
    <div className="p-4 rounded-lg shadow-inner relative">
      {/* Removed WebSocket connection status display, as LiveChart no longer manages its own connection */}
      {/* The main table's connection status is sufficient */}

      <div className="bg-black p-4 rounded-lg shadow-inner border border-gray-700">
        <ChartComponent
          ref={chartRef}
          initialData={initialChartData} // This prop now serves as the live data source as well
          colors={{
            backgroundColor: '#000000',
            lineColor: '#87CEEB',
            textColor: '#D1D5DB',
            areaTopColor: 'rgba(135, 206, 235, 0.7)',
            areaBottomColor: 'rgba(135, 206, 235, 0.01)',
            vertLinesColor: '#1E293B',
            horzLinesColor: '#4A5568',
          }}
          watermarkText={stockData.ticker}
        />
      </div>
    </div>
  );
}
