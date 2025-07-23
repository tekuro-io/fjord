'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const TradingViewWidget = dynamic(() => import('./TradingViewWidget'), {
  ssr: false,
});

const TradingViewWrapper: React.FC = () => {
  return (
    <div className="rounded-lg shadow-lg bg-gray-900 p-1 max-w-3xl mx-auto">
      <TradingViewWidget />
    </div>
  );
};

export default TradingViewWrapper;
