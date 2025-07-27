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
  ChevronRight, ChevronDown, Frown, Brain, TrendingUp, TrendingDown
} from 'lucide-react';

import * as Tone from 'tone';
import ManagedChart from "../ManagedChart";
import SentimentModal from "../SentimentModal";
import AlertManager from "../AlertManager";
import { chartManager } from "../ChartManager";
import type { PatternAlertData } from "../PatternAlert";
import { TableHeader, TableControls, OptionsDrawer, StockTableStyles } from "./components";
import { useMarketStatus } from "./hooks";
import { StockItem, ChartDataPoint, CandleDataPoint, InfoMessage } from "./types";
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
  patternAlert
}: { 
  stockData: StockItem;
  onOpenSentiment: () => void;
  patternAlert?: PatternAlertData;
}) => {
  const isBullish = patternAlert?.data.direction === 'bullish';
  const PatternIcon = patternAlert ? (isBullish ? TrendingUp : TrendingDown) : null;
  
  return (
    <div className="bg-gray-700 p-4">
      {/* Pattern Alert Box */}
      {patternAlert && (
        <div className={`mb-4 p-3 rounded-lg border-2 pattern-alert-flash ${
          isBullish 
            ? 'bg-green-900/30 border-green-500 text-green-100' 
            : 'bg-red-900/30 border-red-500 text-red-100'
        }`}>
          <div className="flex items-center gap-2">
            {PatternIcon && <PatternIcon className={`w-5 h-5 ${isBullish ? 'text-green-400' : 'text-red-400'}`} />}
            <span className="font-semibold">{patternAlert.data.pattern_display_name}</span>
            <span className="text-sm opacity-75">
              ${patternAlert.data.price.toFixed(2)} ({Math.round(patternAlert.data.confidence * 100)}%)
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center">
          <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
          Price Chart for {stockData.ticker}
        </h3>
        <button
          onClick={onOpenSentiment}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors duration-200"
        >
          <Brain className="w-4 h-4" />
          AI Analysis
        </button>
      </div>
      <ManagedChart
        stockData={stockData}
        chartType="candlestick"
      />
    </div>
  );
});

ExpandedRowContent.displayName = 'ExpandedRowContent';


export default function StockTable({ data: initialData }: { data: StockItem[] }) {
  const [currentData, setCurrentData] = React.useState<StockItem[]>(initialData);
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
  // Chart data is now managed by ChartManager, not React state
  const [sentimentModalOpen, setSentimentModalOpen] = React.useState(false);
  const [sentimentTicker, setSentimentTicker] = React.useState<string>('');
  const [patternFlashingRows, setPatternFlashingRows] = React.useState<Map<string, 'bullish' | 'bearish'>>(new Map());
  const [expandedPatternAlerts, setExpandedPatternAlerts] = React.useState<Map<string, PatternAlertData>>(new Map());
  
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

  // Helper function to toggle row expansion
  const toggleRowExpansion = React.useCallback((rowId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
        // Clean up chart when collapsing
        chartManager.destroyChart(rowId);
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

          // Type guard for StockItem
          const isStockItem = (data: unknown): data is StockItem => {
            return typeof data === 'object' && data !== null && 'ticker' in data && typeof (data as StockItem).ticker === 'string' && (data as StockItem).ticker.trim() !== '';
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
          } else if (Array.isArray(parsedData)) {
            // Filter array to ensure all elements are StockItem
            stockUpdates = parsedData.filter(isStockItem);
            if (stockUpdates.length !== parsedData.length) {
                console.warn("StockTable: Some items in the received array were not valid StockItems.");
            }
          } else if (isStockItem(parsedData)) {
            stockUpdates = [parsedData];
          } else {
            console.warn("StockTable: Received unknown or invalid message format, skipping:", parsedData);
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
          setCurrentData(prevData => {
            const newDataMap = new Map(prevData.map(item => [item.ticker, item]));
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

          // Update charts directly via ChartManager (no React state updates!)
          stockUpdates.forEach(update => {
            if (update.price != null && update.timestamp) {
              const timestamp = new Date(update.timestamp).getTime();
              
              // Let ChartManager handle the conversion based on chart type
              chartManager.updateChartWithPrice(update.ticker, timestamp, update.price);
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
        console.log('Redis fetch returned:', newData.length, 'items. Sample item:', newData[0]);

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
              <span className="font-semibold text-blue-400 hover:text-blue-300 transition-colors duration-200
                                     bg-gray-700 px-0.5 py-0.5 rounded-md inline-block text-center">
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

        // Determine background color based on value
        // Positive Delta (Green shades - ordered from highest to lowest threshold)
        if (val > 0.15) bg = "bg-emerald-900"; // Very strong positive
        else if (val > 0.10) bg = "bg-emerald-800";
        else if (val > 0.07) bg = "bg-emerald-700";
        else if (val > 0.04) bg = "bg-emerald-600";
        else if (val > 0.02) bg = "bg-emerald-500";
        else if (val > 0.005) bg = "bg-emerald-400"; // Slight positive

        // Negative Delta (Red shades - ordered from lowest (most negative) to highest threshold)
        else if (val < -0.15) bg = "bg-red-900"; // Very strong negative
        else if (val < -0.10) bg = "bg-red-800";
        else if (val < -0.07) bg = "bg-red-700";
        else if (val < -0.04) bg = "bg-red-600";
        else if (val < -0.02) bg = "bg-red-500";
        else if (val < -0.005) bg = "bg-red-400"; // Slight negative

        // Determine text color based on the chosen background color
        // Default to white, then override for lighter backgrounds
        let textColor = "text-white";
        if ((val > 0.005) || (val < -0.005)) { // Your existing color logic
          textColor = "text-gray-900"; // Darker text for lighter 400 shades
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
        if (multiplierValue > 1000) bg = "bg-teal-900";
        else if (multiplierValue > 300) bg = "bg-teal-800";
        else if (multiplierValue > 40) bg = "bg-teal-700";
        else if (multiplierValue > 10) bg = "bg-teal-600";
        else if (multiplierValue > 7) bg = "bg-teal-500";
        else if (multiplierValue > 4) bg = "bg-teal-400";

        return (
          <span className={`px-2 py-1 rounded-md text-white font-medium ${bg} shadow-sm`}>
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
    <div className="bg-gray-800 rounded-lg shadow-xl mx-auto max-w-screen-lg relative">
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
        <table className="w-full table-auto text-sm text-gray-200 font-sans border-separate border-spacing-y-1 border-spacing-x-0 shadow-lg expanded-table">
          <thead className="bg-gray-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="h-12">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className={`px-0.5 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-300 ${
                      header.column.getCanSort() ? "cursor-pointer select-none hover:bg-gray-600 transition-colors duration-200" : ""
                    } ${getHeaderClasses(header.id)}`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span className="text-sm text-blue-400 w-4 inline-block text-center">
                        {header.column.getIsSorted() === "asc" ? <ArrowUp className="w-4 h-4" /> :
                         header.column.getIsSorted() === "desc" ? <ArrowDown className="w-4 h-4" /> : null}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-gray-800">
            {/* Slice the rows here to display only the top N */}
            {table.getRowModel().rows.slice(0, numStocksToShow).length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-gray-400">
                  <div className="flex flex-col items-center justify-center">
                    <Frown className="w-12 h-12 mb-4 text-gray-500" />
                    <p className="text-lg font-semibold">No one but us chickens here.</p>
                    <p className="text-sm">Try adjusting your filters or search terms.</p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.slice(0, numStocksToShow).map((row) => {
                const isExpanded = expandedRows.has(row.id);
                const patternFlash = patternFlashingRows.get(row.original.ticker);
                const patternAlert = expandedPatternAlerts.get(row.original.ticker);
                
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      title={`First seen: ${formatDateTime(row.original.first_seen)}`}
                      className={`h-14 transition-colors duration-200 cursor-pointer ${
                        isExpanded 
                          ? 'bg-gray-600 hover:bg-gray-500 expanded-parent' 
                          : 'bg-gray-900 hover:bg-gray-700 rounded-lg shadow-md'
                      } ${
                        patternFlash ? `pattern-flash-${patternFlash}` : ''
                      }`}
                      onClick={() => toggleRowExpansion(row.id)}
                    >
                      {row.getVisibleCells().map((cell, index) => (
                        <td
                          key={cell.id}
                          className={`px-0.5 py-2 align-middle relative ${getCellClasses(cell.column.id)}`}
                        >
                          {/* Blue connector line for first cell when expanded */}
                          {index === 0 && isExpanded && (
                            <div className="absolute left-0 top-0 w-1 h-full bg-blue-400"></div>
                          )}
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && (
                      <tr className="expanded-child">
                        <td colSpan={columns.length} className="p-0 bg-gray-700 relative">
                          {/* Blue connector line */}
                          <div className="absolute left-0 top-0 w-1 h-full bg-blue-400"></div>
                          <ExpandedRowContent 
                            stockData={row.original}
                            onOpenSentiment={() => openSentimentModal(row.original.ticker)}
                            patternAlert={patternAlert}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
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

      {/* Pattern Alert Manager */}
      <AlertManager
        wsConnection={wsRef.current}
        onPatternAlert={handlePatternAlert}
      />
    </div>
  );
}

