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
  catch (e) {
    return "Invalid date";
  }
};

export const formatLargeNumber = (val: number | null): string => {
  if (val == null) return "-";
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)} Mil`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)} K`;
  return val.toString();
};