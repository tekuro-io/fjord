// components/LiveChart.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWebSocket } from '../lib/websocket';
import { ChartComponent, ChartHandle } from './Chart'; // FIXED: Added .tsx extension
import { Time } from 'lightweight-charts';
import { StockItem, ChartDataPoint } from './StockTable';

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

// Define a union type for all expected WebSocket messages
type WebSocketMessage = StockDataPayload | InfoMessage;

interface LiveChartProps {
  stockData: StockItem;
  initialChartData: ChartDataPoint[];
}

const getUnixTimeInSeconds = (date: Date): number => Math.floor(date.getTime() / 1000);

export default function LiveChart({ stockData, initialChartData }: LiveChartProps) {
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const chartRef = useRef<ChartHandle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasReceivedFirstData, setHasReceivedFirstData] = useState(false);

  const [subscribedTopic, setSubscribedTopic] = useState(`stock:${stockData.ticker.toUpperCase()}`);

  useEffect(() => {
    const fetchWsUrl = async () => {
      try {
        const response = await fetch('/api/ws');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWsUrl(data.websocketUrl);
        console.log('LiveChart: Fetched WebSocket URL:', data.websocketUrl);
      } catch (e) {
        console.error('LiveChart: Failed to fetch WebSocket URL from API:', e);
        setError('Failed to get WebSocket URL.');
        setWsUrl(null);
        setLoading(false);
      }
    };
    fetchWsUrl();
  }, []);

  const { isConnected, error: wsError, lastMessage, sendMessage } = useWebSocket<WebSocketMessage>(wsUrl, {
    shouldReconnect: true,
    reconnectInterval: 3000,
  });

  useEffect(() => {
    setSubscribedTopic(`stock:${stockData.ticker.toUpperCase()}`);

    if (isConnected && wsUrl && subscribedTopic) {
      const subscribeMessage = {
        type: "subscribe",
        topic: subscribedTopic
      };
      sendMessage(JSON.stringify(subscribeMessage));
      console.log(`LiveChart: Sent subscribe message for topic: ${subscribedTopic}`);
    } else if (!wsUrl) {
      console.log("LiveChart: wsUrl not set, skipping subscription message.");
    } else if (!isConnected) {
      console.log("LiveChart: Not connected, skipping subscription message.");
    }
  }, [isConnected, wsUrl, stockData.ticker, sendMessage, subscribedTopic]);

  useEffect(() => {
    console.log(`LiveChart (${stockData.ticker}): initialChartData received:`, initialChartData);
    if (chartRef.current) {
      if (initialChartData && initialChartData.length > 0) {
        chartRef.current.setData(initialChartData);
        setLoading(false);
        setHasReceivedFirstData(true);
      } else {
        setLoading(true); // Keep loading if no initial data, waiting for live data
        setHasReceivedFirstData(false);
      }
    }
  }, [initialChartData, stockData.ticker]);

  useEffect(() => {
    if (lastMessage) {
      console.log("LiveChart: Raw lastMessage received (from useWebSocket):", lastMessage);

      let parsedData: WebSocketMessage | undefined;
      try {
        if (typeof lastMessage.data === 'string') {
          parsedData = JSON.parse(lastMessage.data);
        } else {
          parsedData = lastMessage.data;
        }
      } catch (e) {
        console.error("LiveChart: Error parsing lastMessage.data:", e, "Raw data:", lastMessage.data);
        console.warn("LiveChart: Skipping malformed message (parsing error):", lastMessage);
        return;
      }

      console.log("LiveChart: parsedData (after potential parsing):", parsedData);

      // Type guard to check if parsedData is a StockDataPayload
      const isStockDataPayload = (data: WebSocketMessage): data is StockDataPayload => {
        // Ensure data is an object and has the expected properties
        return typeof data === 'object' && data !== null &&
               'ticker' in data && typeof data.ticker === 'string' && data.ticker.trim() !== '' &&
               'timestamp' in data && typeof data.timestamp === 'number' &&
               'price' in data && typeof data.price === 'number';
      };

      if (parsedData && isStockDataPayload(parsedData)) {
        const stockPayload = parsedData;

        if (stockPayload.ticker.toUpperCase() === stockData.ticker.toUpperCase()) {
          const newChartPoint: ChartDataPoint = {
            time: stockPayload.timestamp,
            value: stockPayload.price,
          };

          if (chartRef.current) {
            console.log(`LiveChart (${stockData.ticker}): Sending new point to chart:`, newChartPoint);
            chartRef.current.updateData(newChartPoint);
            setLoading(false);
            setHasReceivedFirstData(true);
          }
        } else {
          console.log(`LiveChart: Received data for different ticker (${stockPayload.ticker}), skipping this chart.`);
        }
      } else if (parsedData) {
          console.warn("LiveChart: Received non-stock data message or malformed stock data, skipping:", parsedData);
      }
    }
  }, [lastMessage, stockData.ticker]);

  const getErrorMessage = (err: string | Error | null): string => {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    return 'An unknown error occurred';
  };

  if (loading && !hasReceivedFirstData) {
    return <div className="text-gray-400">Loading chart...</div>;
  }
  if (wsError || error) {
    return <div className="text-red-400">Error: {getErrorMessage(wsError || error)}</div>;
  }
  if (!hasReceivedFirstData && initialChartData.length === 0) {
    return <div className="text-gray-400">No historical data available for {stockData.ticker}. Waiting for live data...</div>;
  }


  return (
    <div className="p-4 rounded-lg shadow-inner relative">
      {wsUrl ? (
        <div className="absolute top-10 left-10 z-10">
          {isConnected ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500 bg-opacity-20 text-green-300">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></span>
              Live
            </span>
          ) : (
            <span className="inline-flex items-items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 bg-opacity-20 text-red-300">
              <span className="w-2 h-2 bg-red-400 rounded-full mr-1"></span>
              Offline
            </span>
          )}
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

      <div className="bg-black p-4 rounded-lg shadow-inner border border-gray-700">
        <ChartComponent
          ref={chartRef}
          initialData={initialChartData}
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
