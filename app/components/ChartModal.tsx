'use client';

import React from 'react';
import { X, Maximize2 } from 'lucide-react';
import ManagedChart, { type ManagedChartHandle } from './ManagedChart';
import { useTheme } from './ThemeContext';
import type { StockItem, CandleDataPoint } from './stock-table/types';

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockData: StockItem;
  chartType?: 'area' | 'candlestick';
  historicalCandles?: CandleDataPoint[];
}

export default function ChartModal({ 
  isOpen, 
  onClose, 
  stockData, 
  chartType = 'candlestick',
  historicalCandles = []
}: ChartModalProps) {
  const { colors } = useTheme();
  const chartRef = React.useRef<ManagedChartHandle | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative ${colors.primary} rounded-lg ${colors.shadowLg} mx-4 w-full max-w-6xl max-h-[90vh] overflow-hidden border ${colors.border}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${colors.divider}`}>
          <div className="flex items-center gap-3">
            <Maximize2 className={`w-6 h-6 ${colors.accent}`} />
            <h2 className={`text-xl font-semibold ${colors.textPrimary}`}>
              {stockData.ticker} - Price Chart
            </h2>
            <span className={`text-sm ${colors.textMuted}`}>
              Current: ${stockData.price?.toFixed(2) || 'N/A'}
            </span>
          </div>
          <button
            onClick={onClose}
            className={`${colors.textMuted} hover:${colors.textPrimary} transition-colors duration-200 p-1 rounded-md hover:${colors.secondary}`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Chart Content */}
        <div className="p-6">
          <div style={{ height: '500px' }}>
            <ManagedChart
              ref={chartRef}
              stockData={stockData}
              chartType={chartType}
              historicalCandles={historicalCandles}
            />
          </div>
        </div>
      </div>
    </div>
  );
}