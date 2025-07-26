// Import types at the top level
import type { ChartDataPoint, CandleDataPoint } from '../types';

export const DELTA_FLASH_THRESHOLD = 0.005;
export const PRICE_FLASH_THRESHOLD = 0.005;
export const MAX_CHART_HISTORY_POINTS = 100;

export const calculateDelta = (currentPrice: number | null, prevPrice: number | null): number | null => {
  if (currentPrice == null || prevPrice == null) {
    return null;
  }
  if (prevPrice === 0) {
    return 0;
  }
  return (currentPrice - prevPrice) / prevPrice;
};

export const formatCurrency = (val: number | null): string => {
  return val != null ? `$${val.toFixed(2)}` : "-";
};

export const formatDateTime = (isoString?: string): string => {
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
  catch {
    return "Invalid date";
  }
};

export const formatLargeNumber = (val: number | null): string => {
  if (val == null) return "-";
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)} Mil`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)} K`;
  return val.toString();
};

export const aggregateTicksToCandles = (ticks: ChartDataPoint[]): CandleDataPoint[] => {
  if (ticks.length === 0) return [];

  // Group ticks by minute timestamp
  const candleMap = new Map<number, ChartDataPoint[]>();
  
  ticks.forEach(tick => {
    // Round down to the nearest minute (60000ms = 1 minute)
    const minuteTimestamp = Math.floor(tick.time / 60000) * 60000;
    
    if (!candleMap.has(minuteTimestamp)) {
      candleMap.set(minuteTimestamp, []);
    }
    candleMap.get(minuteTimestamp)!.push(tick);
  });

  // Convert grouped ticks to OHLC candles
  const candles: CandleDataPoint[] = [];
  
  for (const [timestamp, ticksInMinute] of candleMap.entries()) {
    if (ticksInMinute.length === 0) continue;
    
    // Sort ticks by time to ensure proper OHLC calculation
    ticksInMinute.sort((a, b) => a.time - b.time);
    
    const open = ticksInMinute[0].value;
    const close = ticksInMinute[ticksInMinute.length - 1].value;
    const high = Math.max(...ticksInMinute.map(t => t.value));
    const low = Math.min(...ticksInMinute.map(t => t.value));
    
    candles.push({
      time: timestamp,
      open,
      high,
      low,
      close
    });
  }
  
  // Sort candles by time
  return candles.sort((a, b) => a.time - b.time);
};

export const addTickToCandles = (candles: CandleDataPoint[], newTick: ChartDataPoint): CandleDataPoint[] => {
  const minuteTimestamp = Math.floor(newTick.time / 60000) * 60000;
  const updatedCandles = [...candles];
  
  // Find if we have a candle for this minute
  const existingCandleIndex = updatedCandles.findIndex(candle => candle.time === minuteTimestamp);
  
  if (existingCandleIndex >= 0) {
    // Update existing candle
    const existingCandle = updatedCandles[existingCandleIndex];
    updatedCandles[existingCandleIndex] = {
      ...existingCandle,
      high: Math.max(existingCandle.high, newTick.value),
      low: Math.min(existingCandle.low, newTick.value),
      close: newTick.value // Most recent tick becomes the close
    };
  } else {
    // Create new candle
    const newCandle: CandleDataPoint = {
      time: minuteTimestamp,
      open: newTick.value,
      high: newTick.value,
      low: newTick.value,
      close: newTick.value
    };
    
    // Insert in correct chronological position
    const insertIndex = updatedCandles.findIndex(candle => candle.time > minuteTimestamp);
    if (insertIndex >= 0) {
      updatedCandles.splice(insertIndex, 0, newCandle);
    } else {
      updatedCandles.push(newCandle);
    }
  }
  
  return updatedCandles;
};