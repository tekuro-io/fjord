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
  first_seen?: string;
  priceFlashDirection?: 'up' | 'down';
}

export interface ChartDataPoint {
  time: number;
  value: number;
}

export interface InfoMessage {
  type: string;
  message: string;
  topic?: string;
}