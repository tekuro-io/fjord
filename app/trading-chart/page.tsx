// app/trading-chart/page.tsx
'use client';

import { ChartComponent, ChartHandle, ChartDataPoint } from '../components/Chart';
import React, { useEffect, useRef } from 'react';
import { Time } from 'lightweight-charts';

// Helper function to get current Unix timestamp in seconds
const getUnixTimeInSeconds = (date: Date): number => Math.floor(date.getTime() / 1000);

// Helper function to generate random data (for AreaSeries)
const generateRandomPoint = (lastValue: number, time: Time): ChartDataPoint => {
    // Make value changes smaller for intraday, e.g., +/- 0.5
    const value = parseFloat((lastValue + (Math.random() * 1 - 0.5)).toFixed(2));
    return {
        time,
        value: Math.max(0.01, value), // Ensure value is not negative
    };
};

// Initial dummy data for intraday (e.g., covering 5 minutes, with 1-second intervals)
const initialIntradayData: ChartDataPoint[] = [];
const now = new Date(); // Start from current time
let currentTime = now.getTime(); // In milliseconds
let currentPrice = 100.00;

// Generate 300 data points (5 minutes * 60 seconds/minute = 300)
for (let i = 0; i < 300; i++) {
    const pointTime = getUnixTimeInSeconds(new Date(currentTime));
    const newPoint = generateRandomPoint(currentPrice, pointTime as Time);
    initialIntradayData.push(newPoint);
    currentPrice = newPoint.value;
    currentTime -= 1000; // Go back in time by 1 second for each initial point
}
initialIntradayData.reverse(); // Reverse to have ascending time order


const TradingChartPage = () => {
  const chartComponentRef = useRef<ChartHandle | null>(null);

  useEffect(() => {
    // Start from the latest time in initial data
    let lastTime = initialIntradayData.length > 0
        ? initialIntradayData[initialIntradayData.length - 1].time as number
        : getUnixTimeInSeconds(new Date());

    let lastValue = initialIntradayData.length > 0
        ? initialIntradayData[initialIntradayData.length - 1].value
        : 100.00; // Default if no initial data

    const interval = setInterval(() => {
      if (chartComponentRef.current) {
        lastTime += 1; // Always advance by exactly 1 second for real-time
        const newPoint = generateRandomPoint(lastValue, lastTime as Time);
        lastValue = newPoint.value; // Update lastValue for the next iteration

        chartComponentRef.current.updateData(newPoint);
      }
    }, 1000); // Push new data every 1 second

    return () => clearInterval(interval);
  }, []); // Empty dependency array

  return (
    <div style={{ padding: '20px', backgroundColor: '#111827', minHeight: '100vh', color: 'white' }}>
      <h1 style={{textAlign: 'center', color: '#60A5FA'}}>Live Intraday Chart (Seconds)</h1>
      <p style={{ textAlign: 'center', marginBottom: '20px', fontSize: '1.1em' }}>
        Watching value change every second, with time advancing by 1 second per point.
      </p>
      <div style={{ maxWidth: '900px', margin: '0 auto', border: '1px solid #4B5563', borderRadius: '8px', overflow: 'hidden' }}>
        <ChartComponent
          ref={chartComponentRef}
          initialData={initialIntradayData}
          colors={{
            backgroundColor: '#000000',
            lineColor: '#87CEEB',
            textColor: '#D1D5DB',
            areaTopColor: 'rgba(135, 206, 235, 0.7)',
            areaBottomColor: 'rgba(135, 206, 235, 0.01)',
            vertLinesColor: '#1E293B',
            horzLinesColor: '#4A5568',
          }}
          showWatermark={false}
        />
      </div>
    </div>
  );
};

export default TradingChartPage;