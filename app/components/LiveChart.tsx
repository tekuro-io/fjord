// components/LiveChart.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
// Removed: import { useWebSocket } from '../lib/websocket'; // No longer needed
import { ChartComponent, ChartHandle } from './Chart';
import { StockItem, ChartDataPoint } from './StockTable';

// Removed: StockDataPayload and InfoMessage interfaces as LiveChart no longer processes raw WebSocket messages
// interface StockDataPayload {
//   ticker: string;
//   timestamp: number;
//   price: number;
// }
// interface InfoMessage {
//   type: string;
//   message: string;
// }
// Removed: type WebSocketMessage = StockDataPayload | InfoMessage;

interface LiveChartProps {
  stockData: StockItem;
  // This prop will now contain the current, evolving historical data
  initialChartData: ChartDataPoint[];
}

export default function LiveChart({ stockData, initialChartData }: LiveChartProps) {
  const chartRef = useRef<ChartHandle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false); // Renamed from hasSetInitialChartData for clarity

  // Removed: wsUrl state and its useEffect to fetch WebSocket URL
  // Removed: useWebSocket hook and its states/functions (isConnected, wsError, lastMessage, sendMessage)
  // Removed: subscribedTopic state and its useEffect to send subscription messages

  // Effect to set chart data whenever initialChartData prop changes
  // This will now handle both initial load and subsequent live updates from StockTable
  useEffect(() => {
    console.log(`LiveChart (${stockData.ticker}): initialChartData prop updated:`, initialChartData);
    if (chartRef.current) {
      if (initialChartData && initialChartData.length > 0) {
        chartRef.current.setData(initialChartData); // Set the entire dataset
        setLoading(false);
        setHasData(true); // Indicate that data has been received and set
      } else {
        chartRef.current.setData([]); // Set empty if no data
        setLoading(true); // Keep loading if no data, waiting for updates
        setHasData(false);
      }
    }
    // The chart needs to re-render when initialChartData changes (new points added by StockTable)
    // or when stockData.ticker changes (meaning a different chart is being displayed).
  }, [initialChartData, stockData.ticker]);

  // Helper function to get error message (still useful for general error state)
  const getErrorMessage = (err: string | Error | null): string => {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    return 'An unknown error occurred';
  };

  // Conditional rendering for loading, error, or no data states
  // The connection status indicators related to LiveChart's own WS are removed.
  if (loading && !hasData) {
    return <div className="text-gray-400 p-4">Loading chart for {stockData.ticker}...</div>;
  }
  // If there was an error fetching initial data (e.g., from StockTableLoader, though not directly handled here)
  // or if for some reason initialChartData becomes null/undefined, this might catch it.
  if (error) { // wsError is removed, only general error state remains
    return <div className="text-red-400 p-4">Error: {getErrorMessage(error)}</div>;
  }
  if (!hasData && initialChartData.length === 0) {
    return <div className="text-gray-400 p-4">No historical data available for {stockData.ticker}. Waiting for data...</div>;
  }

  return (
    <div className="p-4 rounded-lg shadow-inner relative">
      {/* Removed: Live/Offline status indicators as LiveChart no longer has its own WS */}
      {/* <div className="absolute top-10 left-10 z-10">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500 bg-opacity-20 text-gray-300">
          Data from Table
        </span>
      </div> */}

      <div className="bg-black p-4 rounded-lg shadow-inner border border-gray-700">
        <ChartComponent
          ref={chartRef}
          initialData={initialChartData} // Pass the current historical data
          colors={{
            backgroundColor: '#000000',
            lineColor: '#87CEEB',
            textColor: '#D1D5DB',
            areaTopColor: 'rgba(135, 206, 235, 0.7)',
            areaBottomColor: 'rgba(135, 206, 235, 0.01)',
            vertLinesColor: '#1E293B',
            horzLinesColor: '#4A5568',
          }}
          watermarkText={stockData.ticker} // Use the ticker as watermark text
        />
      </div>
    </div>
  );
}
