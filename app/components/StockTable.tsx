'use client'; // This directive is crucial for client-side functionality

import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  CellContext, // Imported for potential explicit typing in cell functions if needed
} from "@tanstack/react-table";
import {
  SlidersHorizontal, Bell, BellRing, ArrowUp, ArrowDown, X,
  Tag, DollarSign, Percent, BarChart2, Activity, WifiOff, Search, Clock,
  ChevronRight, ChevronDown
} from 'lucide-react';

import * as Tone from 'tone';


// Define the interface for your stock data structure
interface StockItem {
  ticker: string;
  prev_price: number | null;
  price: number | null;
  delta: number | null;
  float: number | null;
  mav10: number | null;
  volume: number | null;
  multiplier: number | null;
  // Add any other properties that exist in your stock data from the API
  // For example, if your API returns `companyName`, `newsHeadlines`, `sentiment`, `description`
  // although these are currently mocked client-side, if they came from API, they'd be here:
  // companyName?: string;
  // newsHeadlines?: string[];
  // sentiment?: string;
  // description?: string;
}

// Now, use the StockItem interface with createColumnHelper
const columnHelper = createColumnHelper<StockItem>();

const DELTA_THRESHOLD = 0.08;
const MULTIPLIER_THRESHOLD = 4.5;

// Mock company details data with headlines and sentiment (can remain client-side)
// Note: If this data were to come from your API for each stock,
// the StockItem interface would need to include these fields.
const MOCK_COMPANY_DETAILS: { [key: string]: { companyName: string; newsHeadlines: string[]; sentiment: string; description: string; } } = {
  "AAPL": {
    companyName: "Apple Inc.",
    newsHeadlines: [
      "Apple announces new iPhone model with advanced AI features.",
      "Analysts raise price targets for AAPL ahead of earnings.",
      "Apple's services revenue continues strong growth."
    ],
    sentiment: "Positive",
    description: "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide."
  },
  "MSFT": {
    companyName: "Microsoft Corp.",
    newsHeadlines: [
      "Microsoft Azure expands cloud services globally.",
      "New AI partnership boosts MSFT stock.",
      "Microsoft Q3 earnings beat expectations."
    ],
    sentiment: "Very Positive",
    description: "Microsoft Corporation develops, licenses, and supports a range of software products, services and devices."
  },
  "GOOGL": {
    companyName: "Alphabet Inc. (Class A)",
    newsHeadlines: [
      "Google unveils next-gen AI search capabilities.",
      "Alphabet invests heavily in quantum computing research.",
      "Regulatory scrutiny impacts Google's advertising business."
    ],
    sentiment: "Neutral",
    description: "Alphabet Inc. provides search, advertising, cloud computing, and other technology services worldwide."
  },
  "AMZN": {
    companyName: "Amazon.com, Inc.",
    newsHeadlines: [
      "Amazon Prime Day breaks new sales records.",
      "AWS continues to dominate cloud market share.",
      "Amazon faces labor disputes in key regions."
    ],
    sentiment: "Mixed",
    description: "Amazon.com, Inc. engages in the retail sale of consumer products and subscriptions in North America and internationally."
  },
  "TSLA": {
    companyName: "Tesla, Inc.",
    newsHeadlines: [
      "Tesla's new Gigafactory production ramps up.",
      "Cybertruck deliveries begin, generating buzz.",
      "Elon Musk's tweets cause market volatility for TSLA."
    ],
    sentiment: "Volatile",
    description: "Tesla, Inc. designs, develops, manufactures, leases, and sells electric vehicles, and energy generation and storage systems."
  },
  "NVDA": {
    companyName: "NVIDIA Corp.",
    newsHeadlines: [
      "NVIDIA's new GPU line revolutionizes AI processing.",
      "Strong demand for data center chips boosts NVDA.",
      "Supply chain issues could impact NVIDIA's future outlook."
    ],
    sentiment: "Positive",
    description: "NVIDIA Corporation provides graphics, and media and communications processors for the computing, consumer, and automotive industries."
  },
  "FB": {
    companyName: "Meta Platforms, Inc.",
    newsHeadlines: [
      "Meta's metaverse strategy shows early signs of adoption.",
      "Facebook's ad revenue remains strong despite competition.",
      "Privacy concerns continue to challenge Meta Platforms."
    ],
    sentiment: "Neutral",
    description: "Meta Platforms, Inc. develops products that enable people to connect and share through mobile devices, personal computers, virtual reality headsets, and in-home devices."
  },
  "NFLX": {
    companyName: "Netflix, Inc.",
    newsHeadlines: [
      "Netflix adds millions of new subscribers globally.",
      "New content slate excites investors.",
      "Competition in streaming market intensifies for Netflix."
    ],
    sentiment: "Positive",
    description: "Netflix, Inc. provides subscription streaming entertainment service."
  },
  "JPM": {
    companyName: "JPMorgan Chase & Co.",
    newsHeadlines: [
      "JPMorgan reports strong Q4 earnings, beats estimates.",
      "Investment banking division sees robust activity.",
      "Economic slowdown could impact JPM's lending business."
    ],
    sentiment: "Positive",
    description: "JPMorgan Chase & Co. is a financial holding company. It provides financial services."
  },
  "V": {
    companyName: "Visa Inc.",
    newsHeadlines: [
      "Visa's payment volume grows steadily.",
      "New partnerships expand Visa's global reach.",
      "Regulatory changes could affect Visa's transaction fees."
    ],
    sentiment: "Positive",
    description: "Visa Inc. operates as a payments technology company worldwide."
  }
};


export default function StockTable({ data: initialData }: { data: StockItem[] }) {
  const [currentData, setCurrentData] = React.useState<StockItem[]>(initialData); // Explicit type for useState
  const [sorting, setSorting] = React.useState([
    { id: "multiplier", desc: true },
  ]);
  const [multiplierFilter, setMultiplierFilter] = React.useState(MULTIPLIER_THRESHOLD);
  const [showOptionsDrawer, setShowOptionsDrawer] = React.useState(false);

  const [isAlertActive, setIsAlertActive] = React.useState(false);
  const [alertSnapshotTickers, setAlertSnapshotTickers] = React.useState<string[]>([]);
  const [newStocksAlert, setNewStocksAlert] = React.useState<StockItem[]>([]); // Explicit type for newly detected stocks

  const [globalFilter, setGlobalFilter] = React.useState('');

  const [currentTimeET, setCurrentTimeET] = React.useState('');
  const [marketStatus, setMarketStatus] = React.useState('');

  const [connectionStatus, setConnectionStatus] = React.useState('connected');

  const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);

  const synthRef = React.useRef<Tone.Synth | null>(null); // Explicit type for Tone.Synth

  const getMarketStatus = () => {
    const now = new Date();
    try {
      const etHours = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(now);
      const etMinutes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', minute: 'numeric' }).format(now);

      const hours = parseInt(etHours, 10);
      const minutes = parseInt(etMinutes, 10);

      const dayOfWeek = now.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return 'Closed';
      }

      const currentMinutesET = hours * 60 + minutes;

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
      synthRef.current = new Tone.Synth().toDestination();
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
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
        // Cast incoming data to StockItem[]
        const newData: StockItem[] = await response.json();

        setConnectionStatus('connected');

        const newFilteredData = newData.filter((stock: StockItem) =>
          stock.multiplier == null || stock.multiplier >= multiplierFilter
        );

        if (isAlertActive && alertSnapshotTickers.length > 0) {
          const newlyAppearingStocks = newFilteredData.filter((stock: StockItem) =>
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
        (stock.multiplier != null && stock.multiplier.toFixed(1).includes(lowerCaseFilter))
      );
    }

    return data;
  }, [currentData, multiplierFilter, globalFilter]);

  const StockDetailsDisplay = ({ ticker }: { ticker: string }) => {
    const details = MOCK_COMPANY_DETAILS[ticker as keyof typeof MOCK_COMPANY_DETAILS] || {
      companyName: "N/A",
      newsHeadlines: ["No news headlines available."],
      sentiment: "N/A",
      description: "No detailed information available for this ticker."
    };

    return (
      <div className="p-4 bg-gray-700 rounded-lg text-gray-200 flex flex-col md:flex-row md:space-x-4">
        <div className="md:w-1/2 mb-4 md:mb-0">
          <h3 className="text-lg font-bold text-blue-400 mb-2">{details.companyName} ({ticker})</h3>
          <p className="text-sm mb-1"><strong>Sentiment:</strong> <span className="font-semibold">{details.sentiment}</span></p>
          <p className="text-sm text-gray-400 mt-3">{details.description}</p>
        </div>

        <div className="md:w-1/2">
          <h4 className="text-md font-semibold text-gray-300 mb-1">Recent News Headlines:</h4>
          <ul className="list-disc list-inside text-sm text-gray-300 ml-4">
            {details.newsHeadlines.map((headline, index) => (
              <li key={index} className="mb-1">{headline}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const columns = [
    columnHelper.accessor("ticker", {
      header: () => (
        <div className="flex items-center gap-1">
          <Tag className="w-4 h-4 text-gray-400" />
          <span>Symbol</span>
        </div>
      ),
      cell: (info: CellContext<StockItem, string>) => ( // Explicitly type info
        <div className="flex items-center gap-2">
          <button className="text-gray-400 hover:text-blue-400 transition-colors duration-200" onClick={(e) => {
            e.stopPropagation();
            setExpandedRowId(expandedRowId === info.row.id ? null : info.row.id);
          }}>
            {expandedRowId === info.row.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <span className="font-semibold text-blue-400 hover:text-blue-300 transition-colors duration-200
                           bg-gray-700 px-2 py-0.5 rounded-md inline-block min-w-[70px] text-center">
            {info.getValue()}
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
      cell: (info: CellContext<StockItem, number | null>) => formatCurrency(info.getValue()), // Type info
    }),
    columnHelper.accessor("price", {
      header: () => (
        <div className="flex items-center gap-1">
          <DollarSign className="w-4 h-4 text-gray-400" />
          <span>Price</span>
        </div>
      ),
      cell: (info: CellContext<StockItem, number | null>) => formatCurrency(info.getValue()), // Type info
    }),
    columnHelper.accessor("delta", {
      header: () => (
        <div className="flex items-center gap-1">
          <Percent className="w-4 h-4 text-gray-400" />
          <span>Delta</span>
        </div>
      ),
      cell: (info: CellContext<StockItem, number | null>) => { // Type info
        const val = info.getValue(); // val is now inferred as number | null
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
      cell: (info: CellContext<StockItem, number | null>) => formatLargeNumber(info.getValue()), // Type info
    }),
    columnHelper.accessor("mav10", {
      header: () => (
        <div className="flex items-center gap-1">
          <BarChart2 className="w-4 h-4 text-gray-400" />
          <span>MA10 Volume</span>
        </div>
      ),
      cell: (info: CellContext<StockItem, number | null>) => formatLargeNumber(info.getValue()), // Type info
    }),
    columnHelper.accessor("volume", {
      header: () => (
        <div className="flex items-center gap-1">
          <BarChart2 className="w-4 h-4 text-gray-400" />
          <span>Volume</span>
        </div>
      ),
      cell: (info: CellContext<StockItem, number | null>) => formatLargeNumber(info.getValue()), // Type info
    }),
    columnHelper.accessor("multiplier", {
      header: () => (
        <div className="flex items-center gap-1">
          <Activity className="w-4 h-4 text-gray-400" />
          <span>Multiplier</span>
        </div>
      ),
      cell: (info: CellContext<StockItem, number | null>) => { // Type info
        const val = info.getValue(); // val is now inferred as number | null
        if (val == null) return "-";

        let bg = "bg-transparent";
        if (val > 1000) bg = "bg-teal-900";
        else if (val > 300) bg = "bg-teal-800";
        else if (val > 40) bg = "bg-teal-700";
        else if (val > 10) bg = "bg-teal-600";
        else if (val > 5) bg = "bg-teal-500";
        else if (val > MULTIPLIER_THRESHOLD) bg = "bg-teal-400";

        return (
          <span className={`px-2 py-1 rounded-md text-white font-medium ${bg} shadow-sm`}>
            {val.toFixed(1)}
          </span>
        );
      },
      sortingFn: "basic",
    }),
  ];

  const table = useReactTable<StockItem>({ // Use StockItem generic here
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

  // THE MAIN RETURN STATEMENT FOR THE COMPONENT
  return (
    <div className="p-4 overflow-x-auto bg-gray-800 rounded-lg shadow-xl mx-auto max-w-screen-lg relative">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 px-4 pt-4">
        <div className="relative flex items-center w-48 mb-4 sm:mb-0">
          <Search className="absolute left-2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={globalFilter || ''}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full pl-8 pr-2 py-1 bg-gray-900 text-white rounded-md border border-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
          />
        </div>

        <div className="flex space-x-4 mb-4 sm:mb-0">
          <button
            onClick={() => setShowOptionsDrawer(!showOptionsDrawer)}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 flex items-center gap-2"
          >
            {showOptionsDrawer ? 'Hide Filters' : 'Show Filters'}
            <SlidersHorizontal className={`w-5 h-5 transition-transform duration-300 ${showOptionsDrawer ? 'rotate-90' : ''}`} />
          </button>
          <button
            onClick={toggleAlert}
            className={`px-6 py-2 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 ${
              isAlertActive
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
            } text-white font-semibold focus:ring-opacity-75 flex items-center gap-2`}
          >
            {isAlertActive ? 'Deactivate Alert' : 'Activate Alert'}
            {isAlertActive ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex flex-col items-end text-right">
          <div className="flex items-center mb-1">
            <Clock className="w-4 h-4 text-gray-400 mr-2" />
            <span className="text-gray-300 text-sm font-medium">{currentTimeET} ET</span>
          </div>
          <div className="flex items-center">
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
            <span className="text-gray-400 text-sm">
              {connectionStatus === 'connected' ? 'Live Data Connected' : 'Connection Lost'}
            </span>
          </div>
          <span className={`text-xs font-semibold mt-1 ${
              marketStatus === 'Open' ? 'text-green-400' :
              marketStatus === 'Pre-market' || marketStatus === 'Extended Hours' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
            Market: {marketStatus}
          </span>
        </div>
      </div>

      {showOptionsDrawer && (
        <div className="mb-6 p-4 bg-gray-700 rounded-lg shadow-inner flex flex-col gap-4 transition-all duration-300 ease-in-out">
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

      <table className="min-w-full table-fixed text-sm text-gray-200 font-sans border-separate border-spacing-y-1 shadow-lg">
        <thead className="bg-gray-700">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="h-12">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  colSpan={header.colSpan}
                  className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-300 ${
                    header.column.getCanSort() ? "cursor-pointer select-none hover:bg-gray-600 transition-colors duration-200" : ""
                  }`}
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
          {table.getRowModel().rows.map((row) => (
            <React.Fragment key={row.id}>
              <tr
                onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                className="h-14 hover:bg-gray-700 transition-colors duration-200 bg-gray-900 rounded-lg shadow-md cursor-pointer"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 align-middle">
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
                    <StockDetailsDisplay ticker={row.original.ticker} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

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
// Refined to accept number | null to match StockItem properties
function formatCurrency(val: number | null) {
  return val != null ? `$${val.toFixed(2)}` : "-";
}

// Refined to accept number | null to match StockItem properties
function formatLargeNumber(val: number | null) {
  if (val == null) return "-";
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)} Mil`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)} K`;
  return val.toString();
}
