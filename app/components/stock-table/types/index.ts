export interface StockItem {
  ticker: string;
  prev_price: number | null;
  price: number | null;
  delta: number | null;
  float: number | null;
  mav10: number | null;
  volume: number | null;
  multiplier: number | null;
  timestamp?: string | number;
  first_seen?: string;
  priceFlashDirection?: 'up' | 'down';
}

export interface ChartDataPoint {
  time: number;
  value: number;
}

export interface CandleDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number; // Optional volume data for enhanced charts
}

export interface InfoMessage {
  type: string;
  message: string;
  topic?: string;
}