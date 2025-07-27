"use client";

import React, { useEffect, useRef, memo } from "react";
import { useTheme } from './ThemeContext';

const TradingViewWidget: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear existing content when theme changes
    containerRef.current.innerHTML = '<div class="tradingview-widget-container__widget" />';

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-tickers.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: "FOREXCOM:SPXUSD", title: "S&P 500 Index" },
        { proName: "NASDAQ:PLTR", title: "Palantir" },
        { proName: "NASDAQ:AVGO", title: "Broadcom" },
        { proName: "TRADENATION:SOLANA", title: "Solana" }
      ],
      colorTheme: theme,
      locale: "en",
      largeChartUrl: "",
      isTransparent: true,
      showSymbolLogo: false
    });

    containerRef.current.appendChild(script);
  }, [theme]);

  return (
    <div className="tradingview-widget-container" ref={containerRef}>
      <div className="tradingview-widget-container__widget" />
      <style jsx>{`
        .tradingview-widget-container {
          ${theme === 'light' ? `
            color: #1e293b !important;
          ` : ''}
        }
        .tradingview-widget-container * {
          ${theme === 'light' ? `
            color: #1e293b !important;
          ` : ''}
        }
        /* Force override TradingView text colors in light mode */
        ${theme === 'light' ? `
          .tradingview-widget-container iframe {
            filter: none !important;
          }
          .tradingview-widget-container [class*="text"] {
            color: #1e293b !important;
          }
          .tradingview-widget-container [class*="ticker"] {
            color: #1e293b !important;
          }
          .tradingview-widget-container [style*="color"] {
            color: #1e293b !important;
          }
        ` : ''}
      `}</style>
    </div>
  );
};

export default memo(TradingViewWidget);
