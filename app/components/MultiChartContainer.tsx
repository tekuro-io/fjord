'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from './ThemeContext';
import { X, Sun, Moon, Share } from 'lucide-react';
import ManagedChart, { type ManagedChartHandle } from './ManagedChart';
import type { StockItem, CandleDataPoint } from './stock-table/types';

interface ChartConfig {
  id: string;
  ticker: string | null;
  chartRef: React.RefObject<ManagedChartHandle | null>;
  historicalCandles: CandleDataPoint[];
}

interface LayoutConfig {
  cols: number;
  rows: number;
}

const LAYOUT_CONFIGS: Record<string, LayoutConfig> = {
  '1x1': { cols: 1, rows: 1 },
  '1x2': { cols: 1, rows: 2 },
  '1x3': { cols: 1, rows: 3 },
  '2x1': { cols: 2, rows: 1 },
  '2x2': { cols: 2, rows: 2 },
  '2x3': { cols: 2, rows: 3 },
  '3x1': { cols: 3, rows: 1 },
  '3x2': { cols: 3, rows: 2 },
  '3x3': { cols: 3, rows: 3 },
};

export default function MultiChartContainer() {
  const { colors, theme, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  
  // Parse URL parameters
  const layoutParam = searchParams.get('s') || '1x1';
  const tickersParam = searchParams.get('t') || '';
  
  const layout = LAYOUT_CONFIGS[layoutParam] || LAYOUT_CONFIGS['1x1'];
  const totalCharts = layout.cols * layout.rows;
  const initialTickers = tickersParam ? tickersParam.split(',').filter(t => t.trim()).map(t => t.trim().toUpperCase()) : [];
  
  // State for chart configurations
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [draggedChart, setDraggedChart] = useState<string | null>(null);
  const [dragOverChart, setDragOverChart] = useState<string | null>(null);
  
  // Track if we're currently in a drag operation to prevent WebSocket reconnections
  const isDragging = useRef(false);
  
  // WebSocket connection state
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const wsEffectActiveRef = useRef<string | null>(null); // Track which effect is currently active
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track reconnection timeout
  
  // Chart state tracking
  const chartStockData = useRef<Map<string, StockItem>>(new Map());
  
  // Track accumulated candle data for each ticker
  const chartCandleData = useRef<Map<string, CandleDataPoint[]>>(new Map());
  
  // UI state
  const [showShareFeedback, setShowShareFeedback] = useState(false);
  
  // Helper function to collect background candles for a ticker
  const collectBackgroundCandle = useCallback((ticker: string, timestamp: number, price: number) => {
    const timeInSeconds = Math.floor(timestamp / 1000);
    const bucketTime = Math.floor(timeInSeconds / 60) * 60; // Round down to nearest minute
    
    const existingCandles = chartCandleData.current.get(ticker) || [];
    const lastCandle = existingCandles[existingCandles.length - 1];
    
    if (!lastCandle || Math.floor(lastCandle.time / 1000) !== bucketTime) {
      // Start new candle
      const newCandle: CandleDataPoint = {
        time: bucketTime * 1000,
        open: price,
        high: price,
        low: price,
        close: price,
      };
      chartCandleData.current.set(ticker, [...existingCandles, newCandle]);
    } else {
      // Update existing candle
      const updatedCandles = [...existingCandles];
      const lastIndex = updatedCandles.length - 1;
      updatedCandles[lastIndex] = {
        ...lastCandle,
        close: price,
        high: Math.max(lastCandle.high, price),
        low: Math.min(lastCandle.low, price),
      };
      chartCandleData.current.set(ticker, updatedCandles);
    }
  }, []);
  
  // Initialize charts
  useEffect(() => {
    const newCharts: ChartConfig[] = [];
    for (let i = 0; i < totalCharts; i++) {
      newCharts.push({
        id: `chart-${i}`,
        ticker: initialTickers[i] || null,
        chartRef: React.createRef<ManagedChartHandle | null>(),
        historicalCandles: [],
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
  
  // Get active tickers from charts
  const activeTickers = useMemo(() => {
    return charts.map(chart => chart.ticker).filter(Boolean) as string[];
  }, [charts]);
  
  // Debounced version of active tickers to prevent rapid WebSocket reconnections during drag operations
  const [debouncedActiveTickers, setDebouncedActiveTickers] = useState<string[]>([]);
  useEffect(() => {
    console.log(`⏱️ Debounce: activeTickers changed to:`, activeTickers, 'isDragging:', isDragging.current);
    
    // Check if the tickers actually changed (not just reordered)
    const currentSet = new Set(debouncedActiveTickers);
    const newSet = new Set(activeTickers);
    const actuallyChanged = currentSet.size !== newSet.size || 
      [...currentSet].some(ticker => !newSet.has(ticker));
    
    if (!actuallyChanged) {
      console.log(`⏱️ Debounce: Tickers only reordered, not changed - skipping update`);
      return;
    }
    
    // Don't update debounced tickers during drag operations
    if (isDragging.current) {
      console.log(`⏱️ Debounce: Skipping update due to drag operation`);
      return;
    }
    
    const timer = setTimeout(() => {
      if (!isDragging.current) {
        console.log(`⏱️ Debounce: Updating debouncedActiveTickers to:`, activeTickers);
        setDebouncedActiveTickers(activeTickers);
      } else {
        console.log(`⏱️ Debounce: Skipping delayed update due to drag operation`);
      }
    }, 300); // 300ms debounce
    
    return () => {
      console.log(`⏱️ Debounce: Clearing timeout`);
      clearTimeout(timer);
    };
  }, [activeTickers, debouncedActiveTickers]);
  
  // WebSocket connection (only when there are debounced active tickers)
  useEffect(() => {
    const effectId = Math.random().toString(36).substr(2, 9);
    console.log(`🔌 WS Effect ${effectId}: Running with tickers:`, debouncedActiveTickers, 'isDragging:', isDragging.current, 'activeEffect:', wsEffectActiveRef.current);
    
    // If another effect is already active, bail out immediately
    if (wsEffectActiveRef.current && wsEffectActiveRef.current !== effectId) {
      console.log(`🔌 WS Effect ${effectId}: Another effect (${wsEffectActiveRef.current}) is active, skipping`);
      return;
    }
    
    if (!wsUrl || debouncedActiveTickers.length === 0 || isDragging.current) {
      // Close WebSocket if no active tickers or during drag operations
      if (debouncedActiveTickers.length === 0) {
        console.log(`🔌 WS Effect ${effectId}: No tickers - cleaning up all connections`);
        
        // Clear any pending reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
          console.log(`🔌 WS Effect ${effectId}: Cleared reconnection timeout`);
        }
        
        // Close WebSocket
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        
        // Reset connection state
        setConnectionStatus('disconnected');
        wsEffectActiveRef.current = null;
      }
      console.log(`🔌 WS Effect ${effectId}: Skipping connection`);
      return;
    }
    
    // Mark this effect as active
    wsEffectActiveRef.current = effectId;
    
    const connectWebSocket = () => {
      console.log(`🔌 WS Effect ${effectId}: Creating WebSocket connection`);
      if (wsRef.current) {
        console.log(`🔌 WS Effect ${effectId}: Closing existing WebSocket`);
        wsRef.current.close();
        wsRef.current = null;
      }
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log(`✅ WS Effect ${effectId}: WebSocket connected`);
        setConnectionStatus('connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          
          // Handle stock updates (same logic as StockTable)
          if (parsedData.ticker && parsedData.price != null && parsedData.timestamp) {
            const ticker = parsedData.ticker.toUpperCase();
            const price = parsedData.price;
            const timestamp = typeof parsedData.timestamp === 'string' 
              ? new Date(parsedData.timestamp).getTime() 
              : parsedData.timestamp;
            
            // Update stock data for this ticker
            const stockData: StockItem = {
              ticker,
              price,
              timestamp,
              prev_price: chartStockData.current.get(ticker)?.prev_price || price,
              delta: 0, // Can be calculated if needed
              volume: parsedData.volume || 0,
              multiplier: parsedData.multiplier || 0,
              float: parsedData.float || 0,
              mav10: parsedData.mav10 || 0,
              first_seen: chartStockData.current.get(ticker)?.first_seen || new Date().toISOString()
            };
            
            // Store the stock data
            chartStockData.current.set(ticker, stockData);
            
            // Collect background candle data for this ticker
            collectBackgroundCandle(ticker, timestamp, price);
            
            // Update all charts that match this ticker using ManagedChart's updateWithPrice
            charts.forEach(chart => {
              if (chart.ticker?.toUpperCase() === ticker && chart.chartRef.current) {
                try {
                  chart.chartRef.current.updateWithPrice(timestamp, price);
                } catch (chartError) {
                  console.error(`📊 MultiChart Update Error for ${ticker}:`, chartError);
                }
              }
            });
          }
        } catch (error) {
          console.error('MultiChart: Error parsing WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        console.log(`❌ WS Effect ${effectId}: WebSocket disconnected`);
        setConnectionStatus('disconnected');
        // Only reconnect if we still have active tickers and not during drag operations
        if (debouncedActiveTickers.length > 0 && !isDragging.current) {
          console.log(`🔄 WS Effect ${effectId}: Scheduling reconnection in 5s`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isDragging.current && debouncedActiveTickers.length > 0 && wsEffectActiveRef.current === effectId) {
              console.log(`🔄 WS Effect ${effectId}: Attempting reconnection`);
              connectWebSocket();
            } else {
              console.log(`🔄 WS Effect ${effectId}: Skipping reconnection - dragging:${isDragging.current} tickers:${debouncedActiveTickers.length} activeEffect:${wsEffectActiveRef.current}`);
            }
            reconnectTimeoutRef.current = null;
          }, 5000);
        } else {
          console.log(`🔄 WS Effect ${effectId}: No reconnection needed - dragging:${isDragging.current} tickers:${debouncedActiveTickers.length}`);
        }
      };
      
      ws.onerror = (error) => {
        console.error(`❌ WS Effect ${effectId}: WebSocket error:`, error);
        setConnectionStatus('disconnected');
        // Don't immediately reconnect on error to avoid spam
        ws.close();
      };
    };
    
    connectWebSocket();
    
    return () => {
      console.log(`🧹 WS Effect ${effectId}: Cleanup - closing WebSocket, activeEffect: ${wsEffectActiveRef.current}`);
      // Only cleanup if this effect is still the active one
      if (wsEffectActiveRef.current === effectId) {
        // Clear any pending reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
          console.log(`🧹 WS Effect ${effectId}: Cleared reconnection timeout during cleanup`);
        }
        
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        wsEffectActiveRef.current = null;
      }
    };
  }, [wsUrl, debouncedActiveTickers]);
  
  // Handle ticker subscriptions separately
  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    console.log('MultiChart: Subscribing to tickers:', debouncedActiveTickers);
    
    // Subscribe to all active tickers
    debouncedActiveTickers.forEach(ticker => {
      const subscribeMessage = {
        type: "subscribe",
        topic: `stock:${ticker.toUpperCase()}`
      };
      wsRef.current!.send(JSON.stringify(subscribeMessage));
      console.log(`MultiChart: Subscribed to ${ticker}`);
    });
  }, [debouncedActiveTickers, connectionStatus]); // Subscribe when tickers change or connection is established
  
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
            historicalCandles: ticker ? chartCandleData.current.get(ticker.toUpperCase()) || [] : [],
          };
          
          // ManagedChart will handle its own historical data initialization
          
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
  
  // Close chart handler
  const handleCloseChart = useCallback((chartId: string) => {
    setCharts(prevCharts => 
      prevCharts.map(chart => {
        if (chart.id === chartId) {
          // Unsubscribe from ticker if active
          if (chart.ticker && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const unsubscribeMessage = {
              type: "unsubscribe",
              topic: `stock:${chart.ticker.toUpperCase()}`
            };
            wsRef.current.send(JSON.stringify(unsubscribeMessage));
          }
          
          return {
            ...chart,
            ticker: null,
            historicalCandles: []
          };
        }
        return chart;
      })
    );
  }, []);
  
  // Share functionality
  const handleShare = useCallback(() => {
    const activeTickers = charts
      .map(chart => chart.ticker)
      .filter(Boolean);
    
    const url = new URL(window.location.origin + '/multichart');
    url.searchParams.set('s', layoutParam);
    if (activeTickers.length > 0) {
      url.searchParams.set('t', activeTickers.join(','));
    }
    
    navigator.clipboard.writeText(url.toString()).then(() => {
      setShowShareFeedback(true);
      setTimeout(() => setShowShareFeedback(false), 2000);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  }, [charts, layoutParam]);
  
  // Drag and drop handlers
  const handleDragStart = useCallback((chartId: string) => {
    console.log(`🖱️ Drag: Starting drag for chart ${chartId}`);
    isDragging.current = true;
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
          // Get the current chart configurations
          const draggedChart = newCharts[draggedIndex];
          const targetChart = newCharts[targetIndex];
          
          // Get historical candle data for both tickers
          const draggedCandles = draggedChart.ticker 
            ? chartCandleData.current.get(draggedChart.ticker.toUpperCase()) || []
            : [];
          const targetCandles = targetChart.ticker 
            ? chartCandleData.current.get(targetChart.ticker.toUpperCase()) || []
            : [];
          
          // Swap just the tickers and historical data, preserving chart refs
          const draggedTicker = draggedChart.ticker;
          const targetTicker = targetChart.ticker;
          
          // IMPORTANT: Don't call updateTickerAndData during drag operations
          // This would cause fitContent() and reset the chart zoom/view
          // Instead, let the charts naturally receive data via WebSocket based on their new ticker assignments
          // The existing chart instances will preserve their zoom/pan state
          
          // Update the chart configurations with swapped tickers
          // KEEP the existing chart refs to avoid re-creation
          newCharts[draggedIndex] = {
            ...draggedChart,
            ticker: targetTicker,
            historicalCandles: targetCandles,
            // Keep existing chartRef - chart instance preserved
          };
          
          newCharts[targetIndex] = {
            ...targetChart,
            ticker: draggedTicker,
            historicalCandles: draggedCandles,
            // Keep existing chartRef - chart instance preserved
          };
          
          // Charts are updated directly via refs - no component re-creation
          // WebSocket subscriptions remain intact
        }
        
        return newCharts;
      });
    }
    
    setDraggedChart(null);
    // End drag operation after a brief delay to allow state updates to settle
    setTimeout(() => {
      console.log(`🖱️ Drag: Ending drag operation`);
      isDragging.current = false;
      // Don't force update debounced tickers - let the natural debounce process handle it
      // This prevents triggering unnecessary WebSocket effect re-runs
    }, 100);
  }, [draggedChart]);
  
  // Calculate chart dimensions based on layout - use more vertical space
  // Accounts for: ThemeWrapper padding (16px), page header (40px), multichart header (80px), minimal footer (20px), gaps
  // More aggressive use of available vertical space
  const chartHeight = layout.rows === 1 ? 'calc(100vh - 160px)' : 
                     layout.rows === 2 ? 'calc((100vh - 180px) / 2)' :
                     layout.rows === 3 ? 'calc((100vh - 200px) / 3)' :
                     'calc((100vh - 220px) / 4)';
  
  // Responsive grid columns - stack on mobile for better usability
  const gridTemplateColumns = layout.cols === 1 ? '1fr' : 
                              layout.cols === 2 ? 'repeat(2, minmax(0, 1fr))' : 
                              'repeat(3, minmax(0, 1fr))';
  
  return (
    <div className={`${colors.containerGradient} rounded-lg ${colors.shadowLg} mx-auto max-w-screen-lg relative border ${colors.border} p-2 sm:p-3`}>
      {/* Header */}
      <div className={`${colors.tableHeaderGradient} rounded-lg p-3 mb-3 flex justify-between items-center relative`}>
        <div className="flex items-center gap-4">
          <h2 className={`text-xl font-bold ${colors.textPrimary}`}>Multi-Chart View</h2>
          <div className={`text-sm ${colors.textSecondary}`}>
            Layout: {layoutParam} ({totalCharts} charts)
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Momentum Scanner Button */}
          <Link 
            href="/" 
            className={`px-3 py-1.5 ${colors.buttonSecondary} text-white rounded text-xs font-medium transition-colors duration-200 hover:opacity-90`}
          >
            ← Momentum Scanner
          </Link>
          
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center cursor-pointer ${colors.textMuted} hover:${colors.secondary}`}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          
          {/* Share Button */}
          <button
            onClick={handleShare}
            className={`p-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center cursor-pointer ${colors.textMuted} hover:${colors.secondary}`}
            title="Share current configuration"
            aria-label="Share current configuration"
          >
            <Share className="w-4 h-4" />
          </button>
          
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              debouncedActiveTickers.length === 0 ? 'bg-gray-500' : 
              connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className={`text-sm ${colors.textSecondary}`}>
              {debouncedActiveTickers.length === 0 ? 'No Active Charts' :
               connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        {/* Share Feedback */}
        {showShareFeedback && (
          <div className={`absolute top-full right-0 mt-2 px-3 py-2 ${colors.successBg} ${colors.success} text-sm rounded-md shadow-lg z-10 whitespace-nowrap`}>
            Link copied!
          </div>
        )}
      </div>
      
      {/* Charts Grid */}
      <div 
        className="grid gap-1 sm:gap-2 w-full overflow-hidden"
        style={{ 
          gridTemplateColumns,
          gridTemplateRows: `repeat(${layout.rows}, ${chartHeight})`,
          maxWidth: '100%'
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
            onCloseChart={handleCloseChart}
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
  onCloseChart: (chartId: string) => void;
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
  colors,
  onCloseChart
}: ChartContainerProps) {
  const [tickerInput, setTickerInput] = useState('');
  
  const handleSubmitTicker = (e: React.FormEvent) => {
    e.preventDefault();
    if (tickerInput.trim()) {
      onTickerChange(chart.id, tickerInput.trim());
      setTickerInput('');
    }
  };
  
  
  return (
    <div
      className={`${colors.chartBackground} rounded-lg border-2 transition-all duration-200 w-full h-full overflow-hidden ${
        isDraggedOver 
          ? 'border-blue-500 border-dashed shadow-lg transform scale-[1.02]' 
          : colors.border
      }`}
      onDragOver={(e) => onDragOver(e, chart.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, chart.id)}
    >
      {/* Title Bar */}
      <div 
        className={`${colors.tableHeaderGradient} p-3 rounded-t-lg flex justify-between items-center cursor-move`}
        draggable={true}
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart(chart.id);
        }}
        title="Drag to reorder charts"
      >
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          <div className="text-xs text-gray-500 hover:text-gray-400 transition-colors">
            ⋮⋮
          </div>
          {/* Chart Title */}
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
        
        {/* Close Button (far right) */}
        {chart.ticker && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCloseChart(chart.id);
            }}
            onDragStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            className={`p-1 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-red-500 hover:text-white ${colors.textMuted}`}
            title="Close chart"
            aria-label="Close chart"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Chart Content */}
      <div className="p-2 w-full overflow-hidden" style={{ height: 'calc(100% - 60px)', maxWidth: '100%' }}>
        {chart.ticker ? (
          <div className="w-full h-full overflow-hidden">
            <ManagedChart
              ref={chart.chartRef}
              stockData={{
                ticker: chart.ticker,
                price: 0, // Will be updated via websocket
                timestamp: Date.now(),
                prev_price: 0,
                delta: 0,
                volume: 0,
                multiplier: 0,
                float: 0,
                mav10: 0,
                first_seen: new Date().toISOString()
              }}
              chartType="candlestick"
              historicalCandles={chart.historicalCandles}
              isExpanded={true}
            />
          </div>
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
                  className={`w-full px-3 py-2 ${colors.inputBackground} border-2 ${colors.inputBorder} ${colors.inputText} ${colors.inputPlaceholder} rounded-md focus:outline-none ${colors.inputFocusBorder} focus:ring-1 focus:ring-blue-500 transition-colors duration-200`}
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