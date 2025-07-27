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
  const [isChartReady, setIsChartReady] = useState(false);
  const lastDataLengthRef = useRef({ chartData: 0, candleData: 0 });

  // DEBUG: Track component renders
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  console.log(`🔄 LiveChart (${stockData.ticker}) render #${renderCountRef.current}`);

  // Callback function to be passed to ChartComponent
  const handleChartReady = useCallback(() => {
    console.log(`LiveChart (${stockData.ticker}): ChartComponent reported ready.`);
    setIsChartReady(true);
    
    // Set initial data when chart becomes ready
    if (chartRef.current) {
      const dataToUse = chartType === 'candlestick' ? initialCandleData : initialChartData;
      if (dataToUse.length > 0) {
        chartRef.current.setData(dataToUse);
        lastDataLengthRef.current = {
          chartData: initialChartData.length,
          candleData: initialCandleData.length
        };
      }
    }
  }, [stockData.ticker, chartType, initialChartData, initialCandleData]);

  // Use imperative updates for new data points instead of re-rendering
  useEffect(() => {
    if (!isChartReady || !chartRef.current) return;

    const currentDataLength = chartType === 'candlestick' ? initialCandleData.length : initialChartData.length;
    const lastDataLength = chartType === 'candlestick' ? lastDataLengthRef.current.candleData : lastDataLengthRef.current.chartData;

    // Only add new data points, don't re-render the entire chart
    if (currentDataLength > lastDataLength) {
      const dataToUse = chartType === 'candlestick' ? initialCandleData : initialChartData;
      const newDataPoints = dataToUse.slice(lastDataLength);
      
      console.log(`📈 LiveChart (${stockData.ticker}): Adding ${newDataPoints.length} new data points imperatively`);
      
      // Add each new point individually to maintain live updates
      newDataPoints.forEach(point => {
        chartRef.current!.updateData(point);
      });

      // Update our tracking
      lastDataLengthRef.current = {
        chartData: initialChartData.length,
        candleData: initialCandleData.length
      };
    }
  }, [initialChartData.length, initialCandleData.length, isChartReady, chartType, stockData.ticker]);

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
