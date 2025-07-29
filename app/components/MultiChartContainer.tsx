'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTheme } from './ThemeContext';
import { ChartComponent } from './Chart';
import type { ChartHandle } from './Chart';
import type { CandleDataPoint } from './stock-table/types';

interface ChartConfig {
  id: string;
  ticker: string | null;
  chartRef: React.RefObject<ChartHandle | null>;
  historicalCandles: CandleDataPoint[];
  currentCandle: CandleDataPoint | null;
  currentCandleStartTime: number | null;
}

interface LayoutConfig {
  cols: number;
  rows: number;
}

const LAYOUT_CONFIGS: Record<string, LayoutConfig> = {
  '1x1': { cols: 1, rows: 1 },
  '1x2': { cols: 1, rows: 2 },
  '1x3': { cols: 1, rows: 3 },
  '1x4': { cols: 1, rows: 4 },
  '2x2': { cols: 2, rows: 2 },
};

export default function MultiChartContainer() {
  const { colors } = useTheme();
  const searchParams = useSearchParams();
  
  // Parse URL parameters
  const layoutParam = searchParams.get('s') || '1x1';
  const tickersParam = searchParams.get('t') || '';
  
  const layout = LAYOUT_CONFIGS[layoutParam] || LAYOUT_CONFIGS['1x1'];
  const totalCharts = layout.cols * layout.rows;
  const initialTickers = tickersParam ? tickersParam.split(',').filter(t => t.trim()) : [];
  
  // State for chart configurations
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [draggedChart, setDraggedChart] = useState<string | null>(null);
  const [dragOverChart, setDragOverChart] = useState<string | null>(null);
  
  // WebSocket connection state
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  
  // Initialize charts
  useEffect(() => {
    const newCharts: ChartConfig[] = [];
    for (let i = 0; i < totalCharts; i++) {
      newCharts.push({
        id: `chart-${i}`,
        ticker: initialTickers[i] || null,
        chartRef: React.createRef<ChartHandle>(),
        historicalCandles: [],
        currentCandle: null,
        currentCandleStartTime: null,
      });
    }
    setCharts(newCharts);
  }, [totalCharts, tickersParam]);
  
  // Fetch WebSocket URL
  useEffect(() => {
    const fetchWsUrl = async () => {
      try {
        const response = await fetch('/api/ws');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWsUrl(data.websocketUrl);
      } catch (e) {
        console.error('MultiChart: Failed to fetch WebSocket URL:', e);
        setWsUrl(null);
        setConnectionStatus('disconnected');
      }
    };
    fetchWsUrl();
  }, []);
  
  // WebSocket connection
  useEffect(() => {
    if (!wsUrl) return;
    
    const connectWebSocket = () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        setConnectionStatus('connected');
        
        // Subscribe to all active tickers
        charts.forEach(chart => {
          if (chart.ticker) {
            const subscribeMessage = {
              type: "subscribe",
              topic: `stock:${chart.ticker.toUpperCase()}`
            };
            ws.send(JSON.stringify(subscribeMessage));
          }
        });
      };
      
      ws.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          
          // Handle stock updates
          if (parsedData.ticker && parsedData.price && parsedData.timestamp) {
            const ticker = parsedData.ticker.toUpperCase();
            const price = parsedData.price;
            const timestamp = typeof parsedData.timestamp === 'string' 
              ? new Date(parsedData.timestamp).getTime() 
              : parsedData.timestamp;
            
            // Update charts for this ticker
            setCharts(prevCharts => 
              prevCharts.map(chart => {
                if (chart.ticker?.toUpperCase() === ticker) {
                  const updatedChart = { ...chart };
                  
                  // Collect background candle data
                  collectBackgroundCandle(updatedChart, timestamp, price);
                  
                  // Update chart via ref
                  if (chart.chartRef.current) {
                    chart.chartRef.current.updateWithPrice(timestamp, price);
                  }
                  
                  return updatedChart;
                }
                return chart;
              })
            );
          }
        } catch (error) {
          console.error('MultiChart: Error parsing WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        setConnectionStatus('disconnected');
        setTimeout(connectWebSocket, 5000);
      };
      
      ws.onerror = (error) => {
        console.error('MultiChart: WebSocket error:', error);
        setConnectionStatus('disconnected');
        ws.close();
      };
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [wsUrl, charts]);
  
  // Background candle collection function
  const collectBackgroundCandle = useCallback((chart: ChartConfig, timestamp: number, price: number) => {
    const timeInSeconds = Math.floor(timestamp / 1000);
    const bucketTime = Math.floor(timeInSeconds / 60) * 60;
    
    if (chart.currentCandleStartTime !== bucketTime) {
      // Starting a new minute - finalize previous candle
      if (chart.currentCandle && chart.currentCandleStartTime !== null) {
        chart.historicalCandles.push(chart.currentCandle);
        
        // Keep only last 100 candles
        if (chart.historicalCandles.length > 100) {
          chart.historicalCandles.shift();
        }
      }
      
      // Start new current candle
      chart.currentCandle = {
        time: bucketTime * 1000,
        open: price,
        high: price,
        low: price,
        close: price,
      };
      chart.currentCandleStartTime = bucketTime;
    } else {
      // Update current candle
      if (chart.currentCandle) {
        chart.currentCandle = {
          time: chart.currentCandle.time,
          open: chart.currentCandle.open,
          close: price,
          low: Math.min(chart.currentCandle.low, price),
          high: Math.max(chart.currentCandle.high, price),
        };
      }
    }
  }, []);
  
  // Handle ticker input change
  const handleTickerChange = useCallback((chartId: string, newTicker: string) => {
    const ticker = newTicker.trim().toUpperCase();
    
    setCharts(prevCharts => 
      prevCharts.map(chart => {
        if (chart.id === chartId) {
          // Unsubscribe from old ticker
          if (chart.ticker && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const unsubscribeMessage = {
              type: "unsubscribe",
              topic: `stock:${chart.ticker.toUpperCase()}`
            };
            wsRef.current.send(JSON.stringify(unsubscribeMessage));
          }
          
          const updatedChart = {
            ...chart,
            ticker: ticker || null,
            historicalCandles: [],
            currentCandle: null,
            currentCandleStartTime: null,
          };
          
          // Subscribe to new ticker
          if (ticker && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const subscribeMessage = {
              type: "subscribe",
              topic: `stock:${ticker}`
            };
            wsRef.current.send(JSON.stringify(subscribeMessage));
          }
          
          return updatedChart;
        }
        return chart;
      })
    );
  }, []);
  
  // Drag and drop handlers
  const handleDragStart = useCallback((chartId: string) => {
    setDraggedChart(chartId);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent, chartId: string) => {
    e.preventDefault();
    setDragOverChart(chartId);
  }, []);
  
  const handleDragLeave = useCallback(() => {
    setDragOverChart(null);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent, targetChartId: string) => {
    e.preventDefault();
    setDragOverChart(null);
    
    if (draggedChart && draggedChart !== targetChartId) {
      setCharts(prevCharts => {
        const newCharts = [...prevCharts];
        const draggedIndex = newCharts.findIndex(chart => chart.id === draggedChart);
        const targetIndex = newCharts.findIndex(chart => chart.id === targetChartId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
          // Swap the tickers and chart data
          const draggedTicker = newCharts[draggedIndex].ticker;
          const draggedHistoricalCandles = newCharts[draggedIndex].historicalCandles;
          const draggedCurrentCandle = newCharts[draggedIndex].currentCandle;
          const draggedCurrentCandleStartTime = newCharts[draggedIndex].currentCandleStartTime;
          
          newCharts[draggedIndex].ticker = newCharts[targetIndex].ticker;
          newCharts[draggedIndex].historicalCandles = newCharts[targetIndex].historicalCandles;
          newCharts[draggedIndex].currentCandle = newCharts[targetIndex].currentCandle;
          newCharts[draggedIndex].currentCandleStartTime = newCharts[targetIndex].currentCandleStartTime;
          
          newCharts[targetIndex].ticker = draggedTicker;
          newCharts[targetIndex].historicalCandles = draggedHistoricalCandles;
          newCharts[targetIndex].currentCandle = draggedCurrentCandle;
          newCharts[targetIndex].currentCandleStartTime = draggedCurrentCandleStartTime;
          
          // Reset chart data for both charts
          if (newCharts[draggedIndex].chartRef.current) {
            const historicalData = [...newCharts[draggedIndex].historicalCandles];
            if (newCharts[draggedIndex].currentCandle) {
              historicalData.push(newCharts[draggedIndex].currentCandle);
            }
            newCharts[draggedIndex].chartRef.current.setData(historicalData);
          }
          
          if (newCharts[targetIndex].chartRef.current) {
            const historicalData = [...newCharts[targetIndex].historicalCandles];
            if (newCharts[targetIndex].currentCandle) {
              historicalData.push(newCharts[targetIndex].currentCandle);
            }
            newCharts[targetIndex].chartRef.current.setData(historicalData);
          }
        }
        
        return newCharts;
      });
    }
    
    setDraggedChart(null);
  }, [draggedChart]);
  
  // Calculate chart dimensions based on layout
  const chartHeight = layout.rows === 1 ? 'calc(100vh - 200px)' : 
                     layout.rows === 2 ? 'calc((100vh - 250px) / 2)' :
                     layout.rows === 3 ? 'calc((100vh - 300px) / 3)' :
                     'calc((100vh - 350px) / 4)';
  
  const gridTemplateColumns = layout.cols === 1 ? '1fr' : 
                              layout.cols === 2 ? '1fr 1fr' : 
                              '1fr 1fr 1fr';
  
  return (
    <div className={`${colors.containerGradient} rounded-lg ${colors.shadowLg} mx-auto max-w-full relative border ${colors.border} p-4`}>
      {/* Header */}
      <div className={`${colors.tableHeaderGradient} rounded-lg p-4 mb-4 flex justify-between items-center`}>
        <div className="flex items-center gap-4">
          <h2 className={`text-xl font-bold ${colors.textPrimary}`}>Multi-Chart View</h2>
          <div className={`text-sm ${colors.textSecondary}`}>
            Layout: {layoutParam} ({totalCharts} charts)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className={`text-sm ${colors.textSecondary}`}>
            {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      
      {/* Charts Grid */}
      <div 
        className="grid gap-4"
        style={{ 
          gridTemplateColumns,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`
        }}
      >
        {charts.map((chart) => (
          <ChartContainer
            key={chart.id}
            chart={chart}
            height={chartHeight}
            onTickerChange={handleTickerChange}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            isDraggedOver={dragOverChart === chart.id}
            colors={colors}
          />
        ))}
      </div>
    </div>
  );
}

interface ChartContainerProps {
  chart: ChartConfig;
  height: string;
  onTickerChange: (chartId: string, ticker: string) => void;
  onDragStart: (chartId: string) => void;
  onDragOver: (e: React.DragEvent, chartId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, chartId: string) => void;
  isDraggedOver: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}

function ChartContainer({
  chart,
  height,
  onTickerChange,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  isDraggedOver,
  colors
}: ChartContainerProps) {
  const [tickerInput, setTickerInput] = useState('');
  
  const handleSubmitTicker = (e: React.FormEvent) => {
    e.preventDefault();
    if (tickerInput.trim()) {
      onTickerChange(chart.id, tickerInput.trim());
      setTickerInput('');
    }
  };
  
  const getInitialData = () => {
    const allCandles = [...chart.historicalCandles];
    if (chart.currentCandle) {
      allCandles.push(chart.currentCandle);
    }
    return allCandles;
  };
  
  return (
    <div
      className={`${colors.chartBackground} rounded-lg border-2 transition-all duration-200 ${
        isDraggedOver 
          ? 'border-blue-500 border-dashed shadow-lg transform scale-[1.02]' 
          : colors.border
      }`}
      style={{ height }}
      draggable={!!chart.ticker}
      onDragStart={() => onDragStart(chart.id)}
      onDragOver={(e) => onDragOver(e, chart.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, chart.id)}
    >
      {/* Title Bar */}
      <div className={`${colors.tableHeaderGradient} p-3 rounded-t-lg flex justify-between items-center cursor-move`}>
        <div className="flex items-center gap-2">
          {chart.ticker ? (
            <span className={`font-bold ${colors.accent} text-lg`}>
              {chart.ticker}
            </span>
          ) : (
            <span className={`${colors.textMuted} text-sm`}>
              Empty Chart
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          ⋮⋮
        </div>
      </div>
      
      {/* Chart Content */}
      <div className="p-2" style={{ height: 'calc(100% - 60px)' }}>
        {chart.ticker ? (
          <ChartComponent
            ref={chart.chartRef}
            initialData={getInitialData()}
            chartType="candlestick"
            watermarkText={chart.ticker}
            isExpanded={true}
            colors={{
              backgroundColor: colors.chartBackgroundHex,
              textColor: colors.chartTextColor,
              upColor: colors.candleUpColor,
              downColor: colors.candleDownColor,
              wickUpColor: colors.candleWickUpColor,
              wickDownColor: colors.candleWickDownColor,
              vertLinesColor: colors.gridLines,
              horzLinesColor: colors.gridLines,
              watermarkTextColor: colors.chartWatermark,
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className={`text-4xl ${colors.textMuted} mb-4`}>📈</div>
              <form onSubmit={handleSubmitTicker} className="space-y-3">
                <input
                  type="text"
                  placeholder="Enter ticker symbol (e.g., AAPL)"
                  value={tickerInput}
                  onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                  className={`w-full px-3 py-2 ${colors.inputBackground} ${colors.inputBorder} ${colors.inputText} ${colors.inputPlaceholder} rounded-md focus:outline-none ${colors.inputFocusBorder} focus:ring-1 focus:ring-blue-500`}
                />
                <button
                  type="submit"
                  className={`w-full px-4 py-2 ${colors.buttonPrimary} text-white rounded-md transition-colors duration-200`}
                >
                  Load Chart
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}