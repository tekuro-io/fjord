'use client';

import React from 'react';
import { Minimize2, Maximize2 } from 'lucide-react';
import ManagedChart, { type ManagedChartHandle } from './ManagedChart';
import { useTheme } from './ThemeContext';
import type { StockItem, CandleDataPoint } from './stock-table/types';

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockData: StockItem;
  chartType?: 'area' | 'candlestick';
  historicalCandles?: CandleDataPoint[];
  chartRef?: React.RefObject<ManagedChartHandle | null>;
}

export default function ChartModal({ 
  isOpen, 
  onClose, 
  stockData, 
  chartType = 'candlestick',
  historicalCandles = [],
  chartRef
}: ChartModalProps) {
  const { colors } = useTheme();
  const modalChartRef = React.useRef<ManagedChartHandle | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative ${colors.primary} rounded-lg ${colors.shadowLg} mx-4 w-full max-w-7xl max-h-[95vh] overflow-hidden border ${colors.border}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${colors.divider}`}>
          <div className="flex items-center gap-3">
            <Maximize2 className={`w-6 h-6 ${colors.accent}`} />
            <h2 className={`text-xl font-semibold ${colors.textPrimary}`}>
              {stockData.ticker} - Price Chart
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`${colors.textMuted} hover:${colors.textPrimary} transition-colors duration-200 p-1 rounded-md hover:${colors.secondary}`}
          >
            <Minimize2 className="w-6 h-6" />
          </button>
        </div>
        
        {/* Chart Content */}
        <div className="p-6">
          <div style={{ height: '800px' }}>
            <ManagedChart
              ref={chartRef || modalChartRef}
              stockData={stockData}
              chartType={chartType}
              historicalCandles={historicalCandles}
              isExpanded={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}