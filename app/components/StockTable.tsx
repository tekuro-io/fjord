// app/components/StockTable.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useWebSocket } from '../lib/websocket';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
} from '@tanstack/react-table';
import LiveChart from './LiveChart'; // Ensure this import is correct

// REVISED StockItem: This interface now represents the *full* set of properties
// that a stock item can have in the table's state.
// Properties that only come from WebSocket are marked as optional or nullable.
export interface StockItem {
  ticker: string;
  prev_price: number | null; // From Redis
  price: number | null; // From Redis, updated by WebSocket
  delta: number | null; // From Redis, updated by WebSocket (mapped from change)
  float: number | null; // From Redis
  mav10: number | null; // From Redis
  volume: number | null; // From Redis, updated by WebSocket
  multiplier: number | null; // From Redis, updated by WebSocket (mapped from change_percent)
  timestamp?: string; // From Redis or WebSocket
  first_seen?: string; // From Redis

  // Properties that primarily come from WebSocket, optional for initial Redis load
  open?: number | null;
  high?: number | null;
  low?: number | null;
  change?: number | null; // Raw change from WebSocket
  changePercent?: number | null; // Raw change_percent from WebSocket
  name?: string; // If you want to add a 'name' field, it would be optional
}

// Define the structure of a chart data point (still needed for LiveChart)
export interface ChartDataPoint {
  time: number; // Unix timestamp in milliseconds
  value: number; // Price
}

// Define the structure of the WebSocket payload for stock data (THIS IS WHAT HERMES SENDS)
// This should accurately reflect the data coming from your Hermes server.
interface StockDataPayload {
  ticker: string;
  timestamp: number; // In milliseconds, as sent by Python producer
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  change: number; // Absolute change
  change_percent: number; // Percentage change
}

// Define an interface for the informational message type
interface InfoMessage {
  type: string;
  message: string;
}

// Define a union type for all expected WebSocket messages
type WebSocketMessage = StockDataPayload | InfoMessage;

const HISTORY_WINDOW_SIZE = 200;

// Define props interface for StockTable
interface StockTableProps {
  data: StockItem[]; // The initial data passed from StockTableLoader
}

export function StockTable({ data: initialTableData }: StockTableProps) {
  // Initialize 'data' state with the initialTableData from Redis
  const [data, setData] = useState<StockItem[]>(initialTableData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [stockChartHistory, setStockChartHistory] = useState<Map<string, ChartDataPoint[]>>(new Map());

  const getErrorMessage = (err: string | Error | null): string => {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    return 'An unknown error occurred';
  };

  // Set loading to false after initial data is processed or after a timeout
  useEffect(() => {
    if (initialTableData.length > 0) {
      setLoading(false);
    } else {
      const timer = setTimeout(() => {
        if (loading) {
          setLoading(false);
          console.log("StockTable: Initial data empty, setting loading to false after timeout.");
        }
      }, 3000); // Wait 3 seconds before assuming no initial data will come

      return () => clearTimeout(timer);
    }
  }, [initialTableData]);

  useEffect(() => {
    const fetchWsUrl = async () => {
      try {
        const response = await fetch('/api/ws');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setWsUrl(data.websocketUrl);
        console.log('StockTable: Fetched WebSocket URL:', data.websocketUrl);
      } catch (e) {
        console.error('StockTable: Failed to fetch WebSocket URL from API:', e);
        setError('Failed to get WebSocket URL.');
        setLoading(false);
      }
    };
    fetchWsUrl();
  }, []);

  const { isConnected, error: wsError, lastMessage, sendMessage } = useWebSocket<WebSocketMessage>(wsUrl, {
    shouldReconnect: true,
    reconnectInterval: 3000,
  });

  useEffect(() => {
    if (lastMessage) {
      console.log("StockTable: Raw lastMessage received:", lastMessage);

      let parsedData: WebSocketMessage | undefined;
      try {
        if (typeof lastMessage.data === 'string') {
          parsedData = JSON.parse(lastMessage.data);
        } else {
          parsedData = lastMessage.data;
        }
      } catch (e) {
        console.error("StockTable: Error parsing lastMessage.data:", e, "Raw data:", lastMessage.data);
        return;
      }

      console.log("StockTable: Parsed data BEFORE type check:", parsedData);

      const isStockDataPayload = (data: WebSocketMessage): data is StockDataPayload => {
        return typeof data === 'object' && data !== null &&
               'ticker' in data && typeof data.ticker === 'string' && data.ticker.trim() !== '' &&
               'price' in data && typeof data.price === 'number' &&
               'timestamp' in data && typeof data.timestamp === 'number';
      };

      if (parsedData && isStockDataPayload(parsedData)) {
        const stockPayload = parsedData;
        console.log("StockTable: Processed StockDataPayload (PASSED TYPE CHECK):", stockPayload);

        setStockChartHistory(prevHistory => {
            const newHistory = new Map(prevHistory);
            const ticker = stockPayload.ticker.toUpperCase();
            const currentPoints = newHistory.get(ticker) || [];

            const newPoint: ChartDataPoint = {
                time: stockPayload.timestamp,
                value: stockPayload.price,
            };

            const updatedPoints = [...currentPoints, newPoint];
            if (updatedPoints.length > HISTORY_WINDOW_SIZE) {
                newHistory.set(ticker, updatedPoints.slice(updatedPoints.length - HISTORY_WINDOW_SIZE));
            } else {
                newHistory.set(ticker, updatedPoints);
            }
            return newHistory;
        });

        setData(prevData => {
          const existingIndex = prevData.findIndex(
            (item) => item.ticker === stockPayload.ticker
          );

          // Get the current stock item to preserve Redis-only fields
          const currentStock = existingIndex !== -1 ? prevData[existingIndex] : null;

          // Create a new updated StockItem by merging existing data with WebSocket payload
          const updatedStockItem: StockItem = {
            ticker: stockPayload.ticker,
            price: stockPayload.price,
            volume: stockPayload.volume, // Volume comes from WebSocket
            delta: stockPayload.change, // Map WebSocket 'change' to 'delta'
            multiplier: stockPayload.change_percent, // Map WebSocket 'change_percent' to 'multiplier'

            // Preserve Redis-only fields if they exist, otherwise null
            prev_price: currentStock ? currentStock.price : null, // This should be updated by WS if needed
            float: currentStock ? currentStock.float : null,
            mav10: currentStock ? currentStock.mav10 : null,
            first_seen: currentStock ? currentStock.first_seen : new Date().toISOString(), // Or a default

            // Optional fields from WebSocket
            open: stockPayload.open,
            high: stockPayload.high,
            low: stockPayload.low,
            change: stockPayload.change, // Keep raw change
            changePercent: stockPayload.change_percent, // Keep raw change_percent
            timestamp: stockPayload.timestamp.toString(), // Convert timestamp to string
            name: currentStock ? currentStock.name : stockPayload.ticker, // Preserve name or default to ticker
          };

          if (existingIndex !== -1) {
            const newData = [...prevData];
            newData[existingIndex] = updatedStockItem;
            return newData;
          } else {
            return [...prevData, updatedStockItem];
          }
        });
        // setLoading(false); // Removed from here, handled by new useEffect
      } else if (parsedData && (parsedData as InfoMessage).type === 'info') {
        console.log("StockTable: Info message received:", (parsedData as InfoMessage).message);
      } else {
          console.warn("StockTable: Received unrecognized message format or non-stock data, skipping:", parsedData);
      }
    }
  }, [lastMessage]);

  const columns = useMemo<ColumnDef<StockItem>[]>(
    () => [
      {
        accessorKey: 'ticker',
        header: 'Ticker',
        cell: (info) => (
          <span
            className="cursor-pointer font-bold text-blue-400 hover:text-blue-200"
            onClick={() => setExpandedRow(prev => (prev === info.getValue() ? null : info.getValue() as string))}
          >
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: (info) => (info.getValue() as number | null)?.toFixed(2) || "-",
      },
      {
        accessorKey: 'delta', // Mapped from WebSocket 'change' or from Redis
        header: 'Delta',
        cell: (info) => {
          const value = info.getValue() as number | null;
          if (value == null) return "-";
          const colorClass = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
          return <span className={colorClass}>{(value * 100).toFixed(1)}%</span>;
        },
      },
      {
        accessorKey: 'volume', // From Redis, updated by WebSocket
        header: 'Volume',
        cell: (info) => (info.getValue() as number | null)?.toLocaleString() || "-",
      },
      {
        accessorKey: 'multiplier', // Mapped from WebSocket 'change_percent' or from Redis
        header: 'Multiplier',
        cell: (info) => {
          const value = info.getValue() as number | null;
          if (value == null) return "-";
          const colorClass = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
          return <span className={colorClass}>{value.toFixed(2)}</span>;
        },
      },
      // You can add back other columns here if you want to display them,
      // e.g., 'open', 'high', 'low', 'change', 'changePercent', 'name'.
      // Remember to handle their potential null/undefined states.
      {
        accessorKey: 'open',
        header: 'Open',
        cell: (info) => (info.getValue() as number | null)?.toFixed(2) || "-",
      },
      {
        accessorKey: 'high',
        header: 'High',
        cell: (info) => (info.getValue() as number | null)?.toFixed(2) || "-",
      },
      {
        accessorKey: 'low',
        header: 'Low',
        cell: (info) => (info.getValue() as number | null)?.toFixed(2) || "-",
      },
      {
        accessorKey: 'change',
        header: 'Abs Change',
        cell: (info) => (info.getValue() as number | null)?.toFixed(2) || "-",
      },
      {
        accessorKey: 'changePercent',
        header: 'Change %',
        cell: (info) => (info.getValue() as number | null)?.toFixed(2) + '%' || "-",
      },
      {
        accessorKey: 'float',
        header: 'Float',
        cell: (info) => (info.getValue() as number | null)?.toLocaleString() || "-",
      },
      {
        accessorKey: 'mav10',
        header: 'MAV10',
        cell: (info) => (info.getValue() as number | null)?.toLocaleString() || "-",
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  if (loading) {
    return <div className="text-white text-center py-4">Connecting to real-time data...</div>;
  }

  if (wsError || error) {
    const displayError = getErrorMessage(wsError || error);
    return (
      <div className="text-red-500 text-center py-4">
        Error: {displayError}. Please refresh or try again later.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto relative shadow-md sm:rounded-lg bg-gray-800 text-gray-200">
      <table className="w-full text-sm text-left text-gray-400">
        <thead className="text-xs uppercase bg-gray-700 text-gray-400">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className="px-6 py-3 cursor-pointer"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{
                    asc: ' ▲',
                    desc: ' ▼',
                  }[header.column.getIsSorted() as string] ?? null}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <React.Fragment key={row.id}>
              <tr className="bg-gray-800 border-b border-gray-700 hover:bg-gray-900">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
              {expandedRow === row.original.ticker && (
                <tr>
                  <td colSpan={columns.length} className="px-0 py-0">
                    <LiveChart
                      stockData={row.original}
                      initialChartData={stockChartHistory.get(row.original.ticker) || []}
                    />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <nav
        className="flex items-center justify-between p-4"
        aria-label="Table navigation"
      >
        <span className="text-sm font-normal text-gray-500">
          Showing{' '}
          <span className="font-semibold text-white">
            {table.getRowModel().rows.length}
          </span>{' '}
          of{' '}
          <span className="font-semibold text-white">{data.length}</span>
        </span>
        <div className="inline-flex -space-x-px text-sm h-8">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="flex items-center justify-center px-3 h-8 ms-0 leading-tight border rounded-s-lg bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="flex items-center justify-center px-3 h-8 leading-tight border rounded-e-lg bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </nav>
    </div>
  );
}
