// components/LiveChart.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWebSocket } from '../lib/websocket'; // Import the WebSocket hook
import { ChartComponent, ChartHandle, ChartDataPoint } from './Chart'; // Import your ChartComponent
import { Time } from 'lightweight-charts'; // Import Time type for strictness

interface LiveChartProps {
  defaultTicker: string; // e.g., "AVGO", "MSFT" - used to derive the initial topic
}

// Helper function to get current Unix timestamp in seconds
const getUnixTimeInSeconds = (date: Date): number => Math.floor(date.getTime() / 1000);

// Helper function to generate initial dummy data for the chart
// This is used if there's no live data yet, or when switching topics.
const generateInitialChartData = (ticker: string): ChartDataPoint[] => {
  const initialData: ChartDataPoint[] = [];
  let currentTime = getUnixTimeInSeconds(new Date()); // Start from current time in seconds
  let currentPrice = 100.00 + Math.random() * 50; // Random starting price

  // Generate 60 data points (e.g., covering 1 minute, with 1-second intervals)
  for (let i = 0; i < 60; i++) {
    const pointTime: Time = (currentTime - (60 - 1 - i)) as Time; // Explicitly cast to Time
    const value = parseFloat((currentPrice + (Math.random() * 1 - 0.5)).toFixed(2));
    initialData.push({ time: pointTime, value: Math.max(0.01, value) });
    currentPrice = value;
  }
  return initialData;
};


export default function LiveChart({ defaultTicker }: LiveChartProps) {
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const chartRef = useRef<ChartHandle | null>(null); // Ref to access ChartComponent's exposed methods

  // State for the topic this specific chart instance is subscribed to
  // Derived from defaultTicker prop
  const [subscribedTopic, setSubscribedTopic] = useState(`stock:${defaultTicker.toUpperCase()}`);

  // State to hold initial data for the chart.
  // This will accumulate a few points before live updates take over,
  // or provide a baseline when a new topic is selected.
  const [initialChartData, setInitialChartData] = useState<ChartDataPoint[]>(
    generateInitialChartData(defaultTicker)
  );

  // 1. Fetch the WebSocket URL from the Next.js API route
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
        setWsUrl('ws://localhost:8080'); // Fallback
      }
    };
    fetchWsUrl();
  }, []); 


  const { isConnected, error, lastMessage, sendMessage } = useWebSocket(wsUrl, {
    shouldReconnect: true,
    reconnectInterval: 3000,
  });


  useEffect(() => {
    if (isConnected && wsUrl && subscribedTopic) {
      const subscribeMessage = {
        type: "subscribe",
        topic: subscribedTopic
      };
      sendMessage(JSON.stringify(subscribeMessage)); 
      console.log(`Sent subscribe message for topic: ${subscribedTopic}`);

      setInitialChartData(generateInitialChartData(subscribedTopic.split(':')[1] || 'DEFAULT'));
    }
  }, [isConnected, wsUrl, subscribedTopic, sendMessage]);


  useEffect(() => {
    if (lastMessage && lastMessage.data.ticker) {
      // IMPORTANT: Filter messages to ensure they belong to this chart's subscribed topic
      // The server sends the raw data payload, which includes the ticker.
      if (lastMessage.data.ticker.toUpperCase() === subscribedTopic.split(':')[1]) {
        const newChartPoint: ChartDataPoint = {
          time: (lastMessage.data.timestamp / 1000) as Time,
          value: lastMessage.data.price,
        };

        // If chart is initialized, update it directly
        if (chartRef.current) {
          chartRef.current.updateData(newChartPoint);
        } else {
          // If chart is not yet initialized (first few points), accumulate initial data
          setInitialChartData(prevData => [...prevData, newChartPoint]);
        }
      } else {
          
      }
    }
  }, [lastMessage, subscribedTopic]); 


  return (
    <div className="p-4 rounded-lg shadow-inner relative"> {/* Added relative here */}

 {/* Connection Status Indicator - Positioned absolutely OVER the chart */}
        {wsUrl ? (
          <div className="absolute top-10 left-10 z-10"> {/* Adjusted top/right for padding */}
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
            )
          }
          {/* Only show error if not connected and there is an error */}
          {!isConnected && error && (
            <p className="text-red-400 text-xs mt-1 text-right">{error}</p>
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
          watermarkText={subscribedTopic.split(':')[1]}

        />
      </div>
    </div>
  );
}
