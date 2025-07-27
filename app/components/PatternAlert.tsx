'use client';

import React from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';

export interface PatternAlertData {
  topic: string;
  data: {
    ticker: string;
    pattern: string;
    pattern_display_name: string;
    price: number;
    timestamp: string;
    confidence: number;
    alert_level: 'low' | 'medium' | 'high';
    message: string;
    is_bullish: boolean;
    is_bearish: boolean;
    direction: 'bullish' | 'bearish';
    metadata: {
      detection_type: string;
      duration_minutes: number;
      stage: number;
    };
  };
}

interface PatternAlertProps {
  alert: PatternAlertData;
  onDismiss: () => void;
}

export default function PatternAlert({ alert, onDismiss }: PatternAlertProps) {
  const { data } = alert;
  const isBullish = data.direction === 'bullish';
  
  const alertColors = {
    background: isBullish ? 'bg-green-900/90' : 'bg-red-900/90',
    border: isBullish ? 'border-green-500' : 'border-red-500',
    text: isBullish ? 'text-green-100' : 'text-red-100',
    icon: isBullish ? 'text-green-400' : 'text-red-400',
  };

  const IconComponent = isBullish ? TrendingUp : TrendingDown;

  return (
    <div className={`${alertColors.background} ${alertColors.border} border-2 rounded-lg p-4 shadow-lg animate-pulse`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconComponent className={`w-6 h-6 ${alertColors.icon}`} />
          <div>
            <h4 className={`font-semibold ${alertColors.text}`}>
              {data.pattern_display_name}
            </h4>
            <p className={`text-sm ${alertColors.text} opacity-90`}>
              {data.ticker} - ${data.price.toFixed(2)} ({Math.round(data.confidence * 100)}% confidence)
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className={`${alertColors.text} hover:opacity-70 transition-opacity`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}