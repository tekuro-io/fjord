'use client';

import React from 'react';
import { useTheme } from './ThemeContext';

interface ThemeWrapperProps {
  children: React.ReactNode;
}

export const ThemeWrapper: React.FC<ThemeWrapperProps> = ({ children }) => {
  const { colors, theme } = useTheme();
  
  return (
    <main className={`min-h-screen ${colors.gradient} ${colors.textPrimary} p-4 transition-all duration-500`}>
      <style jsx global>{`
        * {
          transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
        }
        
        /* TradingView widget text color fixes for light mode */
        ${theme === 'light' ? `
          .tradingview-widget-container,
          .tradingview-widget-container *,
          .tradingview-widget-container iframe,
          .tradingview-widget-container [class*="text"],
          .tradingview-widget-container [class*="ticker"],
          .tradingview-widget-container [class*="symbol"] {
            color: #1e293b !important;
          }
          
          /* Try to override any inline styles */
          .tradingview-widget-container [style*="color: rgb(120"] {
            color: #1e293b !important;
          }
          
          .tradingview-widget-container [style*="color: rgb(99"] {
            color: #1e293b !important;
          }
          
          .tradingview-widget-container [style*="color: #777"] {
            color: #1e293b !important;
          }
          
          .tradingview-widget-container [style*="color: #999"] {
            color: #1e293b !important;
          }
        ` : ''}
      `}</style>
      {children}
    </main>
  );
};