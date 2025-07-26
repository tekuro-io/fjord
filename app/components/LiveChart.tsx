// components/LiveChart.tsx
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ChartComponent, ChartHandle } from './Chart';
import { StockItem, ChartDataPoint } from './stock-table';

interface LiveChartProps {
  stockData: StockItem;
  initialChartData: ChartDataPoint[];
}

export default function LiveChart({ stockData, initialChartData }: LiveChartProps) {
  const chartRef = useRef<ChartHandle | null>(null);
  const [isChartReady, setIsChartReady] = useState(false); // State to track ChartComponent readiness

  // Callback function to be passed to ChartComponent
  const handleChartReady = useCallback(() => {
    console.log(`LiveChart (${stockData.ticker}): ChartComponent reported ready.`);
    setIsChartReady(true);
  }, [stockData.ticker]);

  // Effect to set chart data whenever initialChartData prop changes
  // This will now handle both initial load and subsequent live updates from StockTable
  useEffect(() => {
    console.log(`LiveChart (${stockData.ticker}): useEffect triggered for initialChartData. Current initialChartData length:`, initialChartData.length);

    // Only attempt to set data if the ChartComponent is ready and chartRef.current is available
    console.log(`isChartReady (${isChartReady}): chartRef.current ${chartRef.current}`);
    if (isChartReady && chartRef.current) {
      console.log(`LiveChart (${stockData.ticker}): chartRef.current is available and chart is ready. Attempting to set data.`);
      if (initialChartData && initialChartData.length > 0) {
        console.log(`LiveChart (${stockData.ticker}): Calling chartRef.current.setData with data length:`, initialChartData.length);
        chartRef.current.setData(initialChartData); // Set the entire dataset
      } else {
        console.log(`LiveChart (${stockData.ticker}): initialChartData is empty or null. Calling chartRef.current.setData([])`);
        chartRef.current.setData([]); // Set empty if no data
      }
    } else {
      console.log(`LiveChart (${stockData.ticker}): chartRef.current is NOT available yet OR chart is not ready. Waiting...`);
    }
  }, [initialChartData, stockData.ticker, isChartReady]);

  // We no longer need the `loading`, `error`, `hasData` states or their conditional rendering
  // in LiveChart, as ChartComponent will always be mounted and handle its own internal state.

  console.log(`LiveChart (${stockData.ticker}): Always rendering ChartComponent.`);
  return (
    <div className="p-4 rounded-lg shadow-inner relative">
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
          onChartReady={handleChartReady} // Pass the callback to ChartComponent
        />
      </div>
    </div>
  );
}
