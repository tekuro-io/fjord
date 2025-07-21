// app/trading-chart/page.tsx
'use client';

import React from 'react';
import LiveChart from '../components/LiveChart'; 

const TradingChartPage = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#111827', minHeight: '100vh', color: 'white' }}>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />





      <div style={{ maxWidth: '900px', margin: '0 auto', border: '0px solid #4B5563', borderRadius: '8px', overflow: 'hidden' }}>
        <LiveChart defaultTicker="AVGO" />
      </div>

      {/* You can add more LiveChart instances here for other tickers if needed */}
      {/* <div style={{ maxWidth: '900px', margin: '20px auto', border: '1px solid #4B5563', borderRadius: '8px', overflow: 'hidden' }}>
        <LiveChart defaultTicker="MSFT" />
      </div> */}

    </div>
  );
};

export default TradingChartPage;
