// components/LiveChart.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWebSocket } from '../lib/websocket'; // Import the WebSocket hook (preserved as requested)
import { ChartComponent, ChartHandle } from './Chart'; // Import your ChartComponent
import { Time } from 'lightweight-charts'; // Import Time type for strictness
import { StockItem, ChartDataPoint } from './StockTable'; // Import StockItem and ChartDataPoint from StockTable

interface StockDataPayload {
  ticker: string;
  timestamp: number; // In milliseconds, as sent by Python producer
  price: number;
}

// Updated LiveChartProps to accept stockData and initialChartData
interface LiveChartProps {
  stockData: StockItem; // The current stock data for live updates
  initialChartData: ChartDataPoint[]; // The sliding window history from StockTable
}

// Helper function to get current Unix timestamp in seconds (preserved)
const getUnixTimeInSeconds = (date: Date): number => Math.floor(date.getTime() / 1000);

export default function LiveChart({ stockData, initialChartData }: LiveChartProps) {
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const chartRef = useRef<ChartHandle | null>(null); // Ref to access ChartComponent's exposed methods
  const [loading, setLoading] = useState(true); // ADDED: useState for loading
  const [error, setError] = useState<string | null>(null);

  // State for the topic this specific chart instance is subscribed to (preserved)
  // Derived from stockData.ticker prop now
  const [subscribedTopic, setSubscribedTopic] = useState(`stock:${stockData.ticker.toUpperCase()}`);

  // 1. Fetch the WebSocket URL from the Next.js API route (preserved)
  useEffect(() => {
    const fetchWsUrl = async () => {
      try {
        const response = await fetch('/api/ws'); // API route path
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWsUrl(data.websocketUrl);
        console.log('Fetched WebSocket URL:', data.websocketUrl);
      } catch (e) {
        console.error('Failed to fetch WebSocket URL from API:', e);
        setWsUrl(null);
      }
    };
    fetchWsUrl();
  }, []);

  // Correctly destructure useWebSocket hook's return values here
  // The error "Cannot find name 'isConnected'" implies these weren't correctly destructured
  // or the hook itself isn't returning them as expected.
  // Assuming the useWebSocket hook in '../lib/websocket.ts' is correctly implemented
  // and returns { isConnected, error, lastMessage, sendMessage }.
  const { isConnected, error: wsError, lastMessage, sendMessage } = useWebSocket<StockDataPayload>(wsUrl, {
    shouldReconnect: true,
    reconnectInterval: 3000,
  });

  // Effect to handle WebSocket subscription (preserved, now uses stockData.ticker)
  useEffect(() => {
    // Update subscribedTopic if defaultTicker changes (e.g., if LiveChart is reused for a different stock)
    setSubscribedTopic(`stock:${stockData.ticker.toUpperCase()}`);

    if (isConnected && wsUrl && subscribedTopic) {
      const subscribeMessage = {
        type: "subscribe",
        topic: subscribedTopic
      };
      sendMessage(JSON.stringify(subscribeMessage));
      console.log(`Sent subscribe message for topic: ${subscribedTopic}`);

      // When a new subscription happens, ensure chart is cleared or re-initialized
      // This is now handled by the chart initialization useEffect below, using initialChartData prop.
    }
  }, [isConnected, wsUrl, stockData.ticker, sendMessage, subscribedTopic]); // Added stockData.ticker to dependencies

  // Effect for initializing the chart with initialChartData from StockTable
  // This runs when the component mounts or when initialChartData/stockData.ticker changes.
  useEffect(() => {
    if (chartRef.current) {
      if (initialChartData && initialChartData.length > 0) {
        // If initialChartData is provided (from StockTable's sliding window), use it directly.
        // ChartComponent's internal useEffect will pick this up via its initialData prop.
        setLoading(false); // Data is available immediately
      } else {
        // If StockTable didn't have history (e.g., brand new stock),
        // we might still want a fallback to fetch historical data here.
        // For now, we'll assume StockTable provides enough or live data will fill it.
        // If no initial data and not loading, it will show "No historical data".
        setLoading(false); // No data to load immediately, but not an error
      }
    }
  }, [initialChartData, stockData.ticker]); // Re-run if initial data or ticker changes

  // Effect to process live messages from this chart's own WebSocket (preserved)
  useEffect(() => {
    if (lastMessage && lastMessage.data.ticker) {
      // IMPORTANT: Filter messages to ensure they belong to this chart's subscribed topic
      if (lastMessage.data.ticker.toUpperCase() === stockData.ticker.toUpperCase()) { // Use stockData.ticker directly
        const newChartPoint: ChartDataPoint = {
          time: lastMessage.data.timestamp, // Keep time as number (milliseconds) as per StockTable.ChartDataPoint
          value: lastMessage.data.price,
        };

        if (chartRef.current) {
          // Pass newChartPoint to ChartComponent, which will handle the conversion to seconds
          chartRef.current.updateData(newChartPoint);
          setLoading(false); // Data is now flowing, so not loading
        }
      }
    }
  }, [lastMessage, stockData.ticker]); // Use stockData.ticker for filtering

  // Helper function to get the error message safely
  const getErrorMessage = (err: string | Error | null): string => {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    return 'An unknown error occurred';
  };

  // Display loading, error, or no data messages
  // Using wsError for WebSocket-specific errors, and local 'error' state for other issues.
  if (loading) return <div className="text-gray-400">Loading chart...</div>;
  if (wsError || error) return <div className="text-red-400">Error: {getErrorMessage(wsError || error)}</div>;
  if (!loading && initialChartData.length === 0 && (!lastMessage || lastMessage.data.ticker.toUpperCase() !== stockData.ticker.toUpperCase())) {
    return <div className="text-gray-400">No historical data available for {stockData.ticker}.</div>;
  }

  return (
    <div className="p-4 rounded-lg shadow-inner relative">
      {/* Connection Status Indicator - Positioned absolutely OVER the chart (preserved) */}
      {wsUrl ? (
        <div className="absolute top-10 left-10 z-10">
          {isConnected ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500 bg-opacity-20 text-green-300">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></span>
              Live
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 bg-opacity-20 text-red-300">
              <span className="w-2 h-2 bg-red-400 rounded-full mr-1"></span>
              Offline
            </span>
          )}
          {/* Use wsError for displaying WebSocket related errors */}
          {!isConnected && (wsError || error) && ( // Check both wsError and local error state
            <p className="text-red-400 text-xs mt-1 text-right">{getErrorMessage(wsError || error)}</p>
          )}
        </div>
      ) : (
        <div className="absolute top-2 right-2 z-10">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500 bg-opacity-20 text-gray-300">
            Connecting...
          </span>
        </div>
      )}

      {/* The Chart Component */}
      <div className="bg-black p-4 rounded-lg shadow-inner border border-gray-700">
        <ChartComponent
          ref={chartRef}
          initialData={initialChartData} // Pass initialChartData from props
          colors={{
            backgroundColor: '#000000',
            lineColor: '#87CEEB',
            textColor: '#D1D5DB',
            areaTopColor: 'rgba(135, 206, 235, 0.7)',
            areaBottomColor: 'rgba(135, 206, 235, 0.01)',
            vertLinesColor: '#1E293B',
            horzLinesColor: '#4A5568',
          }}
          watermarkText={stockData.ticker} // Use stockData.ticker for watermark
        />
      </div>
    </div>
  );
}
