"use client";

import React, { useEffect, useRef, memo } from "react";

const TradingViewWidget: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

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
      colorTheme: "dark",
      locale: "en",
      largeChartUrl: "",
      isTransparent: true,
      showSymbolLogo: false
    });

    containerRef.current.appendChild(script);
  }, []);

  return (
    <div className="tradingview-widget-container" ref={containerRef}>
      <div className="tradingview-widget-container__widget" />
  
    </div>
  );
};

export default memo(TradingViewWidget);
