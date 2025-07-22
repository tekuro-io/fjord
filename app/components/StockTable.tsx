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

// REVERTED: Define the StockItem interface to match what Redis *actually* provides initially
// and what your table originally displayed.
export interface StockItem {
  ticker: string;
  prev_price: number | null;
  price: number | null;
  delta: number | null;
  float: number | null;
  mav10: number | null;
  volume: number | null; // Keep volume as it seems to be in original data
  multiplier: number | null;
  timestamp?: string; // Optional, if Redis provides it
  first_seen?: string; // Optional, if Redis provides it
}

// Define the structure of a chart data point (still needed for LiveChart)
export interface ChartDataPoint {
  time: number; // Unix timestamp in milliseconds
  value: number; // Price
}

// Define the structure of the WebSocket payload for stock data (THIS IS WHAT HERMES SENDS)
interface StockDataPayload {
  ticker: string;
  timestamp: number; // In milliseconds, as sent by Python producer
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  change_percent: number; // Note: 'change_percent' from backend
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
  data: StockItem[]; // The initial data passed from StockTableLoader (now matching the simpler StockItem)
}

export function StockTable({ data: initialTableData }: StockTableProps) {
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

      const isStockDataPayload = (data: WebSocketMessage): data is StockDataPayload => {
        return typeof data === 'object' && data !== null &&
               'ticker' in data && typeof data.ticker === 'string' &&
               'price' in data && typeof data.price === 'number';
      };

      if (parsedData && isStockDataPayload(parsedData)) {
        const stockPayload = parsedData;

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

        // FIXED: Update table data using *only* the fields available in StockItem
        // and add/update other fields from stockPayload as needed for display.
        // This means we might need to extend StockItem or display some fields conditionally.
        setData(prevData => {
          const existingIndex = prevData.findIndex(
            (item) => item.ticker === stockPayload.ticker
          );

          // Create a new StockItem from the incoming payload, mapping fields
          // Note: If 'prev_price', 'delta', 'float', 'mav10', 'multiplier', 'first_seen'
          // are *only* coming from Redis, they will not be updated by WebSocket here.
          // You need to decide how to handle these. For now, we'll try to keep them
          // if they exist, and overwrite with new price/volume from WebSocket.
          const currentStock = existingIndex !== -1 ? prevData[existingIndex] : null;

          const updatedStockItem: StockItem = {
            ticker: stockPayload.ticker,
            price: stockPayload.price,
            volume: stockPayload.volume, // Volume is now coming from WebSocket
            // For other fields, either use the existing value or set to null/default
            prev_price: currentStock ? currentStock.price : null, // Use current price as prev_price for next update
            delta: stockPayload.change, // Map WebSocket 'change' to 'delta'
            multiplier: stockPayload.change_percent, // Map WebSocket 'change_percent' to 'multiplier' (if this is the intended use)
            float: currentStock ? currentStock.float : null, // Preserve if exists, else null
            mav10: currentStock ? currentStock.mav10 : null, // Preserve if exists, else null
            timestamp: stockPayload.timestamp.toString(), // Convert timestamp to string
            first_seen: currentStock ? currentStock.first_seen : new Date().toISOString(), // Preserve or set now
          };


          if (existingIndex !== -1) {
            const newData = [...prevData];
            newData[existingIndex] = updatedStockItem;
            return newData;
          } else {
            return [...prevData, updatedStockItem];
          }
        });
        setLoading(false);
      } else if (parsedData && (parsedData as InfoMessage).type === 'info') {
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
        accessorKey: 'price',
        header: 'Price',
        cell: (info) => (info.getValue() as number | null)?.toFixed(2) || "-", // Handle null
      },
      {
        accessorKey: 'delta', // Now mapped from WebSocket 'change'
        header: 'Delta',
        cell: (info) => {
          const value = info.getValue() as number | null;
          if (value == null) return "-";
          const colorClass = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
          return <span className={colorClass}>{value.toFixed(2)}</span>;
        },
      },
      {
        accessorKey: 'volume', // Now coming from WebSocket
        header: 'Volume',
        cell: (info) => (info.getValue() as number | null)?.toLocaleString() || "-", // Handle null
      },
      {
        accessorKey: 'multiplier', // Now mapped from WebSocket 'change_percent'
        header: 'Multiplier',
        cell: (info) => {
          const value = info.getValue() as number | null;
          if (value == null) return "-";
          const colorClass = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
          return <span className={colorClass}>{value.toFixed(2)}%</span>; // Display as percentage
        },
      },
      // Removed 'name', 'open', 'high', 'low', 'change', 'changePercent' from columns
      // as they were not consistently present in Redis data or original StockItem.
      // If you want to display these, they need to be added back to StockItem
      // and handled in the data update logic.
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
