'use client';

import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import {
  ArrowUp, ArrowDown, X, Tag, DollarSign, Percent, BarChart2, Activity,
  ChevronRight, ChevronDown, Frown, Brain, TrendingUp, TrendingDown, Maximize2
} from 'lucide-react';

import * as Tone from 'tone';
import ManagedChart, { type ManagedChartHandle } from "../ManagedChart";
import SentimentModal from "../SentimentModal";
import ChartModal from "../ChartModal";
import AlertManager from "../AlertManager";
import type { PatternAlertData } from "../PatternAlert";
import { TableHeader, TableControls, OptionsDrawer, StockTableStyles } from "./components";
import { useMarketStatus } from "./hooks";
import { StockItem, ChartDataPoint, CandleDataPoint, InfoMessage } from "./types";
import { useTheme } from "../ThemeContext";
import { 
  DELTA_FLASH_THRESHOLD, 
  PRICE_FLASH_THRESHOLD,
  calculateDelta,
  formatCurrency,
  formatDateTime,
  formatLargeNumber
} from "./utils";

const columnHelper = createColumnHelper<StockItem>();

// Memoized expanded row content that never re-renders after initial mount
const ExpandedRowContent = React.memo(({ 
  stockData, 
  onOpenSentiment,
  onOpenChart,
  patternAlert,
  chartRef,
  historicalCandles
}: { 
  stockData: StockItem;
  onOpenSentiment: () => void;
  onOpenChart: () => void;
  patternAlert?: PatternAlertData;
  chartRef: React.RefObject<ManagedChartHandle | null>;
  historicalCandles: CandleDataPoint[];
}) => {
  const { colors } = useTheme();
  const isBullish = patternAlert?.data.direction === 'bullish';
  const PatternIcon = patternAlert ? (isBullish ? TrendingUp : TrendingDown) : null;
  
  return (
    <div className={`${useTheme().colors.expandedRow} pl-4 pr-2 py-4`}>
      {/* Pattern Alert Box */}
      {patternAlert && (
        <div className={`mb-4 p-3 rounded-lg border-2 pattern-alert-flash ${
          isBullish 
            ? `${colors.successBg} border-green-500 ${colors.success}` 
            : `${colors.dangerBg} border-red-500 ${colors.danger}`
        }`}>
          <div className="flex items-center gap-2">
            {PatternIcon && <PatternIcon className={`w-5 h-5 ${isBullish ? colors.success : colors.danger}`} />}
            <span className="font-semibold">{patternAlert.data.pattern_display_name}</span>
            <span className="text-sm opacity-75">
              ${patternAlert.data.price.toFixed(2)} ({Math.round(patternAlert.data.confidence * 100)}%)
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${useTheme().colors.textSecondary} flex items-center`}>
          <span className={`w-2 h-2 ${useTheme().colors.accent.replace('text-', 'bg-')} rounded-full mr-2`}></span>
          Price Chart for {stockData.ticker}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSentiment}
            className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white ${useTheme().colors.buttonPrimary} rounded-md transition-colors duration-200 shadow-sm`}
          >
            <Brain className="w-4 h-4 flex-shrink-0" />
            <span className="flex items-center">AI Analysis</span>
          </button>
          <button
            onClick={onOpenChart}
            className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white ${useTheme().colors.buttonSecondary} rounded-md transition-colors duration-200 shadow-sm`}
          >
            <Maximize2 className="w-4 h-4 flex-shrink-0" />
            <span className="flex items-center">Expand Chart</span>
          </button>
        </div>
      </div>
      <div style={{ height: '400px' }}>
        <ManagedChart
          ref={chartRef}
          stockData={stockData}
          chartType="candlestick"
          historicalCandles={historicalCandles}
        />
      </div>
    </div>
  );
});

ExpandedRowContent.displayName = 'ExpandedRowContent';


export default function StockTable({ data: initialData }: { data: StockItem[] }) {
  const { theme, colors } = useTheme();
  const [currentData, setCurrentData] = React.useState<StockItem[]>(initialData);

  // LOG ALL STATE CHANGES TO TRACK DATA SOURCES
  const loggedSetCurrentData = React.useCallback((newData: StockItem[] | ((prevData: StockItem[]) => StockItem[])) => {
    if (typeof newData === 'function') {
      setCurrentData(prevData => {
        const result = newData(prevData);
        
        // Check for new tickers
        const prevTickers = new Set(prevData.map(item => item.ticker));
        const newTickers = result.filter(item => !prevTickers.has(item.ticker));
        if (newTickers.length > 0) {
          console.log(`🆕 StockTable setState: NEW TICKERS DETECTED:`, newTickers.map(t => `${t.ticker} (price: ${t.price}, other fields: ${Object.keys(t).filter(k => k !== 'ticker' && t[k as keyof StockItem] !== null).join(', ')})`));
        }
        
        return result;
      });
    } else {
      setCurrentData(newData);
    }
  }, []);
  const [sorting, setSorting] = React.useState([
    { id: "delta", desc: true },
    { id: "multiplier", desc: true },
  ]);
  const [numStocksToShow, setNumStocksToShow] = React.useState(20);
  const [multiplierFilter, setMultiplierFilter] = React.useState(2.0);
  const [showOptionsDrawer, setShowOptionsDrawer] = React.useState(false);

  const [isAlertActive, setIsAlertActive] = React.useState(false);
  const [alertSnapshotTickers, setAlertSnapshotTickers] = React.useState<string[]>([]);
  const [newStocksAlert, setNewStocksAlert] = React.useState<StockItem[]>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const [connectionStatus, setConnectionStatus] = React.useState<'connected' | 'disconnected'>('connected');
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());
  const [isLocked, setIsLocked] = React.useState(false);
  const [lockedTickers, setLockedTickers] = React.useState<Set<string>>(new Set());
  const [previousPositions, setPreviousPositions] = React.useState<Map<string, number>>(new Map());
  const [positionMovements, setPositionMovements] = React.useState<Map<string, 'up' | 'down'>>(new Map());
  const [recentlyUpdatedStocks, setRecentlyUpdatedStocks] = React.useState<Set<string>>(new Set());
  const [flashingStates, setFlashingStates] = React.useState<Map<string, boolean>>(new Map());
  const [priceFlashingStates, setPriceFlashingStates] = React.useState<Map<string, 'up' | 'down'>>(new Map());
  // Chart refs management - stores refs to ManagedChart components for each expanded ticker
  const chartRefs = React.useRef<Map<string, React.RefObject<ManagedChartHandle | null>>>(new Map());
  const [sentimentModalOpen, setSentimentModalOpen] = React.useState(false);
  const [sentimentTicker, setSentimentTicker] = React.useState<string>('');
  const [chartModalOpen, setChartModalOpen] = React.useState(false);
  const [chartModalData, setChartModalData] = React.useState<{ stockData: StockItem; historicalCandles: CandleDataPoint[]; chartRef: React.RefObject<ManagedChartHandle | null> } | null>(null);
  const [patternFlashingRows, setPatternFlashingRows] = React.useState<Map<string, 'bullish' | 'bearish'>>(new Map());
  const [expandedPatternAlerts, setExpandedPatternAlerts] = React.useState<Map<string, PatternAlertData>>(new Map());
  
  // Background candle collection system for all tickers
  const backgroundCandles = React.useRef<Map<string, CandleDataPoint[]>>(new Map());
  const backgroundCurrentCandles = React.useRef<Map<string, CandleDataPoint>>(new Map());
  const backgroundCandleStartTimes = React.useRef<Map<string, number>>(new Map());
  
  // Chart data arrays are no longer needed - managed by ChartManager
  const [wsUrl, setWsUrl] = React.useState<string | null>(null);
  const [tickersToSubscribe, setTickersToSubscribe] = React.useState<string[]>(
    initialData.map(item => item.ticker).filter(Boolean) as string[]
  );
  
  const { currentTimeET, marketStatus } = useMarketStatus();
  
  const synthRef = React.useRef<Tone.Synth | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null);
  const movementTimers = React.useRef<Map<string, NodeJS.Timeout>>(new Map());
  const recentUpdateTimers = React.useRef<Map<string, NodeJS.Timeout>>(new Map());
  const flashTimers = React.useRef<Map<string, NodeJS.Timeout>>(new Map());
  const priceFlashTimers = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Helper function to get or create a chart ref for a ticker
  const getChartRef = React.useCallback((ticker: string): React.RefObject<ManagedChartHandle | null> => {
    if (!chartRefs.current.has(ticker)) {
      const newRef = React.createRef<ManagedChartHandle | null>();
      chartRefs.current.set(ticker, newRef);
    }
    return chartRefs.current.get(ticker)!;
  }, []);

  // Background candle collection for all tickers (independent of chart visibility)
  const collectBackgroundCandle = React.useCallback((ticker: string, timestamp: number, price: number) => {
    // Convert timestamp to seconds for lightweight-charts consistency
    const timeInSeconds = Math.floor(timestamp / 1000);
    const bucketTime = Math.floor(timeInSeconds / 60) * 60; // Round down to nearest minute
    
    // Get or initialize ticker data
    if (!backgroundCandles.current.has(ticker)) {
      backgroundCandles.current.set(ticker, []);
    }
    
    const tickerCandles = backgroundCandles.current.get(ticker)!;
    const currentCandle = backgroundCurrentCandles.current.get(ticker);
    const currentStartTime = backgroundCandleStartTimes.current.get(ticker);
    
    if (currentStartTime !== bucketTime) {
      // Starting a new minute - finalize previous candle and start new one
      if (currentCandle && currentStartTime !== undefined) {
        // Add completed candle to history
        tickerCandles.push(currentCandle);
        
        // Keep only last 100 candles
        if (tickerCandles.length > 100) {
          tickerCandles.shift();
        }
      }
      
      // Start new current candle
      const newCandle: CandleDataPoint = {
        time: bucketTime * 1000, // Store in milliseconds for consistency
        open: price,
        high: price,
        low: price,
        close: price,
      };
      
      backgroundCurrentCandles.current.set(ticker, newCandle);
      backgroundCandleStartTimes.current.set(ticker, bucketTime);
    } else {
      // Update current candle - keep same timestamp, update OHLC
      if (currentCandle) {
        const updatedCandle: CandleDataPoint = {
          time: currentCandle.time,
          open: currentCandle.open,
          close: price,
          low: Math.min(currentCandle.low, price),
          high: Math.max(currentCandle.high, price),
        };
        
        backgroundCurrentCandles.current.set(ticker, updatedCandle);
      }
    }
  }, []);

  // Helper function to get historical candles for a ticker (for chart initialization)
  const getHistoricalCandles = React.useCallback((ticker: string): CandleDataPoint[] => {
    const historicalCandles = backgroundCandles.current.get(ticker) || [];
    const currentCandle = backgroundCurrentCandles.current.get(ticker);
    
    // Combine historical + current candle
    const allCandles = [...historicalCandles];
    if (currentCandle) {
      allCandles.push(currentCandle);
    }
    
    return allCandles;
  }, []);

  // Helper function to toggle row expansion
  const toggleRowExpansion = React.useCallback((rowId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
        // Clean up chart ref when collapsing
        chartRefs.current.delete(rowId);
      } else {
        newSet.add(rowId);
        // Chart will be created by ManagedChart component when rendered
      }
      return newSet;
    });
  }, []);


  React.useEffect(() => {
    if (typeof window !== 'undefined' && Tone && typeof Tone.Synth !== 'undefined') {
      if (!synthRef.current) {
        synthRef.current = new Tone.Synth().toDestination();
      }
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
    };
  }, []);


  // Effect to fetch WebSocket URL from /api/ws
  React.useEffect(() => {
    const fetchWsUrl = async () => {
      try {
        const response = await fetch('/api/ws'); // API route path
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWsUrl(data.websocketUrl);
      } catch (e) {
        console.error('StockTable: Failed to fetch WebSocket URL from API:', e);
        setWsUrl(null);
        setConnectionStatus('disconnected'); // Indicate connection issue
      }
    };
    fetchWsUrl();
  }, []); // Run once on mount

  // Centralized WebSocket connection management
  React.useEffect(() => {
    if (!wsUrl || tickersToSubscribe.length === 0) {
      return; // Wait for wsUrl and tickers to be fetched
    }

    const connectWebSocket = () => {
      // Ensure existing connection is closed before opening a new one
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const ws = new WebSocket(wsUrl); // Use the dynamically fetched URL

      wsRef.current = ws; // Store the new WebSocket instance in the ref

      ws.onopen = () => {
        setConnectionStatus('connected');
        // Send individual subscription messages for each ticker
        tickersToSubscribe.forEach(ticker => {
          const subscribeMessage = {
            type: "subscribe",
            topic: `stock:${ticker.toUpperCase()}` // Subscribe to individual stock topics
          };
          ws.send(JSON.stringify(subscribeMessage));
        });
      };

      ws.onmessage = (event) => {
        try {
          // Parse the incoming data
          const parsedData: unknown = JSON.parse(event.data);

          // Type guard for pattern detection messages (check first - more specific)
          const isPatternDetection = (data: unknown): boolean => {
            return typeof data === 'object' && 
                   data !== null && 
                   (('pattern' in data || 'alert_level' in data || 'confidence' in data) ||
                    ('topic' in data && (data as { topic: string }).topic === 'pattern_detection'));
          };

          // Type guard for StockItem - simpler logic since pattern detection is checked first
          const isStockItem = (data: unknown): data is StockItem => {
            return typeof data === 'object' && 
                   data !== null && 
                   'ticker' in data && 
                   typeof (data as StockItem).ticker === 'string' && 
                   (data as StockItem).ticker.trim() !== '';
          };

          // Type guard for any message that has a 'type' property AND explicitly does NOT have a 'ticker' property
          const isInfoOrControlMessage = (data: unknown): data is InfoMessage => {
            return typeof data === 'object' && data !== null && 'type' in data && !('ticker' in data);
          };

          let stockUpdates: StockItem[] = [];

          if (isInfoOrControlMessage(parsedData)) {
            // This handles 'info' messages, 'ack_subscribe' messages, and any other control messages
            const controlMsg = parsedData as InfoMessage; // Cast for easier access to properties
            if (controlMsg.type === 'ack_subscribe') {
                // Subscription acknowledged
            } else {
                // Other control message received
            }
            return; // Skip further processing for control messages
          } else if (isPatternDetection(parsedData)) {
            // Handle pattern detection messages - route to pattern alert system
            // Extract ticker from either root level or nested in data property
            let ticker = 'unknown';
            if (typeof parsedData === 'object' && parsedData !== null) {
              if ('ticker' in parsedData) {
                ticker = (parsedData as {ticker: string}).ticker;
              } else if ('data' in parsedData) {
                const dataObj = (parsedData as {data: unknown}).data;
                if (typeof dataObj === 'object' && dataObj !== null && 'ticker' in dataObj) {
                  ticker = (dataObj as {ticker: string}).ticker;
                }
              }
            }
            console.log(`🎯 Pattern Detection: Routing pattern alert for ${ticker}`);
            handlePatternAlert(parsedData as PatternAlertData);
            return; // Skip stock processing
          } else if (Array.isArray(parsedData)) {
            // Process arrays: separate pattern detection from stock updates
            const patternDetections = parsedData.filter(isPatternDetection);
            const stockItems = parsedData.filter(item => !isPatternDetection(item) && isStockItem(item));
            
            // Handle any pattern detections found in the array
            if (patternDetections.length > 0) {
              console.log(`🎯 Pattern Detection: Found ${patternDetections.length} pattern alerts in array`);
              patternDetections.forEach(pattern => handlePatternAlert(pattern as PatternAlertData));
            }
            
            // Set stock updates (excluding pattern detections)
            stockUpdates = stockItems;
          } else if (isStockItem(parsedData)) {
            // Single stock item (already confirmed not pattern detection above)
            stockUpdates = [parsedData];
          } else {
            // Unknown message type
            console.warn("StockTable: Received unknown message type:", parsedData);
            return;
          }

          // Track recently updated stocks for position indicators
          const updatedTickers = stockUpdates.map(update => update.ticker);
          setRecentlyUpdatedStocks(prev => {
            const newSet = new Set([...prev, ...updatedTickers]);
            
            // Clear timers for these stocks and set new ones
            updatedTickers.forEach(ticker => {
              if (recentUpdateTimers.current.has(ticker)) {
                clearTimeout(recentUpdateTimers.current.get(ticker));
              }
              
              const timer = setTimeout(() => {
                setRecentlyUpdatedStocks(currentSet => {
                  const updated = new Set(currentSet);
                  updated.delete(ticker);
                  return updated;
                });
                recentUpdateTimers.current.delete(ticker);
              }, 5000); // Track as recently updated for 5 seconds
              
              recentUpdateTimers.current.set(ticker, timer);
            });
            
            return newSet;
          });

          // Update the main table data (currentData)
          loggedSetCurrentData(prevData => {
            const newDataMap = new Map(prevData.map(item => [item.ticker, item]));
            
            // CHECK FOR NEW TICKERS BEFORE PROCESSING
            const existingTickers = new Set(prevData.map(item => item.ticker));
            const newTickers = stockUpdates.filter(update => !existingTickers.has(update.ticker));
            if (newTickers.length > 0) {
              console.log(`🚨 WebSocket: NEW TICKERS DETECTED in WebSocket updates:`, newTickers.map(t => 
                `${t.ticker} (price: ${t.price}, prev_price: ${t.prev_price}, volume: ${t.volume}, other fields: ${Object.keys(t).filter(k => k !== 'ticker' && t[k as keyof StockItem] !== null).join(', ')})`
              ));
            }
            
            stockUpdates.forEach(update => {
              const existingStock = newDataMap.get(update.ticker);

              // For WebSocket updates, the 'prev_price' for delta calculation should be the fixed baseline
              // that was established either on initial load or by the last Redis update.
              const priceForDeltaCalculation = existingStock?.prev_price ?? update.prev_price;

              // The new current price comes directly from the incoming WebSocket update.
              const newCurrentPrice = update.price;

              const calculatedDelta = calculateDelta(newCurrentPrice, priceForDeltaCalculation);

              // Determine if delta has changed to trigger flash
              const deltaChanged = existingStock?.delta !== calculatedDelta &&
                     (existingStock?.delta == null || calculatedDelta == null ||
                      Math.abs(existingStock.delta - calculatedDelta) > DELTA_FLASH_THRESHOLD);

              // Determine if price has changed significantly to trigger flash
              const priceChanged = existingStock?.price !== newCurrentPrice &&
                     (existingStock?.price == null || newCurrentPrice == null ||
                      (existingStock.price !== 0 && Math.abs(existingStock.price - newCurrentPrice) / existingStock.price > PRICE_FLASH_THRESHOLD));

              newDataMap.set(update.ticker, {
                ...existingStock, // Retain any other properties from the existing stock
                ...update, // Apply new properties from the incoming update (e.g., price, volume, multiplier, timestamp)
                prev_price: existingStock?.prev_price ?? update.prev_price, // Ensure prev_price stays fixed from Redis source
                price: newCurrentPrice, // Always update the current price from WebSocket
                delta: calculatedDelta, // Calculate and set the delta based on fixed prev_price
      
              });

              // Trigger flash effect if delta changed significantly or it's a new stock
                if (deltaChanged || (existingStock === undefined)) {
                  // Clear any existing timer for this ticker to prevent re-triggering
                  if (flashTimers.current.has(update.ticker)) {
                    clearTimeout(flashTimers.current.get(update.ticker));
                  }
                  setFlashingStates(prev => new Map(prev).set(update.ticker, true));
                  const timer = setTimeout(() => {
                    setFlashingStates(prev => {
                      const newState = new Map(prev);
                      newState.delete(update.ticker); // Remove from map to stop flashing
                      return newState;
                    });
                    flashTimers.current.delete(update.ticker); // Clean up timer reference
                  }, 800); // Flash duration (matches CSS animation)
                  flashTimers.current.set(update.ticker, timer);
                }

                // Trigger price flash effect if price changed significantly AND it's not currently flashing
                if (priceChanged && !priceFlashingStates.get(update.ticker)) {
                    const direction = (newCurrentPrice || 0) > (existingStock?.price || 0) ? 'up' : 'down';
                    if (priceFlashTimers.current.has(update.ticker)) {
                        clearTimeout(priceFlashTimers.current.get(update.ticker));
                    }
                    setPriceFlashingStates(prev => new Map(prev).set(update.ticker, direction));
                    const timer = setTimeout(() => {
                        setPriceFlashingStates(prev => {
                            const newState = new Map(prev);
                            newState.delete(update.ticker);
                            return newState;
                        });
                        priceFlashTimers.current.delete(update.ticker);
                    }, 800); // Price flash duration (0.8s for fade)
                    priceFlashTimers.current.set(update.ticker, timer);
                }

            });
            return Array.from(newDataMap.values());
          });

          // Process all stock updates for background candle collection AND visible charts
          stockUpdates.forEach(update => {
            if (update.price != null && update.timestamp) {
              // Convert timestamp to number (Unix timestamp in milliseconds)
              let timestamp: number;
              if (typeof update.timestamp === 'string') {
                timestamp = new Date(update.timestamp).getTime();
              } else if (typeof update.timestamp === 'number') {
                // Already a number, use as-is
                timestamp = update.timestamp;
              } else {
                console.warn("StockTable: Invalid timestamp format:", update.timestamp, typeof update.timestamp);
                return;
              }
              
              // Validate timestamp
              if (isNaN(timestamp)) {
                console.warn("StockTable: Invalid timestamp value:", update.timestamp);
                return;
              }
              
              // ALWAYS collect background candles for ALL tickers (regardless of chart visibility)
              collectBackgroundCandle(update.ticker, timestamp, update.price);
              
              // Update chart via ref if the ticker has an expanded chart
              const chartRef = chartRefs.current.get(update.ticker);
              if (chartRef?.current) {
                try {
                  chartRef.current.updateWithPrice(timestamp, update.price);
                } catch (chartError) {
                  console.error(`📊 Chart Update Error for ${update.ticker}:`, chartError);
                }
              }
              
              // Update modal chart if it exists for this ticker
              const modalChartRef = chartRefs.current.get(`modal_${update.ticker}`);
              if (modalChartRef?.current) {
                try {
                  modalChartRef.current.updateWithPrice(timestamp, update.price);
                } catch (chartError) {
                  console.error(`📊 Modal Chart Update Error for ${update.ticker}:`, chartError);
                }
              }
            } else {
              console.warn("StockTable: Skipping chart update for stock with missing price or timestamp:", update);
            }
          });

        } catch (error) {
          console.error("StockTable: Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        // Implement a reconnect strategy with a delay
        setTimeout(connectWebSocket, 5000); // Try to reconnect after 5 seconds
      };

      ws.onerror = (error) => {
        console.error("StockTable: WebSocket error:", error);
        setConnectionStatus('disconnected');
        ws.close(); // Force close to trigger onclose and reconnect logic
      };
    };

    connectWebSocket(); // Initial connection attempt when wsUrl becomes available


    // Cleanup function: close WebSocket when component unmounts
    return () => {
      if (wsRef.current) {
        // Remove event listeners explicitly
        // Revert these lines to use wsRef.current for consistency and to avoid scope issues
        wsRef.current.removeEventListener('open', wsRef.current.onopen as EventListener);
        // Corrected lines to use wsRef.current
        if (wsRef.current.onmessage) wsRef.current.removeEventListener('message', wsRef.current.onmessage as EventListener);
        if (wsRef.current.onclose) wsRef.current.removeEventListener('close', wsRef.current.onclose as EventListener);
        if (wsRef.current.onerror) wsRef.current.removeEventListener('error', wsRef.current.onerror as EventListener);
        wsRef.current.close();
        wsRef.current = null;
      }
      // Capture current values of refs to prevent stale closure issues
      const currentFlashTimers = flashTimers.current;
      const currentPriceFlashTimers = priceFlashTimers.current;
      const currentMovementTimers = movementTimers.current;
      const currentRecentUpdateTimers = recentUpdateTimers.current;
      
      // Cleanup all timers
      currentFlashTimers.forEach(timerId => clearTimeout(timerId));
      currentFlashTimers.clear();
      currentPriceFlashTimers.forEach(timerId => clearTimeout(timerId));
      currentPriceFlashTimers.clear();
      currentMovementTimers.forEach(timerId => clearTimeout(timerId));
      currentMovementTimers.clear();
      currentRecentUpdateTimers.forEach(timerId => clearTimeout(timerId));
      currentRecentUpdateTimers.clear();
    };
  }, [wsUrl, tickersToSubscribe]); // DEPENDENCY: Re-run this effect when wsUrl or tickersToSubscribe changes

  
  // Re-introduce periodic data fetching from Redis
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/stock-data');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const newData: StockItem[] = await response.json();
        console.log('Redis fetch returned:', newData.length, 'items');
        console.log('First 3 items from Redis:', newData.slice(0, 3));
        console.log('Sample item structure:', Object.keys(newData[0] || {}));

        setConnectionStatus('connected');

        setCurrentData(prevData => {
          const updatedDataMap = new Map(prevData.map(item => [item.ticker, item]));
          const actuallyChangedTickers: string[] = [];

          newData.forEach(newStockFromRedis => {
            const existingStockInState = updatedDataMap.get(newStockFromRedis.ticker);

            if (existingStockInState) {
              // Stock exists in current state:
              // Update all non-derived fields from Redis, EXCEPT 'price'.
              // 'price' is handled by WebSocket.
              const priceForDeltaCalculation = newStockFromRedis.prev_price; // Use prev_price from Redis for delta calc
              const currentLivePrice = existingStockInState.price; // Retain the live price from WebSocket

              const calculatedDelta = calculateDelta(currentLivePrice, priceForDeltaCalculation);
              const deltaChanged = existingStockInState.delta !== calculatedDelta &&
                     (existingStockInState.delta == null || calculatedDelta == null ||
                      Math.abs(existingStockInState.delta - calculatedDelta) > DELTA_FLASH_THRESHOLD);

            // Determine if price has changed significantly to trigger flash
              const priceChanged = existingStockInState.price !== newStockFromRedis.price &&
                     (existingStockInState.price == null || newStockFromRedis.price == null ||
                      (existingStockInState.price !== 0 && Math.abs(existingStockInState.price - newStockFromRedis.price) / existingStockInState.price > PRICE_FLASH_THRESHOLD));

              // Check if any meaningful fields changed
              const meaningfulChange = deltaChanged || priceChanged || 
                     existingStockInState.multiplier !== newStockFromRedis.multiplier ||
                     existingStockInState.volume !== newStockFromRedis.volume ||
                     existingStockInState.prev_price !== newStockFromRedis.prev_price;

              if (meaningfulChange) {
                actuallyChangedTickers.push(newStockFromRedis.ticker);
              }


              updatedDataMap.set(newStockFromRedis.ticker, {
                ...newStockFromRedis, // Spread new data from Redis to update all non-derived fields
                price: currentLivePrice, // IMPORTANT: Retain the live price from existing state
                delta: calculatedDelta, // Recalculate delta using live price and new prev_price from Redis

              });

              // Trigger flash effect if delta changed significantly
              if (deltaChanged) {
                // Clear any existing timer for this ticker to prevent re-triggering
                if (flashTimers.current.has(newStockFromRedis.ticker)) {
                  clearTimeout(flashTimers.current.get(newStockFromRedis.ticker));
                }
                setFlashingStates(prev => new Map(prev).set(newStockFromRedis.ticker, true));
                const timer = setTimeout(() => {
                  setFlashingStates(prev => {
                    const newState = new Map(prev);
                    newState.delete(newStockFromRedis.ticker); // Remove from map to stop flashing
                    return newState;
                  });
                  flashTimers.current.delete(newStockFromRedis.ticker); // Clean up timer reference
                }, 1000); // Flash duration (matches CSS animation)
                flashTimers.current.set(newStockFromRedis.ticker, timer);
              }


              // Trigger price flash effect if price changed significantly AND it's not currently flashing
              if (priceChanged && !priceFlashingStates.get(newStockFromRedis.ticker)) {
                  const direction = (newStockFromRedis.price || 0) > (existingStockInState.price || 0) ? 'up' : 'down';
                  if (priceFlashTimers.current.has(newStockFromRedis.ticker)) {
                      clearTimeout(priceFlashTimers.current.get(newStockFromRedis.ticker));
                  }
                  setPriceFlashingStates(prev => new Map(prev).set(newStockFromRedis.ticker, direction));
                  const timer = setTimeout(() => {
                      setPriceFlashingStates(prev => {
                          const newState = new Map(prev);
                          newState.delete(newStockFromRedis.ticker);
                          return newState;
                      });
                      priceFlashTimers.current.delete(newStockFromRedis.ticker);
                  }, 1000); // Price flash duration
                  priceFlashTimers.current.set(newStockFromRedis.ticker, timer);
              }


            } else {
              // New stock from Redis: Populate all fields, calculate initial delta
              const calculatedDelta = calculateDelta(newStockFromRedis.price, newStockFromRedis.prev_price);

              // New stocks are always considered changed
              actuallyChangedTickers.push(newStockFromRedis.ticker);


              updatedDataMap.set(newStockFromRedis.ticker, {
                ...newStockFromRedis, // Add all properties of the new stock
                delta: calculatedDelta, // Calculate delta for new stock

              });

                  // Trigger flash effect for new stock
                  if (flashTimers.current.has(newStockFromRedis.ticker)) {
                    clearTimeout(flashTimers.current.get(newStockFromRedis.ticker));
                  }
                  setFlashingStates(prev => new Map(prev).set(newStockFromRedis.ticker, true));
                  const timer = setTimeout(() => {
                    setFlashingStates(prev => {
                      const newState = new Map(prev);
                      newState.delete(newStockFromRedis.ticker);
                      return newState;
                    });
                    flashTimers.current.delete(newStockFromRedis.ticker);
                  }, 300); // Flash duration (matches CSS animation)
                  flashTimers.current.set(newStockFromRedis.ticker, timer);

                  // Trigger price flash effect for new stock (only if not already flashing)
                  if (!priceFlashingStates.get(newStockFromRedis.ticker)) {
                      const direction = (newStockFromRedis.price || 0) > (newStockFromRedis.prev_price || 0) ? 'up' : 'down';
                      if (priceFlashTimers.current.has(newStockFromRedis.ticker)) {
                          clearTimeout(priceFlashTimers.current.get(newStockFromRedis.ticker));
                      }
                      setPriceFlashingStates(prev => new Map(prev).set(newStockFromRedis.ticker, direction));
                      const timer = setTimeout(() => {
                          setPriceFlashingStates(prev => {
                              const newState = new Map(prev);
                              newState.delete(newStockFromRedis.ticker);
                              return newState;
                          });
                          priceFlashTimers.current.delete(newStockFromRedis.ticker);
                      }, 800); // Price flash duration
                      priceFlashTimers.current.set(newStockFromRedis.ticker, timer);
                  }

            }
          });

          // Handle alert for newly appearing stocks based on the *filtered* data
          const newFilteredDataForAlert = Array.from(updatedDataMap.values()).filter((stock: StockItem) =>
            stock.multiplier == null || stock.multiplier >= multiplierFilter
          );

          if (isAlertActive && alertSnapshotTickers.length > 0) {
            const newlyAppearingStocks = newFilteredDataForAlert.filter((stock: StockItem) =>
              !alertSnapshotTickers.includes(stock.ticker)
            );
            if (newlyAppearingStocks.length > 0) {
              setNewStocksAlert(newlyAppearingStocks);
              if (synthRef.current) {
                synthRef.current.triggerAttackRelease("C5", "8n");
              }
            }
          }

          // Only track stocks that actually had meaningful changes for position indicators
          if (actuallyChangedTickers.length > 0) {
            setRecentlyUpdatedStocks(prev => {
              const newSet = new Set([...prev, ...actuallyChangedTickers]);
              
              // Clear timers for these stocks and set new ones
              actuallyChangedTickers.forEach(ticker => {
                if (recentUpdateTimers.current.has(ticker)) {
                  clearTimeout(recentUpdateTimers.current.get(ticker));
                }
                
                const timer = setTimeout(() => {
                  setRecentlyUpdatedStocks(currentSet => {
                    const updated = new Set(currentSet);
                    updated.delete(ticker);
                    return updated;
                  });
                  recentUpdateTimers.current.delete(ticker);
                }, 5000); // Track as recently updated for 5 seconds
                
                recentUpdateTimers.current.set(ticker, timer);
              });
              
              return newSet;
            });
          }

          return Array.from(updatedDataMap.values());
        });

      } catch (error) {
        console.error("Failed to fetch stock data from Redis:", error);
        setConnectionStatus('disconnected');
      }
    };

    fetchData(); // Initial fetch on component mount
    const intervalId = setInterval(fetchData, 10000); // Fetch every 10 seconds
    return () => clearInterval(intervalId);
  }, [isAlertActive, alertSnapshotTickers, multiplierFilter]); // Dependencies for Redis fetch



  const toggleAlert = async () => {
    if (!isAlertActive) {
      // When activating, snapshot the currently filtered tickers from filteredData
      // This ensures the snapshot respects the current multiplier and global filters.
      const currentFilteredTickers = filteredData.map(stock => stock.ticker);
      setAlertSnapshotTickers(currentFilteredTickers);
      setNewStocksAlert([]);

      if (typeof window !== 'undefined' && Tone && Tone.context && Tone.context.state !== 'running') {
        await Tone.start();
      }
    } else {
      setAlertSnapshotTickers([]);
      setNewStocksAlert([]);
    }
    setIsAlertActive(prev => !prev);
  };

  const toggleLock = () => {
    setIsLocked(prev => {
      if (!prev) { // If currently unlocked, about to lock
        const currentVisibleTickers = new Set(
          table.getRowModel().rows.slice(0, numStocksToShow).map(row => row.original.ticker)
        );
        setLockedTickers(currentVisibleTickers);

        const newExpandedRows = new Set<string>();
        currentVisibleTickers.forEach(ticker => {
          if (expandedRows.has(ticker)) {
            newExpandedRows.add(ticker);
          }
        });
        setExpandedRows(newExpandedRows);

      } else {
        setLockedTickers(new Set());
      }
      return !prev;
    });
  };


  React.useEffect(() => {
    if (newStocksAlert.length > 0) {
      const timer = setTimeout(() => {
        setNewStocksAlert([]);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [newStocksAlert]);

  const filteredData = React.useMemo(() => {
    if (!currentData) return [];
    let data = currentData;

    // Apply multiplier filter for display
    data = data.filter((stock: StockItem) =>
      stock.multiplier == null || stock.multiplier >= multiplierFilter
    );

    // Apply global search filter
    if (globalFilter) {
      const lowerCaseFilter = globalFilter.toLowerCase();
      data = data.filter((stock: StockItem) =>
        stock.ticker.toLowerCase().includes(lowerCaseFilter) ||
        (stock.prev_price != null && stock.prev_price.toString().includes(lowerCaseFilter)) ||
        (stock.price != null && stock.price.toString().includes(lowerCaseFilter)) ||
        // Check delta using its calculated value
        (stock.delta != null && (stock.delta * 100).toFixed(1).includes(lowerCaseFilter)) ||
        (stock.float != null && formatLargeNumber(stock.float).toLowerCase().includes(lowerCaseFilter)) ||
        (stock.mav10 != null && formatLargeNumber(stock.mav10).toLowerCase().includes(lowerCaseFilter)) ||
        (stock.volume != null && formatLargeNumber(stock.volume).toLowerCase().includes(lowerCaseFilter)) ||
        (stock.multiplier != null && (stock.multiplier).toFixed(1).includes(lowerCaseFilter))
      );
    }
    return data;
  }, [currentData, globalFilter, multiplierFilter]); // Dependencies for filteredData memo


  const tableDisplayData = React.useMemo(() => {
    if (!isLocked) {
      return filteredData; // If unlocked, use the regular filtered data
    } else {
      // If locked, filter currentData to only include the locked tickers
      const lockedStocks: StockItem[] = [];
      lockedTickers.forEach(ticker => {
        const latestData = currentData.find(s => s.ticker === ticker);
        if (latestData) {
          lockedStocks.push(latestData);
        }
      });
      // Important: Re-apply sorting to lockedStocks if desired, or keep the order they were locked in.
      // Since sorting is disabled when locked, the order will be whatever was captured when locked.
      return lockedStocks;
    }
  }, [isLocked, filteredData, lockedTickers, currentData]); // Dependencies for tableDisplayData

  const columns = React.useMemo(() => [
    columnHelper.accessor("ticker", {
      header: () => (
        <div className="flex items-center gap-1">
          <Tag className="w-4 h-4 text-gray-400" />
          <span>Symbol</span>
        </div>
      ),
      cell: (info) => {
        const ticker = info.getValue() as string;
        const movement = positionMovements.get(ticker);
        
        return (
          <div className="flex items-center gap-2">
            <button className="text-gray-400 hover:text-blue-400 transition-colors duration-200">
              {expandedRows.has(info.row.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-1">
              <span className={`font-semibold ${colors.accent} hover:${colors.accentHover} transition-colors duration-200
                                     ${colors.accentBackground} px-0.5 py-0.5 rounded-md inline-block text-center`}>
                {ticker}
              </span>
              {movement && (
                <span className={`text-xs ${movement === 'up' ? 'text-green-400' : 'text-red-400'} movement-indicator`}>
                  {movement === 'up' ? '↑' : '↓'}
                </span>
              )}
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("prev_price", {
      header: () => (
        <div className="flex items-center gap-1">
          <DollarSign className="w-4 h-4 text-gray-400" />
          <span>Prev Price</span>
        </div>
      ),
      cell: (info) => formatCurrency(info.getValue() as number | null),
      enableSorting: !isLocked, // Disable sorting when locked
    }),
    columnHelper.accessor("price", {
      header: () => (
        <div className="flex items-center gap-1">
          <DollarSign className="w-4 h-4 text-gray-400" />
          <span>Price</span>
        </div>
      ),
      cell: (info) => {
        const stockTicker = info.row.original.ticker;
        const flashDirection = priceFlashingStates.get(stockTicker);
        const flashClass = flashDirection ? (flashDirection === 'up' ? 'price-flash-up-effect' : 'price-flash-down-effect') : '';

        return (
          <span className={flashClass}>
            {formatCurrency(info.getValue() as number | null)}
          </span>
        );
      },
      enableSorting: !isLocked, // Disable sorting when locked
    }),
    columnHelper.accessor("delta", {
      header: () => (
        <div className="flex items-center gap-1">
          <Percent className="w-4 h-4 text-gray-400" />
          <span>Delta</span>
        </div>
      ),
      cell: (info) => {
        const val = info.getValue() as number | null;
        if (val == null) return "-";

        let bg = "bg-transparent";

        // Determine background color based on value using theme colors
        // Positive Delta (Green shades - ordered from highest to lowest threshold)
        if (val > 0.15) bg = colors.deltaPositiveBg1; // Very strong positive
        else if (val > 0.10) bg = colors.deltaPositiveBg2;
        else if (val > 0.07) bg = colors.deltaPositiveBg3;
        else if (val > 0.04) bg = colors.deltaPositiveBg4;
        else if (val > 0.02) bg = colors.deltaPositiveBg5;
        else if (val > 0.005) bg = colors.deltaPositiveBg6; // Slight positive

        // Negative Delta (Red shades - ordered from lowest (most negative) to highest threshold)
        else if (val < -0.15) bg = colors.deltaNegativeBg1; // Very strong negative
        else if (val < -0.10) bg = colors.deltaNegativeBg2;
        else if (val < -0.07) bg = colors.deltaNegativeBg3;
        else if (val < -0.04) bg = colors.deltaNegativeBg4;
        else if (val < -0.02) bg = colors.deltaNegativeBg5;
        else if (val < -0.005) bg = colors.deltaNegativeBg6; // Slight negative

        // Determine text color based on theme and background intensity
        let textColor = "text-white";
        
        // Handle neutral values (no background color)
        if (bg === "bg-transparent") {
          textColor = theme === 'light' ? colors.textPrimary : "text-white";
        } else if (theme === 'light') {
          // In light mode, use white text for darker backgrounds (600), dark text for lighter (100-300)
          if ((val > 0.005 && val <= 0.04) || (val < -0.005 && val >= -0.04)) {
            textColor = "text-gray-900"; // Dark text for lighter backgrounds
          } else {
            textColor = "text-white"; // White text for darker backgrounds
          }
        } else {
          // In dark mode, use existing logic: white for most, dark for lightest (400 shades)
          if ((val > 0.005 && val <= 0.02) || (val < -0.005 && val >= -0.02)) {
            textColor = "text-gray-900"; // Dark text for 400 shades
          }
        }

        const stockTicker = info.row.original.ticker; // Get ticker for lookup
        const flashClass = flashingStates.get(stockTicker) ? 'delta-highlight-effect' : '';

        return (
          <span className={`px-2 py-1 rounded-md font-medium ${bg} ${textColor} shadow-sm ${flashClass} `}>
            {(val * 100).toFixed(1)}%
          </span>
        );
      },
      sortingFn: "basic",
      enableSorting: !isLocked, // Disable sorting when locked
    }),
    columnHelper.accessor("float", {
      header: () => (
        <div className="flex items-center gap-1">
          <BarChart2 className="w-4 h-4 text-gray-400" />
          <span>Float</span>
        </div>
      ),
      cell: (info) => formatLargeNumber(info.getValue() as number | null),
      enableSorting: !isLocked, // Disable sorting when locked
    }),
    columnHelper.accessor("mav10", {
      header: () => (
        <div className="flex items-center gap-1">
          <BarChart2 className="w-4 h-4 text-gray-400" />
          <span>MA10 Volume</span>
        </div>
      ),
      cell: (info) => formatLargeNumber(info.getValue() as number | null),
      enableSorting: !isLocked, // Disable sorting when locked
    }),
    columnHelper.accessor("volume", {
      header: () => (
        <div className="flex items-center gap-1">
          <BarChart2 className="w-4 h-4 text-gray-400" />
          <span>Volume</span>
        </div>
      ),
      cell: (info) => formatLargeNumber(info.getValue() as number | null),
      enableSorting: !isLocked, // Disable sorting when locked
    }),
    columnHelper.accessor("multiplier", {
      header: () => (
        <div className="flex items-center gap-1">
          <Activity className="w-4 h-4 text-gray-400" />
          <span>Multiplier</span>
        </div>
      ),
      cell: (info) => {
        const val = info.getValue() as number | null;
        if (val == null) return "-";

        const multiplierValue: number = val;

        let bg = "bg-transparent";
        if (multiplierValue > 1000) bg = colors.multiplierBg1;
        else if (multiplierValue > 300) bg = colors.multiplierBg2;
        else if (multiplierValue > 40) bg = colors.multiplierBg3;
        else if (multiplierValue > 10) bg = colors.multiplierBg4;
        else if (multiplierValue > 7) bg = colors.multiplierBg5;
        else if (multiplierValue > 4) bg = colors.multiplierBg6;

        return (
          <span className={`px-2 py-1 rounded-md font-medium ${bg} ${colors.multiplierText} shadow-sm`}>
            {multiplierValue.toFixed(1)}
          </span>
        );
      },
      sortingFn: "basic",
      enableSorting: !isLocked, // Disable sorting when locked
    }),
  ], [expandedRows, isLocked, flashingStates, priceFlashingStates, positionMovements, toggleRowExpansion]);

  const table = useReactTable<StockItem>({
    data: tableDisplayData, // Use the new tableDisplayData memo
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: isLocked ? () => {} : setSorting, // Disable sorting when locked
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: false,
    getRowId: (stock) => stock.ticker, // Crucial: Use ticker as stable row ID
  });

  // Effect to track position changes in the sorted table
  React.useEffect(() => {
    if (!isLocked && table.getRowModel().rows.length > 0) {
      const currentPositions = new Map<string, number>();
      table.getRowModel().rows.slice(0, numStocksToShow).forEach((row, index) => {
        currentPositions.set(row.original.ticker, index);
      });

      // Compare with previous positions to detect movements
      const movements = new Map<string, 'up' | 'down'>();
      currentPositions.forEach((currentPos, ticker) => {
        const prevPos = previousPositions.get(ticker);
        // Only show movement indicator if:
        // 1. Position actually changed AND
        // 2. This stock recently received data updates (not just moved by others)
        if (prevPos !== undefined && prevPos !== currentPos && recentlyUpdatedStocks.has(ticker)) {
          const movement = currentPos < prevPos ? 'up' : 'down';
          movements.set(ticker, movement);
          
          // Clear existing timer if any
          if (movementTimers.current.has(ticker)) {
            clearTimeout(movementTimers.current.get(ticker));
          }
          
          // Set timer to clear movement indicator after 3 seconds
          const timer = setTimeout(() => {
            setPositionMovements(prev => {
              const newMovements = new Map(prev);
              newMovements.delete(ticker);
              return newMovements;
            });
            movementTimers.current.delete(ticker);
          }, 3000);
          movementTimers.current.set(ticker, timer);
        }
      });

      if (movements.size > 0) {
        setPositionMovements(prev => new Map([...prev, ...movements]));
      }
      
      setPreviousPositions(currentPositions);
    }
  }, [tableDisplayData, sorting, numStocksToShow, isLocked, recentlyUpdatedStocks]);

  const getHeaderClasses = React.useCallback((headerId: string) => {
    switch (headerId) {
      case 'prev_price':
      case 'float':
      case 'volume':
        return 'hidden md:table-cell';
      case 'mav10':
        return 'hidden lg:table-cell';
      default:
        return '';
    }
  }, []);

  const getCellClasses = React.useCallback((columnId: string) => {
    switch (columnId) {
      case 'prev_price':
      case 'float':
      case 'volume':
        return 'hidden md:table-cell';
      case 'mav10':
        return 'hidden lg:table-cell';
      default:
        return '';
    }
  }, []);

  // Stable data is no longer needed - ChartManager handles persistence

  // Chart management is now handled by ChartManager

  // Charts are now updated directly via ChartManager in WebSocket handler

  // Handler to open sentiment modal
  const openSentimentModal = React.useCallback((ticker: string) => {
    setSentimentTicker(ticker);
    setSentimentModalOpen(true);
  }, []);

  const closeSentimentModal = React.useCallback(() => {
    setSentimentModalOpen(false);
    setSentimentTicker('');
  }, []);

  // Helper function to get or create a modal chart ref for a ticker
  const getModalChartRef = React.useCallback((ticker: string): React.RefObject<ManagedChartHandle | null> => {
    const modalKey = `modal_${ticker}`;
    if (!chartRefs.current.has(modalKey)) {
      const newRef = React.createRef<ManagedChartHandle | null>();
      chartRefs.current.set(modalKey, newRef);
    }
    return chartRefs.current.get(modalKey)!;
  }, []);

  // Handler to open chart modal
  const openChartModal = React.useCallback((ticker: string) => {
    const stockData = currentData.find(item => item.ticker === ticker);
    if (stockData) {
      const historicalCandles = getHistoricalCandles(ticker);
      const modalChartRef = getModalChartRef(ticker);
      setChartModalData({ stockData, historicalCandles, chartRef: modalChartRef });
      setChartModalOpen(true);
    }
  }, [currentData, getHistoricalCandles, getModalChartRef]);

  const closeChartModal = React.useCallback(() => {
    setChartModalOpen(false);
    setChartModalData(null);
  }, []);

  // Handler for pattern alerts
  const handlePatternAlert = React.useCallback((alert: PatternAlertData) => {
    const ticker = alert.data.ticker;
    const direction = alert.data.direction;
    
    // Flash the row background
    setPatternFlashingRows(prev => new Map(prev).set(ticker, direction));
    
    // Show alert in expanded row if it's expanded
    if (expandedRows.has(ticker)) {
      setExpandedPatternAlerts(prev => new Map(prev).set(ticker, alert));
      
      // Auto-hide expanded alert after 8 seconds
      setTimeout(() => {
        setExpandedPatternAlerts(prev => {
          const newMap = new Map(prev);
          newMap.delete(ticker);
          return newMap;
        });
      }, 8000);
    }
    
    // Stop row flashing after 10 seconds (same as alert duration)
    setTimeout(() => {
      setPatternFlashingRows(prev => {
        const newMap = new Map(prev);
        newMap.delete(ticker);
        return newMap;
      });
    }, 10000);
  }, [expandedRows]);

  return (
    <div className={`${colors.containerGradient} rounded-lg ${colors.shadowLg} mx-auto max-w-screen-lg relative border ${colors.border}`}>
      <StockTableStyles />
      <TableHeader connectionStatus={connectionStatus} />
      <TableControls
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        showOptionsDrawer={showOptionsDrawer}
        setShowOptionsDrawer={setShowOptionsDrawer}
        isAlertActive={isAlertActive}
        toggleAlert={toggleAlert}
        isLocked={isLocked}
        toggleLock={toggleLock}
        currentTimeET={currentTimeET}
        marketStatus={marketStatus}
      />
      <OptionsDrawer
        showOptionsDrawer={showOptionsDrawer}
        numStocksToShow={numStocksToShow}
        setNumStocksToShow={setNumStocksToShow}
        multiplierFilter={multiplierFilter}
        setMultiplierFilter={setMultiplierFilter}
      />

      {/* Table Container with horizontal overflow */}
      <div className="overflow-x-auto px-0 sm:px-6 pb-6">
        <div className={`w-full text-sm ${colors.textSecondary} font-sans shadow-lg expanded-table`}>
          {/* Header Row */}
          <div className={`${colors.tableHeaderGradient} h-12`}>
            {table.getHeaderGroups().map((headerGroup) => (
              <div key={headerGroup.id} className="flex items-center">
                {headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    className={`px-0.5 py-2 text-left text-xs font-medium uppercase tracking-wider ${colors.textSecondary} ${
                      header.column.getCanSort() ? `cursor-pointer select-none hover:${colors.secondary} transition-colors duration-200` : ""
                    } ${getHeaderClasses(header.id)} flex-1 flex items-center`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span className="text-sm text-blue-400 w-4 inline-block text-center">
                        {header.column.getIsSorted() === "asc" ? <ArrowUp className="w-4 h-4" /> :
                         header.column.getIsSorted() === "desc" ? <ArrowDown className="w-4 h-4" /> : null}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Data Rows Container */}
          <div>
            {/* Slice the rows here to display only the top N */}
            {table.getRowModel().rows.slice(0, numStocksToShow).length === 0 ? (
              <div className={`text-center py-8 ${colors.textMuted}`}>
                <div className="flex flex-col items-center justify-center">
                  <Frown className={`w-12 h-12 mb-4 ${colors.textMuted}`} />
                  <p className={`text-lg font-semibold ${colors.textSecondary}`}>No one but us chickens here.</p>
                  <p className={`text-sm ${colors.textMuted}`}>Try adjusting your filters or search terms.</p>
                </div>
              </div>
            ) : (
              table.getRowModel().rows.slice(0, numStocksToShow).map((row) => {
                const isExpanded = expandedRows.has(row.id);
                const patternFlash = patternFlashingRows.get(row.original.ticker);
                const patternAlert = expandedPatternAlerts.get(row.original.ticker);
                
                return (
                  <React.Fragment key={row.id}>
                    <div
                      title={`First seen: ${formatDateTime(row.original.first_seen)}`}
                      className={`h-14 transition-colors duration-200 cursor-pointer flex items-center relative ${
                        isExpanded 
                          ? `${colors.expandedParentRow} ${colors.tableRowHover} expanded-parent border ${colors.border}` 
                          : `${colors.tableRow} ${colors.tableRowHover} rounded-lg ${colors.shadowSm} border ${colors.border}`
                      } ${
                        patternFlash ? `pattern-flash-${patternFlash}` : ''
                      }`}
                      onClick={() => toggleRowExpansion(row.id)}
                    >
                      {/* Blue border when expanded */}
                      {isExpanded && (
                        <div className={`absolute left-0 top-0 w-1 h-full ${colors.accent.replace('text-', 'bg-')}`}></div>
                      )}
                      {row.getVisibleCells().map((cell, index) => (
                        <div
                          key={cell.id}
                          className={`px-0.5 py-2 flex items-center flex-1 ${getCellClasses(cell.column.id)}`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      ))}
                    </div>
                    {isExpanded && (
                      <div className={`expanded-child p-0 ${colors.expandedRowGradient} border ${colors.border} -mt-1 relative`}>
                        {/* Blue border continuation - offset to connect seamlessly */}
                        <div className={`absolute left-0 -top-1 w-1 ${colors.accent.replace('text-', 'bg-')}`} style={{height: 'calc(100% + 4px)'}}></div>
                        <ExpandedRowContent 
                          stockData={row.original}
                          onOpenSentiment={() => openSentimentModal(row.original.ticker)}
                          onOpenChart={() => openChartModal(row.original.ticker)}
                          patternAlert={patternAlert}
                          chartRef={getChartRef(row.original.ticker)}
                          historicalCandles={getHistoricalCandles(row.original.ticker)}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      </div>

      {newStocksAlert.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-700 text-white p-4 rounded-lg shadow-lg z-50 flex items-center justify-between animate-fade-in-up w-11/12 max-w-md">
          <div>
            <p className="font-bold">New Stocks Detected!</p>
            <p>{newStocksAlert.map(s => s.ticker).join(', ')} meet your filter criteria.</p>
          </div>
          <button onClick={() => setNewStocksAlert([])} className="ml-4 text-white hover:text-gray-200 font-bold text-xl">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Sentiment Modal */}
      <SentimentModal
        isOpen={sentimentModalOpen}
        onClose={closeSentimentModal}
        ticker={sentimentTicker}
      />

      {/* Chart Modal */}
      {chartModalData && (
        <ChartModal
          isOpen={chartModalOpen}
          onClose={closeChartModal}
          stockData={chartModalData.stockData}
          chartType="candlestick"
          historicalCandles={chartModalData.historicalCandles}
          chartRef={chartModalData.chartRef}
        />
      )}

      {/* Pattern Alert Manager */}
      <AlertManager
        wsConnection={wsRef.current}
        onPatternAlert={handlePatternAlert}
      />
    </div>
  );
}

