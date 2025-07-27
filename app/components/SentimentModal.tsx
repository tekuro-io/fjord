'use client';

import React from 'react';
import { X, Brain } from 'lucide-react';
import Sentiment from './Sentiment';
import { useTheme } from './ThemeContext';

interface SentimentModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
}

export default function SentimentModal({ isOpen, onClose, ticker }: SentimentModalProps) {
  const { colors } = useTheme();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative ${colors.primary} rounded-lg ${colors.shadowLg} mx-4 w-full max-w-4xl max-h-[90vh] overflow-hidden border ${colors.border}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${colors.divider}`}>
          <div className="flex items-center gap-3">
            <Brain className={`w-6 h-6 ${colors.success}`} />
            <h2 className={`text-xl font-semibold ${colors.textPrimary}`}>
              AI Analysis for {ticker}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`${colors.textMuted} hover:${colors.textPrimary} transition-colors duration-200 p-1 rounded-md hover:${colors.secondary}`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <Sentiment ticker={ticker} />
        </div>
      </div>
    </div>
  );
}