// components/LiveChart.tsx
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ChartComponent, ChartHandle } from './Chart';
import type { StockItem, ChartDataPoint, CandleDataPoint } from './stock-table';

interface LiveChartProps {
  stockData: StockItem;
  initialChartData?: ChartDataPoint[];
  initialCandleData?: CandleDataPoint[];
  chartType?: 'area' | 'candlestick';
}

export default function LiveChart({ 
  stockData, 
  initialChartData = [], 
  initialCandleData = [], 
  chartType = 'candlestick' 
}: LiveChartProps) {
  const chartRef = useRef<ChartHandle | null>(null);
  const [isChartReady, setIsChartReady] = useState(false); // State to track ChartComponent readiness

  // Callback function to be passed to ChartComponent
  const handleChartReady = useCallback(() => {
    console.log(`LiveChart (${stockData.ticker}): ChartComponent reported ready.`);
    setIsChartReady(true);
  }, [stockData.ticker]);

  // Effect to set chart data whenever chart data props change
  // This will now handle both initial load and subsequent live updates from StockTable
  useEffect(() => {
    const dataToUse = chartType === 'candlestick' ? initialCandleData : initialChartData;
    console.log(`LiveChart (${stockData.ticker}): useEffect triggered for ${chartType} data. Current data length:`, dataToUse.length);

    // Only attempt to set data if the ChartComponent is ready and chartRef.current is available
    console.log(`isChartReady (${isChartReady}): chartRef.current ${chartRef.current}`);
    if (isChartReady && chartRef.current) {
      console.log(`LiveChart (${stockData.ticker}): chartRef.current is available and chart is ready. Attempting to set data.`);
      if (dataToUse && dataToUse.length > 0) {
        console.log(`LiveChart (${stockData.ticker}): Calling chartRef.current.setData with data length:`, dataToUse.length);
        chartRef.current.setData(dataToUse); // Set the entire dataset
      } else {
        console.log(`LiveChart (${stockData.ticker}): data is empty or null. Calling chartRef.current.setData([])`);
        chartRef.current.setData([]); // Set empty if no data
      }
    } else {
      console.log(`LiveChart (${stockData.ticker}): chartRef.current is NOT available yet OR chart is not ready. Waiting...`);
    }
  }, [initialChartData, initialCandleData, stockData.ticker, isChartReady, chartType]);

  // We no longer need the `loading`, `error`, `hasData` states or their conditional rendering
  // in LiveChart, as ChartComponent will always be mounted and handle its own internal state.

  const dataToUse = chartType === 'candlestick' ? initialCandleData : initialChartData;
  
  console.log(`LiveChart (${stockData.ticker}): Always rendering ChartComponent with ${chartType} chart.`);
  return (
    <div className="relative">
      <div className="bg-black rounded-lg border border-gray-600 overflow-hidden">
        <ChartComponent
          ref={chartRef}
          initialData={dataToUse} // Pass the current historical data
          chartType={chartType}
          colors={{
            backgroundColor: '#000000',
            lineColor: '#87CEEB',
            textColor: '#D1D5DB',
            areaTopColor: 'rgba(135, 206, 235, 0.7)',
            areaBottomColor: 'rgba(135, 206, 235, 0.01)',
            vertLinesColor: '#1E293B',
            horzLinesColor: '#4A5568',
            upColor: '#26a69a',
            downColor: '#ef5350',
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
          }}
          watermarkText={stockData.ticker} // Use the ticker as watermark text
          onChartReady={handleChartReady} // Pass the callback to ChartComponent
        />
      </div>
    </div>
  );
}
