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

// Define an interface for the informational message type
interface InfoMessage {
  type: string;
  message: string;
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

  // 1. Fetch the WebSocket URL from the Next.js API route
  // This effect runs once on mount to get the WS URL.
  useEffect(() => {
    const fetchWsUrl = async () => {
      try {
        const response = await fetch('/api/ws'); // API route path
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWsUrl(data.websocketUrl);
        console.log('LiveChart: Fetched WebSocket URL:', data.websocketUrl);
        // setLoading(false); // Moved this to the effect that uses wsUrl
      } catch (e) {
        console.error('LiveChart: Failed to fetch WebSocket URL from API:', e);
        setError('Failed to get WebSocket URL.');
        setWsUrl(null);
        setLoading(false); // Stop loading if URL fetch fails
      }
    };
    fetchWsUrl();
  }, []);

  // Correctly destructure useWebSocket hook's return values here
  // The type of lastMessage might need to be more generic if it receives non-StockDataPayloads
  const { isConnected, error: wsError, lastMessage, sendMessage } = useWebSocket<any>(wsUrl, { // Changed to 'any' for lastMessage to allow for different types
    shouldReconnect: true,
    reconnectInterval: 3000,
  });

  // Effect to handle WebSocket subscription
  // This effect now explicitly depends on wsUrl being set.
  useEffect(() => {
    // Update subscribedTopic if stockData.ticker changes
    setSubscribedTopic(`stock:${stockData.ticker.toUpperCase()}`);

    if (isConnected && wsUrl && subscribedTopic) {
      const subscribeMessage = {
        type: "subscribe",
        topic: subscribedTopic
      };
      sendMessage(JSON.stringify(subscribeMessage));
      console.log(`LiveChart: Sent subscribe message for topic: ${subscribedTopic}`);
      setLoading(false); // Chart loading should stop once subscription is sent and connection is live
    } else if (!wsUrl) {
      console.log("LiveChart: wsUrl not set, skipping subscription message.");
      // Keep loading true if wsUrl is not yet available, as we're still waiting for it
    } else if (!isConnected) {
      console.log("LiveChart: Not connected, skipping subscription message.");
      // Keep loading true if not connected, as we're waiting for connection
    }
  }, [isConnected, wsUrl, stockData.ticker, sendMessage, subscribedTopic]); // Added subscribedTopic to dependencies


  // Effect for initializing the chart with initialChartData from StockTable
  useEffect(() => {
    if (chartRef.current) {
      if (initialChartData && initialChartData.length > 0) {
        chartRef.current.setData(initialChartData);
        // setLoading(false); // This can be set here if initial data is the primary loading indicator
      } else {
        // If no initial data, we'll rely on live data to populate the chart.
        // Keep loading true until live data starts flowing or an error occurs.
      }
    }
  }, [initialChartData, stockData.ticker]); // Re-run if initial data or ticker changes

  // Effect to process live messages from this chart's own WebSocket
  useEffect(() => {
    // Debugging: Log the raw lastMessage as soon as it's received
    if (lastMessage) {
      console.log("LiveChart: Raw lastMessage received:", lastMessage);

      let parsedData: StockDataPayload | InfoMessage | undefined;
      try {
        // If lastMessage.data is a string, attempt to parse it
        if (typeof lastMessage.data === 'string') {
          parsedData = JSON.parse(lastMessage.data);
        } else {
          // Otherwise, assume it's already an object (e.g., if useWebSocket already parsed it)
          parsedData = lastMessage.data;
        }
      } catch (e) {
        console.error("LiveChart: Error parsing lastMessage.data:", e);
        console.warn("LiveChart: Skipping malformed message (parsing error):", lastMessage);
        return; // Skip processing if parsing fails
      }

      console.log("LiveChart: parsedData (after potential parsing):", parsedData);

      // IMPORTANT FIX: Check if parsedData is a StockDataPayload before accessing ticker
      // Use a type guard or check for specific properties that define StockDataPayload
      if (
        parsedData &&
        (parsedData as StockDataPayload).ticker && // Check for ticker property
        typeof (parsedData as StockDataPayload).ticker === 'string' &&
        (parsedData as StockDataPayload).ticker.trim() !== '' &&
        (parsedData as StockDataPayload).timestamp != null &&
        (parsedData as StockDataPayload).price != null
      ) {
        const stockPayload = parsedData as StockDataPayload;

        // IMPORTANT: Filter messages to ensure they belong to this chart's subscribed topic
        if (stockPayload.ticker.toUpperCase() === stockData.ticker.toUpperCase()) {
          const newChartPoint: ChartDataPoint = {
            time: stockPayload.timestamp, // Keep time as number (milliseconds) as per StockTable.ChartDataPoint
            value: stockPayload.price,
          };

          if (chartRef.current) {
            chartRef.current.updateData(newChartPoint);
            setLoading(false); // Data is now flowing, so loading is complete
          }
        }
      } else if (parsedData) {
          // Log invalid message structure for debugging, but only if it's not a valid StockDataPayload
          // This will catch the "info" messages without throwing an error
          console.warn("LiveChart: Received non-stock data message or malformed stock data, skipping:", parsedData);
      }
    }
  }, [lastMessage, stockData.ticker]);

  // Helper function to get the error message safely
  const getErrorMessage = (err: string | Error | null): string => {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    return 'An unknown error occurred';
  };

  // Display loading, error, or no data messages
  if (loading) return <div className="text-gray-400">Loading chart...</div>;
  if (wsError || error) return <div className="text-red-400">Error: {getErrorMessage(wsError || error)}</div>;
  // Only show "No data" if not loading, no error, no initial data, AND no live data has come in for this ticker
  if (!loading && !wsError && !error && initialChartData.length === 0 && (!lastMessage || stockData.ticker.toUpperCase() !== (lastMessage?.data as StockDataPayload)?.ticker?.toUpperCase())) {
    return <div className="text-gray-400">No historical data available for {stockData.ticker}.</div>;
  }

  return (
    <div className="p-4 rounded-lg shadow-inner relative">
      {/* Connection Status Indicator - Positioned absolutely OVER the chart */}
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
          {!isConnected && (wsError || error) && (
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
