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

// Define the structure of a stock item for the table
export interface StockItem {
  ticker: string;
  name: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  changePercent: number;
}

// Define the structure of a chart data point
export interface ChartDataPoint {
  time: number; // Unix timestamp in milliseconds
  value: number; // Price
}

// Define the structure of the WebSocket payload for stock data
interface StockDataPayload {
  ticker: string;
  timestamp: number; // In milliseconds, as sent by Python producer
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  change_percent: number; // Note: 'change_percent' from backend, 'changePercent' for frontend StockItem
}

// Define an interface for the informational message type
interface InfoMessage {
  type: string;
  message: string;
}

// Define a union type for all expected WebSocket messages
type WebSocketMessage = StockDataPayload | InfoMessage;

// NEW: Define the size of the historical data window for charts
const HISTORY_WINDOW_SIZE = 200; // Keep the last 200 data points for the chart history

export function StockTable() {
  const [data, setData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null); // State to manage expanded row
  // State to store historical chart data for each ticker
  const [stockChartHistory, setStockChartHistory] = useState<Map<string, ChartDataPoint[]>>(new Map());

  // Helper function to safely get an error message
  const getErrorMessage = (err: string | Error | null): string => {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    return 'An unknown error occurred';
  };

  // Fetch WebSocket URL on component mount
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

  // Initialize WebSocket connection using the custom hook
  const { isConnected, error: wsError, lastMessage, sendMessage } = useWebSocket<WebSocketMessage>(wsUrl, {
    shouldReconnect: true,
    reconnectInterval: 3000,
  });

  // Effect to handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      // console.log("StockTable: Raw lastMessage received:", lastMessage); // Keep this for debugging if needed

      let parsedData: WebSocketMessage | undefined;
      try {
        if (typeof lastMessage.data === 'string') {
          parsedData = JSON.parse(lastMessage.data);
        } else {
          parsedData = lastMessage.data;
        }
      } catch (e) {
        console.error("StockTable: Error parsing lastMessage.data:", e, "Raw data:", lastMessage.data);
        // Optionally, return or handle this malformed message more gracefully
        return;
      }

      // Type guard to check if parsedData is a StockDataPayload
      const isStockDataPayload = (data: WebSocketMessage): data is StockDataPayload => {
        return typeof data === 'object' && data !== null &&
               'ticker' in data && typeof data.ticker === 'string' &&
               'price' in data && typeof data.price === 'number';
      };

      if (parsedData && isStockDataPayload(parsedData)) {
        const stockPayload = parsedData;

        // NEW: Update stockChartHistory with sliding window logic
        setStockChartHistory(prevHistory => {
            const newHistory = new Map(prevHistory); // Create a new map to ensure immutability
            const ticker = stockPayload.ticker.toUpperCase();
            const currentPoints = newHistory.get(ticker) || [];

            const newPoint: ChartDataPoint = {
                time: stockPayload.timestamp, // Assuming timestamp is in milliseconds
                value: stockPayload.price,
            };

            // Add the new point
            const updatedPoints = [...currentPoints, newPoint];

            // Trim the array to maintain the sliding window size
            if (updatedPoints.length > HISTORY_WINDOW_SIZE) {
                newHistory.set(ticker, updatedPoints.slice(updatedPoints.length - HISTORY_WINDOW_SIZE));
            } else {
                newHistory.set(ticker, updatedPoints);
            }

            return newHistory;
        });

        // Update main stock data for the table display
        setData(prevData => {
          const existingIndex = prevData.findIndex(
            (item) => item.ticker === stockPayload.ticker
          );

          const updatedStockItem: StockItem = {
            ticker: stockPayload.ticker,
            name: stockPayload.ticker, // Assuming name is same as ticker for now or fetched elsewhere
            price: stockPayload.price,
            open: stockPayload.open,
            high: stockPayload.high,
            low: stockPayload.low,
            volume: stockPayload.volume,
            change: stockPayload.change,
            changePercent: stockPayload.change_percent, // Use change_percent from backend
          };

          if (existingIndex !== -1) {
            // Update existing item
            const newData = [...prevData];
            newData[existingIndex] = updatedStockItem;
            return newData;
          } else {
            // Add new item (initial load of a new ticker)
            return [...prevData, updatedStockItem];
          }
        });
        setLoading(false); // Data is coming in, so stop loading state
      } else if (parsedData && (parsedData as InfoMessage).type === 'info') {
        // Handle info messages if necessary
        console.log("StockTable: Info message received:", (parsedData as InfoMessage).message);
      } else {
          console.warn("StockTable: Received unrecognized message format:", parsedData);
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
        accessorKey: 'name',
        header: 'Name',
        cell: (info) => info.getValue(),
      },
      {
        accessorKey: 'price',
        header: 'Price',
        cell: (info) => (info.getValue() as number).toFixed(2),
      },
      {
        accessorKey: 'change',
        header: 'Change',
        cell: (info) => {
          const value = info.getValue() as number;
          const colorClass = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
          return <span className={colorClass}>{value.toFixed(2)}</span>;
        },
      },
      {
        accessorKey: 'changePercent',
        header: 'Change %',
        cell: (info) => {
          const value = info.getValue() as number;
          const colorClass = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
          return <span className={colorClass}>{value.toFixed(2)}%</span>;
        },
      },
      {
        accessorKey: 'volume',
        header: 'Volume',
        cell: (info) => (info.getValue() as number).toLocaleString(),
      },
      {
        accessorKey: 'open',
        header: 'Open',
        cell: (info) => (info.getValue() as number).toFixed(2),
      },
      {
        accessorKey: 'high',
        header: 'High',
        cell: (info) => (info.getValue() as number).toFixed(2),
      },
      {
        accessorKey: 'low',
        cell: (info) => (info.getValue() as number).toFixed(2),
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
    // FIXED: Use the getErrorMessage helper function
    return (
      <div className="text-red-500 text-center py-4">
        Error: {getErrorMessage(wsError || error)}. Please refresh or try again later.
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
