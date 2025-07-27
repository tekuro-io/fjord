'use client';

import React from 'react';
import { X, Brain } from 'lucide-react';
import Sentiment from './Sentiment';

interface SentimentModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
}

export default function SentimentModal({ isOpen, onClose, ticker }: SentimentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-600 bg-opacity-20 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-800 rounded-lg shadow-xl mx-4 w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-600">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-green-400" />
            <h2 className="text-xl font-semibold text-gray-100">
              AI Analysis for {ticker}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors duration-200 p-1 rounded-md hover:bg-gray-700"
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