'use client'; // This must be the very first line for client components

import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import {
  SlidersHorizontal, Bell, BellRing, ArrowUp, ArrowDown, X,
  Tag, DollarSign, Percent, BarChart2, Activity, WifiOff, Search, Clock,
  ChevronRight, ChevronDown, Frown, Lock, Unlock // Imported Lock and Unlock icons
} from 'lucide-react';

import * as Tone from 'tone';
import LiveChart from "./LiveChart"; // Changed import from ChartComponent to LiveChart

// Define the interface for your stock data structure
export interface StockItem {
  ticker: string;
  prev_price: number | null;
  price: number | null;
  delta: number | null; // This will now be recalculated on the client
  float: number | null;
  mav10: number | null;
  volume: number | null;
  multiplier: number | null;
  timestamp?: string;
  first_seen?: string;
  priceFlashDirection?: 'up' | 'down'; // New: To indicate price flash direction
}

// Define a type for historical chart data points (Exported for LiveChart to use)
export interface ChartDataPoint {
  time: number; // Unix timestamp (milliseconds)
  value: number; // Price value
}

// Define an interface for the informational message type
interface InfoMessage {
  type: string; // Can be 'info', 'ack_subscribe', or other control types
  message: string;
  topic?: string; // Optional, for ack_subscribe
}

const columnHelper = createColumnHelper<StockItem>();

const DELTA_FLASH_THRESHOLD = 0.005; // Only flash if delta changes by more than this (0.5%)
const PRICE_FLASH_THRESHOLD = 0.005; // Only flash price if it changes by more than 0.5%

// Max data points to keep in the sliding window for each stock's chart history
const MAX_CHART_HISTORY_POINTS = 100; // Keep last 100 data points for live charts

// Helper function to calculate delta consistently
const calculateDelta = (currentPrice: number | null, prevPrice: number | null): number | null => {
  if (currentPrice == null || prevPrice == null) {
    return null; // Cannot calculate if either price is missing
  }
  if (prevPrice === 0) {
    // If previous price was 0, and current price is not null, delta is effectively infinite.
    // Return 0 for display, as a percentage change from 0 is not well-defined for display.
    return 0;
  }
  return (currentPrice - prevPrice) / prevPrice;
};


export default function StockTable({ data: initialData }: { data: StockItem[] }) {
  const [currentData, setCurrentData] = React.useState<StockItem[]>(initialData);
  const [sorting, setSorting] = React.useState([
    { id: "delta", desc: true }, // Primary sort: delta descending
    { id: "multiplier", desc: true }, // Secondary sort: multiplier descending
  ]);
  const [numStocksToShow, setNumStocksToShow] = React.useState(20); // Renamed and initialized for "Top N"
  const [multiplierFilter, setMultiplierFilter] = React.useState(4.5); // Re-added multiplier filter state, default 1.0
  const [showOptionsDrawer, setShowOptionsDrawer] = React.useState(false);

  const [isAlertActive, setIsAlertActive] = React.useState(false);
  const [alertSnapshotTickers, setAlertSnapshotTickers] = React.useState<string[]>([]);
  const [newStocksAlert, setNewStocksAlert] = React.useState<StockItem[]>([]);

  const [globalFilter, setGlobalFilter] = React.useState('');

  const [currentTimeET, setCurrentTimeET, ] = React.useState('');
  const [marketStatus, setMarketStatus] = React.useState('');

  const [connectionStatus, setConnectionStatus] = React.useState('connected');

  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  // New state for lock functionality
  const [isLocked, setIsLocked] = React.useState(false);
  const [lockedTickers, setLockedTickers] = React.useState<Set<string>>(new Set()); // Stores tickers to display when locked

  // New state for managing flash effect independently
  const [flashingStates, setFlashingStates] = React.useState<Map<string, boolean>>(new Map());
  const flashTimers = React.useRef<Map<string, NodeJS.Timeout>>(new Map()); // Ref to store timers
   // New state for managing price flash effect independently
  const [priceFlashingStates, setPriceFlashingStates] = React.useState<Map<string, 'up' | 'down'>>(new Map());
  const priceFlashTimers = React.useRef<Map<string, NodeJS.Timeout>>(new Map()); // Ref to store price flash timers

  // New state: Map to store sliding window of chart data for each ticker
  const [stockChartHistory, setStockChartHistory] = React.useState<Map<string, ChartDataPoint[]>>(new Map());

  const synthRef = React.useRef<Tone.Synth | null>(null);
  const wsRef = React.useRef<WebSocket | null>(null); // New: WebSocket reference
  const [wsUrl, setWsUrl] = React.useState<string | null>(null); // State for WebSocket URL

  // State to hold the list of tickers to subscribe to
  // Initialize directly from initialData prop
  const [tickersToSubscribe, setTickersToSubscribe] = React.useState<string[]>(
    initialData.map(item => item.ticker).filter(Boolean) as string[]
  );

  // Helper function to toggle row expansion
  const toggleRowExpansion = (rowId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const getMarketStatus = () => {
    const now = new Date();
    try {
      const etFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
      const [etHours, etMinutes] = etFormatter.format(now).split(':').map(Number);

      const dayOfWeek = now.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return 'Market Closed';
      }

      const currentMinutesET = etHours * 60 + etMinutes;

      const preMarketOpen = 4 * 60;
      const marketOpen = 9 * 60 + 30;
      const marketClose = 16 * 60;
      const extendedMarketClose = 20 * 60;

      if (currentMinutesET >= marketOpen && currentMinutesET < marketClose) {
        return 'Market Open';
      } else if (currentMinutesET >= preMarketOpen && currentMinutesET < marketOpen) {
        return 'Pre-market';
      } else if (currentMinutesET >= marketClose && currentMinutesET < extendedMarketClose) {
        return 'Extended Hours';
      } else {
        return 'Market Closed';
      }
    } catch (e) {
      console.error("Error determining market status:", e);
      return 'Unknown';
    }
  };

  React.useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      setCurrentTimeET(new Intl.DateTimeFormat('en-US', options).format(now));
      setMarketStatus(getMarketStatus());
    };

    updateClock();
    const intervalId = setInterval(updateClock, 1000);
    return () => clearInterval(intervalId);
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
        console.log('StockTable: Fetched WebSocket URL:', data.websocketUrl);
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
      console.log("StockTable: WebSocket URL or tickers to subscribe not yet available, skipping connection.");
      return; // Wait for wsUrl and tickers to be fetched
    }

    const connectWebSocket = () => {
      // Ensure existing connection is closed before opening a new one
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      console.log(`StockTable: Attempting to connect to WebSocket at: ${wsUrl}`);
      const ws = new WebSocket(wsUrl); // Use the dynamically fetched URL

      wsRef.current = ws; // Store the new WebSocket instance in the ref

      ws.onopen = () => {
        console.log("StockTable: WebSocket connected.");
        setConnectionStatus('connected');
        // Send individual subscription messages for each ticker
        tickersToSubscribe.forEach(ticker => {
          const subscribeMessage = {
            type: "subscribe",
            topic: `stock:${ticker.toUpperCase()}` // Subscribe to individual stock topics
          };
          ws.send(JSON.stringify(subscribeMessage));
          console.log(`StockTable: Sent subscribe message for topic: stock:${ticker.toUpperCase()}`);
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
                console.log(`StockTable: Received acknowledgment for subscription to topic: ${controlMsg.topic} - ${controlMsg.message}`);
            } else {
                console.log(`StockTable: Received control message of type '${controlMsg.type}': ${controlMsg.message}`);
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

          // Update stockChartHistory with new live data points
          setStockChartHistory(prevHistory => {
            const newHistory = new Map(prevHistory);
            stockUpdates.forEach(update => {
              if (update.price != null && update.timestamp) {
                const currentTickerHistory = newHistory.get(update.ticker) || [];
                // Ensure timestamp is in milliseconds for consistency with JS Date.getTime()
                const newPoint: ChartDataPoint = {
                  time: new Date(update.timestamp).getTime(), // Convert ISO string to Unix timestamp in ms
                  value: update.price,
                };
                // Add new point and maintain sliding window size
                const updatedTickerHistory = [...currentTickerHistory, newPoint].slice(-MAX_CHART_HISTORY_POINTS);
                newHistory.set(update.ticker, updatedTickerHistory);
              } else {
                console.warn("StockTable: Skipping chart history update for stock with missing price or timestamp:", update);
              }
            });
            return newHistory;
          });

        } catch (error) {
          console.error("StockTable: Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("StockTable: WebSocket disconnected. Attempting to reconnect...");
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
      // Cleanup all flash timers on component unmount
      flashTimers.current.forEach(timerId => clearTimeout(timerId));
      flashTimers.current.clear();
      priceFlashTimers.current.forEach(timerId => clearTimeout(timerId));
      priceFlashTimers.current.clear();
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

        setConnectionStatus('connected');

        setCurrentData(prevData => {
          const updatedDataMap = new Map(prevData.map(item => [item.ticker, item]));

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

              console.log(`StockTable Debug (Redis Update Existing): Ticker: ${newStockFromRedis.ticker}, Prev Price (from Redis): ${newStockFromRedis.prev_price}, Current Live Price (retained): ${currentLivePrice}, Multiplier (from Redis): ${newStockFromRedis.multiplier}, Calculated Delta: ${calculatedDelta != null ? (calculatedDelta * 100).toFixed(2) + '%' : '-'}`);

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

              console.log(`StockTable Debug (Redis New Stock): Ticker: ${newStockFromRedis.ticker}, Prev Price (from Redis): ${newStockFromRedis.prev_price}, Price (from Redis): ${newStockFromRedis.price}, Multiplier (from Redis): ${newStockFromRedis.multiplier}, Calculated Delta: ${calculatedDelta != null ? (calculatedDelta * 100).toFixed(2) + '%' : '-'}`);

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
            console.log(`StockTable Debug (Alert Check): newFilteredDataForAlert (tickers): [${newFilteredDataForAlert.map(s => s.ticker).join(', ')}]`);
            console.log(`StockTable Debug (Alert Check): newlyAppearingStocks (tickers): [${newlyAppearingStocks.map(s => s.ticker).join(', ')}]`);
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
      console.log(`StockTable Debug (Alert Activation): alertSnapshotTickers set to: [${currentFilteredTickers.join(', ')}]`);
      setNewStocksAlert([]);

      if (typeof window !== 'undefined' && Tone && Tone.context && Tone.context.state !== 'running') {
        await Tone.start();
        console.log('Tone.js audio context started');
      }
    } else {
      setAlertSnapshotTickers([]);
      setNewStocksAlert([]);
      console.log("StockTable Debug (Alert Deactivation): alertSnapshotTickers cleared.");
    }
    setIsAlertActive(prev => !prev);
  };

  // New function to toggle lock state - UNCHANGED from previous working version
  const toggleLock = () => {
    setIsLocked(prev => {
      if (!prev) { // If currently unlocked, about to lock
        // Capture the tickers of the currently displayed rows (after filters and top N)
        const currentVisibleTickers = new Set(
          table.getRowModel().rows.slice(0, numStocksToShow).map(row => row.original.ticker)
        );
        setLockedTickers(currentVisibleTickers);
        console.log(`StockTable Debug (Lock View): lockedTickers set to: [${Array.from(currentVisibleTickers).join(', ')}]`);

        // Filter expandedRows to only include those present in the new lockedViewData
        const newExpandedRows = new Set<string>();
        currentVisibleTickers.forEach(ticker => {
          if (expandedRows.has(ticker)) {
            newExpandedRows.add(ticker);
          }
        });
        setExpandedRows(newExpandedRows);

      } else { // If currently locked, about to unlock
        setLockedTickers(new Set()); // Clear locked tickers
        console.log("StockTable Debug (Unlock View): lockedTickers cleared.");
        // Expanded rows are intentionally kept, as per previous request
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
      cell: (info) => (
        <div className="flex items-center gap-2">
          {/* Removed onClick from button to make whole row clickable */}
          <button className="text-gray-400 hover:text-blue-400 transition-colors duration-200">
            {/* Check if the current row is in the expandedRows set */}
            {expandedRows.has(info.row.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <span className="font-semibold text-blue-400 hover:text-blue-300 transition-colors duration-200
                                 bg-gray-700 px-0.5 py-0.5 rounded-md inline-block text-center">
            {info.getValue() as string}
          </span>
        </div>
      ),
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
  ], [expandedRows, toggleRowExpansion, isLocked, flashingStates, priceFlashingStates]);

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

  const getHeaderClasses = (headerId: string) => {
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
  };

  const getCellClasses = (columnId: string) => {
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
  };

  return (
    
    <div className="bg-gray-800 rounded-lg shadow-xl mx-auto max-w-screen-lg relative">
      <style>{`
          @keyframes delta-fade-highlight {
            0% { color: inherit; } /* Start with the inherited text color */
            50% { color: #86efac; } /* Fade to a subtle light green (Tailwind's emerald-300/400 range) */
            100% { color: inherit; } /* Fade back to the inherited text color */
          }

          .delta-highlight-effect {
            animation: delta-fade-highlight 1s ease-out; /* 0.8 seconds duration for a smooth fade */
          }

          @keyframes price-flash-up {
            0% { color: inherit; }
            50% { color: #4ade80; } /* Tailwind green-400 */
            100% { color: inherit; }
          }

          @keyframes price-flash-down {
            0% { color: inherit; }
            50% { color: #ef4444; } /* Tailwind red-500 */
            100% { color: inherit; }
          }

          .price-flash-up-effect {
            animation: price-flash-up 1s ease-out;
          }

          .price-flash-down-effect {
            animation: price-flash-down 1s ease-out;
          }
      `}</style>
      <div className="bg-gray-700 py-3 px-6 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-3">

          <BarChart2 className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">Momentum Scanner</h2>
        </div>

        <div className="flex items-center text-gray-400 text-sm">
          {connectionStatus === 'connected' ? (
            <span className="relative flex h-3 w-3 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          ) : (
            <span className="relative flex h-3 w-3 mr-2">
              <WifiOff className="w-4 h-4 text-red-500" />
            </span>
          )}
          <span>
            {connectionStatus === 'connected' ? 'Live Data Connected' : 'Connection Lost'}
          </span>
        </div>
      </div>

      {/* Controls Section (Search, Filters, Alerts, Clock and Market Status) */}
      <div className="p-6 flex flex-col sm:flex-row justify-between items-center pb-4">
        <div className="relative flex items-center w-full sm:w-48 mb-4 sm:mb-0">
          <Search className="absolute left-2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={globalFilter || ''}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full pl-8 pr-2 py-1 bg-gray-900 text-white rounded-md border border-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
          />
        </div>

        <div className="flex space-x-2 sm:space-x-4 mb-4 sm:mb-0 w-full sm:w-auto justify-center">
          <button
            onClick={() => setShowOptionsDrawer(!showOptionsDrawer)}
            className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 flex items-center justify-center gap-1 text-sm"
          >
            <span className="hidden md:inline-block">{showOptionsDrawer ? 'Hide Filters' : 'Show Filters'}</span>
            <span className="md:hidden">Filters</span>
            <SlidersHorizontal className={`w-4 h-4 transition-transform duration-300 ${showOptionsDrawer ? 'rotate-90' : ''}`} />
          </button>

          <button
            onClick={toggleAlert}
            className={`px-2 py-1 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 ${
              isAlertActive
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
            } text-white font-semibold focus:ring-opacity-75 flex items-center justify-center gap-1 text-sm`}
          >
            <span className="hidden md:inline-block">{isAlertActive ? 'Deactivate Alert' : 'Activate Alert'}</span>
            <span className="md:hidden">Alert</span>
            {isAlertActive ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>

          {/* New Lock/Unlock Button - UNCHANGED */}
          <button
            onClick={toggleLock}
            className={`px-2 py-1 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 ${
              isLocked
                ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                : 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
            } text-white font-semibold focus:ring-opacity-75 flex items-center justify-center gap-1 text-sm`}
          >
            <span className="hidden md:inline-block">{isLocked ? 'Unlock View' : 'Lock View'}</span>
            <span className="md:hidden">{isLocked ? 'Unlock' : 'Lock'}</span>
            {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>
        </div>

        {/* Clock and Market Status remain here */}
        <div className="flex flex-col items-center sm:items-end text-center sm:text-right w-full sm:w-auto mt-4 sm:mt-0 space-y-1">
          {/* Clock */}
          <div className="flex items-center">
            <Clock className="w-4 h-4 text-gray-400 mr-2" />
            <span className="text-gray-300 text-sm font-medium">{currentTimeET} ET</span>
          </div>
          {/* Market Status */}
          <span className={`text-xs font-semibold ${
              marketStatus === 'Market Open' ? 'text-green-400' :
              marketStatus === 'Pre-market' || marketStatus === 'Extended Hours' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
            {marketStatus}
          </span>
        </div>
      </div>

      {showOptionsDrawer && (
        <div className="mx-6 mb-6 p-4 bg-gray-700 rounded-lg shadow-inner flex flex-col gap-4 transition-all duration-300 ease-in-out">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-4">
            <label htmlFor="num-stocks-slider" className="text-gray-300 text-lg font-semibold mb-2 sm:mb-0 sm:mr-4 flex-shrink-0">
              Show Count: <span className="text-blue-400">{numStocksToShow}</span>
            </label>
            <input
              id="num-stocks-slider"
              type="range"
              min="10" // Minimum number of stocks to show
              max="200" // Maximum number of stocks to show
              step="1" // Changed step to 1
              value={numStocksToShow}
              onChange={(e) => setNumStocksToShow(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between">
            <label htmlFor="multiplier-filter-slider" className="text-gray-300 text-lg font-semibold mb-2 sm:mb-0 sm:mr-4 flex-shrink-0">
              Min Multiplier: <span className="text-blue-400">{multiplierFilter.toFixed(4.5)}</span>
            </label>
            <input
              id="multiplier-filter-slider"
              type="range"
              min="4.5"
              max="20"
              step="0.1"
              value={multiplierFilter}
              onChange={(e) => setMultiplierFilter(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
      )}

      {/* Table Container with horizontal overflow */}
      <div className="overflow-x-auto px-0 sm:px-6 pb-6">
        <table className="w-full table-auto text-sm text-gray-200 font-sans border-separate border-spacing-y-1 border-spacing-x-0 shadow-lg">
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
              table.getRowModel().rows.slice(0, numStocksToShow).map((row) => (
                <React.Fragment key={row.id}>
                  <tr
                    title={`First seen: ${formatDateTime(row.original.first_seen)}`}
                    className="h-14 hover:bg-gray-700 transition-colors duration-200 bg-gray-900 rounded-lg shadow-md cursor-pointer"
                    onClick={() => toggleRowExpansion(row.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`px-0.5 py-2 align-middle ${getCellClasses(cell.column.id)}`}
                      >
                        {cell.column.id === 'ticker' ? (
                          <div className="flex items-center gap-2">
                            {/* Removed onClick from button as row is now clickable */}
                            <button className="text-gray-400 hover:text-blue-400 transition-colors duration-200">
                              {expandedRows.has(row.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <span className="font-semibold text-blue-400 hover:text-blue-300 transition-colors duration-200
                                                 bg-gray-700 px-0.5 py-0.5 rounded-md inline-block text-center">
                              {cell.getValue() as string}
                            </span>
                          </div>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </td>
                    ))}
                  </tr>
                  {expandedRows.has(row.id) && (
                    <tr>
                      <td colSpan={columns.length} className="p-4 bg-gray-900">
                        <div className="p-2 sm:p-4 bg-gray-700 rounded-lg text-gray-200 text-center">
                          {/* Pass the entire stock object AND its chart history */}
                          <LiveChart
                            stockData={row.original}
                            initialChartData={stockChartHistory.get(row.original.ticker) || []}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
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
    </div>
  );
}

// Utilities
function formatCurrency(val: number | null) {
  return val != null ? `$${val.toFixed(2)}` : "-";
}

function formatDateTime(isoString?: string) {
  if (!isoString) return "Unknown";
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour12: true,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }) + ' ET';
  }
  catch (e) {
    return "Invalid date";
  }
}

function formatLargeNumber(val: number | null) {
  if (val == null) return "-";
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)} Mil`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)} K`;
  return val.toString();
}
