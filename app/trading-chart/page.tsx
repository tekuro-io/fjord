// app/trading-chart/page.tsx
'use client';

import React from 'react';
import LiveChart from '../components/LiveChart'; // Import the LiveChart component

// Remove all previous dummy data generation and setInterval logic from this file
// as LiveChart component now handles live data and chart updates internally.

const TradingChartPage = () => {
  return (
    <div style={{ padding: '20px', backgroundColor: '#111827', minHeight: '100vh', color: 'white' }}>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />


      {/* Render the LiveChart component for AVGO */}
      {/* The LiveChart component will handle its own WebSocket connection,
          subscription to 'stock:AVGO', and updating the ChartComponent. */}
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
