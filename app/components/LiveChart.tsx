// components/LiveChart.tsx
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react'; // Added useCallback
import { ChartComponent, ChartHandle } from './Chart';
import { StockItem, ChartDataPoint } from './StockTable';

interface LiveChartProps {
  stockData: StockItem;
  // This prop will now contain the current, evolving historical data
  initialChartData: ChartDataPoint[];
}

export default function LiveChart({ stockData, initialChartData }: LiveChartProps) {
  const chartRef = useRef<ChartHandle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasData, setHasData] = useState(false);
  const [isChartReady, setIsChartReady] = useState(false); // State to track ChartComponent readiness

  // Callback function to be passed to ChartComponent
  const handleChartReady = useCallback(() => {
    console.log(`LiveChart (${stockData.ticker}): ChartComponent reported ready.`);
    setIsChartReady(true);
  }, [stockData.ticker]); // Dependency on stockData.ticker for logging context

  // Effect to set chart data whenever initialChartData prop changes
  useEffect(() => {
    console.log(`LiveChart (${stockData.ticker}): useEffect triggered for initialChartData. Current initialChartData length:`, initialChartData.length);

    // Only attempt to set data if the ChartComponent is ready and chartRef.current is available
    if (isChartReady && chartRef.current) {
      console.log(`LiveChart (${stockData.ticker}): chartRef.current is available and chart is ready. Attempting to set data.`);
      if (initialChartData && initialChartData.length > 0) {
        console.log(`LiveChart (${stockData.ticker}): Calling chartRef.current.setData with data length:`, initialChartData.length);
        chartRef.current.setData(initialChartData); // Set the entire dataset
        setLoading(false);
        setHasData(true); // Indicate that data has been received and set
      } else {
        console.log(`LiveChart (${stockData.ticker}): initialChartData is empty or null. Calling chartRef.current.setData([])`);
        chartRef.current.setData([]); // Set empty if no data
        setLoading(true); // Keep loading if no data, waiting for updates
        setHasData(false);
      }
    } else {
      console.log(`LiveChart (${stockData.ticker}): chartRef.current is NOT available yet OR chart is not ready. Waiting...`);
    }
  }, [initialChartData, stockData.ticker, isChartReady]); // Add isChartReady to dependencies

  // Removed: The old useEffect that watched chartRef.current directly.
  // Now ChartComponent will explicitly tell us when it's ready via onChartReady prop.

  // Helper function to get error message (still useful for general error state)
  const getErrorMessage = (err: string | Error | null): string => {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    return 'An unknown error occurred';
  };

  // Conditional rendering for loading, error, or no data states
  if (loading && !hasData) {
    console.log(`LiveChart (${stockData.ticker}): Rendering loading state.`);
    return <div className="text-gray-400 p-4">Loading chart for {stockData.ticker}...</div>;
  }
  if (error) {
    console.error(`LiveChart (${stockData.ticker}): Rendering error state:`, error);
    return <div className="text-red-400 p-4">Error: {getErrorMessage(error)}</div>;
  }
  if (!hasData && initialChartData.length === 0) {
    console.log(`LiveChart (${stockData.ticker}): Rendering no data state.`);
    return <div className="text-gray-400 p-4">No historical data available for {stockData.ticker}. Waiting for data...</div>;
  }

  console.log(`LiveChart (${stockData.ticker}): Rendering ChartComponent.`);
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
