// src/components/StockTable.tsx
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
  ChevronRight, ChevronDown, Frown
} from 'lucide-react';

import * as Tone from 'tone';
import Sentiment from "./Sentiment";

// Removed: import StockScreenerIcon from '@/components/icons/stock-screener-icon.svg';


// Define the interface for your stock data structure
export interface StockItem {
  ticker: string;
  prev_price: number | null;
  price: number | null;
  delta: number | null;
  float: number | null;
  mav10: number | null;
  volume: number | null;
  multiplier: number | null;
  timestamp?: string;
}

const columnHelper = createColumnHelper<StockItem>();

const DELTA_THRESHOLD = 0.08;
const MULTIPLIER_THRESHOLD = 4.5;

export default function StockTable({ data: initialData }: { data: StockItem[] }) {
  const [currentData, setCurrentData] = React.useState<StockItem[]>(initialData);
  const [sorting, setSorting] = React.useState([
    { id: "multiplier", desc: true },
  ]);
  const [multiplierFilter, setMultiplierFilter] = React.useState(MULTIPLIER_THRESHOLD);
  const [showOptionsDrawer, setShowOptionsDrawer] = React.useState(false);

  const [isAlertActive, setIsAlertActive] = React.useState(false);
  const [alertSnapshotTickers, setAlertSnapshotTickers] = React.useState<string[]>([]);
  const [newStocksAlert, setNewStocksAlert] = React.useState<StockItem[]>([]);

  const [globalFilter, setGlobalFilter] = React.useState('');

  const [currentTimeET, setCurrentTimeET, ] = React.useState('');
  const [marketStatus, setMarketStatus] = React.useState('');

  const [connectionStatus, setConnectionStatus] = React.useState('connected');

  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);

  const synthRef = React.useRef<Tone.Synth | null>(null);

  const getMarketStatus = () => {
    const now = new Date();
    try {
      const etFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
      const [etHours, etMinutes] = etFormatter.format(now).split(':').map(Number);

      const dayOfWeek = now.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return 'Closed';
      }

      const currentMinutesET = etHours * 60 + etMinutes;

      const preMarketOpen = 4 * 60;
      const marketOpen = 9 * 60 + 30;
      const marketClose = 16 * 60;
      const extendedMarketClose = 20 * 60;

      if (currentMinutesET >= marketOpen && currentMinutesET < marketClose) {
        return 'Open';
      } else if (currentMinutesET >= preMarketOpen && currentMinutesET < marketOpen) {
        return 'Pre-market';
      } else if (currentMinutesET >= marketClose && currentMinutesET < extendedMarketClose) {
        return 'Extended Hours';
      } else {
        return 'Closed';
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

  const toggleAlert = async () => {
    if (!isAlertActive) {
      setAlertSnapshotTickers(filteredData.map(stock => stock.ticker));
      setNewStocksAlert([]);

      if (typeof window !== 'undefined' && Tone && Tone.context && Tone.context.state !== 'running') {
        await Tone.start();
        console.log('Tone.js audio context started');
      }
    } else {
      setAlertSnapshotTickers([]);
      setNewStocksAlert([]);
    }
    setIsAlertActive(prev => !prev);
  };

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/stock-data');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const newData: StockItem[] = await response.json();

        setConnectionStatus('connected');

        const newFilteredDataForAlert = newData.filter((stock: StockItem) =>
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
        setCurrentData(newData);
      } catch (error) {
        console.error("Failed to fetch stock data:", error);
        setConnectionStatus('disconnected');
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 10000);
    return () => clearInterval(intervalId);
  }, [isAlertActive, alertSnapshotTickers, multiplierFilter]);

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

    data = data.filter((stock: StockItem) =>
      stock.multiplier == null || stock.multiplier >= multiplierFilter
    );

    if (globalFilter) {
      const lowerCaseFilter = globalFilter.toLowerCase();
      data = data.filter((stock: StockItem) =>
        stock.ticker.toLowerCase().includes(lowerCaseFilter) ||
        (stock.prev_price != null && stock.prev_price.toString().includes(lowerCaseFilter)) ||
        (stock.price != null && stock.price.toString().includes(lowerCaseFilter)) ||
        (stock.delta != null && (stock.delta * 100).toFixed(1).includes(lowerCaseFilter)) ||
        (stock.float != null && formatLargeNumber(stock.float).toLowerCase().includes(lowerCaseFilter)) ||
        (stock.mav10 != null && formatLargeNumber(stock.mav10).toLowerCase().includes(lowerCaseFilter)) ||
        (stock.volume != null && formatLargeNumber(stock.volume).toLowerCase().includes(lowerCaseFilter)) ||
        (stock.multiplier != null && (stock.multiplier).toFixed(1).includes(lowerCaseFilter))
      );
    }

    return data;
  }, [currentData, multiplierFilter, globalFilter]);

  const columns = [
    columnHelper.accessor("ticker", {
      header: () => (
        <div className="flex items-center gap-1">
          <Tag className="w-4 h-4 text-gray-400" />
          <span>Symbol</span>
        </div>
      ),
      cell: (info) => (
        <div className="flex items-center gap-2">
          <button className="text-gray-400 hover:text-blue-400 transition-colors duration-200" onClick={(e) => {
            e.stopPropagation();
            setExpandedRowId(expandedRowId === info.row.id ? null : info.row.id);
          }}>
            {expandedRowId === info.row.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <span className="font-semibold text-blue-400 hover:text-blue-300 transition-colors duration-200
                           bg-gray-700 px-2 py-0.5 rounded-md inline-block min-w-[70px] text-center">
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
    }),
    columnHelper.accessor("price", {
      header: () => (
        <div className="flex items-center gap-1">
          <DollarSign className="w-4 h-4 text-gray-400" />
          <span>Price</span>
        </div>
      ),
      cell: (info) => formatCurrency(info.getValue() as number | null),
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
        if (val > 0.45) bg = "bg-emerald-700";
        else if (val > 0.3) bg = "bg-emerald-600";
        else if (val > 0.15) bg = "bg-emerald-500";
        else if (val > DELTA_THRESHOLD) bg = "bg-emerald-400";
        else if (val < -0.45) bg = "bg-red-700";
        else if (val < -0.3) bg = "bg-red-600";
        else if (val < -0.15) bg = "bg-red-500";
        else if (val < -DELTA_THRESHOLD) bg = "bg-red-400";

        return (
          <span className={`px-2 py-1 rounded-md text-white font-medium ${bg} shadow-sm`}>
            {(val * 100).toFixed(1)}%
          </span>
        );
      },
      sortingFn: "basic",
    }),
    columnHelper.accessor("float", {
      header: () => (
        <div className="flex items-center gap-1">
          <BarChart2 className="w-4 h-4 text-gray-400" />
          <span>Float</span>
        </div>
      ),
      cell: (info) => formatLargeNumber(info.getValue() as number | null),
    }),
    columnHelper.accessor("mav10", {
      header: () => (
        <div className="flex items-center gap-1">
          <BarChart2 className="w-4 h-4 text-gray-400" />
          <span>MA10 Volume</span>
        </div>
      ),
      cell: (info) => formatLargeNumber(info.getValue() as number | null),
    }),
    columnHelper.accessor("volume", {
      header: () => (
        <div className="flex items-center gap-1">
          <BarChart2 className="w-4 h-4 text-gray-400" />
          <span>Volume</span>
        </div>
      ),
      cell: (info) => formatLargeNumber(info.getValue() as number | null),
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
        else if (multiplierValue > 5) bg = "bg-teal-500";
        else if (multiplierValue > MULTIPLIER_THRESHOLD) bg = "bg-teal-400";

        return (
          <span className={`px-2 py-1 rounded-md text-white font-medium ${bg} shadow-sm`}>
            {multiplierValue.toFixed(1)}
          </span>
        );
      },
      sortingFn: "basic",
    }),
  ];

  const table = useReactTable<StockItem>({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: false,
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
      {/* New Title Bar (SVG removed from here as it's in page.tsx) */}
      <div className="bg-gray-700 py-3 px-6 rounded-t-lg flex items-center justify-between"> {/* Changed to justify-between */}
        <div className="flex items-center gap-3"> {/* Left: Title only */}
          <h2 className="text-xl font-bold text-white">Live Stock Screener</h2>
        </div>

        {/* Right: Connection Status */}
        <div className="flex items-center text-gray-400 text-sm"> {/* Added text styling for consistency */}
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
              marketStatus === 'Open' ? 'text-green-400' :
              marketStatus === 'Pre-market' || marketStatus === 'Extended Hours' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
            Market: {marketStatus}
          </span>
        </div>
      </div>

      {showOptionsDrawer && (
        <div className="mx-6 mb-6 p-4 bg-gray-700 rounded-lg shadow-inner flex flex-col gap-4 transition-all duration-300 ease-in-out">
          <div className="flex flex-col sm:flex-row items-center justify-between">
            <label htmlFor="multiplier-slider" className="text-gray-300 text-lg font-semibold mb-2 sm:mb-0 sm:mr-4 flex-shrink-0">
              Filter Multiplier (Min): <span className="text-blue-400">{multiplierFilter.toFixed(1)}</span>
            </label>
            <input
              id="multiplier-slider"
              type="range"
              min="0"
              max="20"
              step="0.5"
              value={multiplierFilter}
              onChange={(e) => setMultiplierFilter(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
      )}

      {/* Table Container with horizontal overflow */}
      <div className="overflow-x-auto px-6 pb-6">
        <table className="w-full table-auto text-sm text-gray-200 font-sans border-separate border-spacing-y-1 shadow-lg">
          <thead className="bg-gray-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="h-12">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-300 ${
                      header.column.getCanSort() ? "cursor-pointer select-none hover:bg-gray-600 transition-colors duration-200" : ""
                    } ${getHeaderClasses(header.id)}`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <span className="text-sm text-gray-400 w-4 inline-block text-center">
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
            {table.getRowModel().rows.length === 0 ? (
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
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <tr
                    onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                    className="h-14 hover:bg-gray-700 transition-colors duration-200 bg-gray-900 rounded-lg shadow-md cursor-pointer"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`px-3 py-2 align-middle ${getCellClasses(cell.column.id)}`}
                      >
                        {cell.column.id === 'ticker' ? (
                          <div className="flex items-center gap-2">
                            <button className="text-gray-400 hover:text-blue-400 transition-colors duration-200" onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRowId(expandedRowId === row.id ? null : row.id);
                            }}>
                              {expandedRowId === row.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <span className="font-semibold text-blue-400 hover:text-blue-300 transition-colors duration-200
                                             bg-gray-700 px-2 py-0.5 rounded-md inline-block min-w-[70px] text-center">
                              {cell.getValue() as string}
                            </span>
                          </div>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </td>
                    ))}
                  </tr>
                  {expandedRowId === row.id && (
                    <tr>
                      <td colSpan={columns.length} className="p-4 bg-gray-900">
                        <div className="p-4 bg-gray-700 rounded-lg text-gray-200 text-center">
                            {/* You can display more details here for the expanded row */}
                            <p><strong>Timestamp:</strong> {row.original.timestamp || 'N/A'}</p>
                            <Sentiment ticker={row.original.ticker} />
                            {/* Add other fields from row.original as needed */}
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

function formatLargeNumber(val: number | null) {
  if (val == null) return "-";
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)} Mil`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)} K`;
  return val.toString();
}
