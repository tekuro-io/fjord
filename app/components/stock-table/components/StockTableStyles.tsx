import React from 'react';

const StockTableStyles: React.FC = () => {
  const stockTableStyles = React.useMemo(() => `
    @keyframes delta-fade-highlight {
      0% { color: inherit; }
      50% { color: #86efac; }
      100% { color: inherit; }
    }

    .delta-highlight-effect {
      animation: delta-fade-highlight 1s ease-out;
    }

    @keyframes price-flash-up {
      0% { color: inherit; }
      50% { color: #4ade80; }
      100% { color: inherit; }
    }

    @keyframes price-flash-down {
      0% { color: inherit; }
      50% { color: #ef4444; }
      100% { color: inherit; }
    }

    .price-flash-up-effect {
      animation: price-flash-up 1s ease-out;
    }

    .price-flash-down-effect {
      animation: price-flash-down 1s ease-out;
    }

    @keyframes movement-bounce {
      0% { transform: scale(1); }
      50% { transform: scale(1.3); }
      100% { transform: scale(1); }
    }

    .movement-indicator {
      animation: movement-bounce 0.6s ease-out;
    }


    /* Div-based rows with controlled spacing */
    .expanded-table > div > div:not(:last-child) {
      margin-bottom: 4px;
    }

    .expanded-table .expanded-parent {
      margin-bottom: 0 !important;
      border-bottom-left-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
    }
    
    .expanded-table .expanded-child {
      margin-top: -4px !important;
      border-top-left-radius: 0 !important;
      border-top-right-radius: 0 !important;
    }

    /* Pattern alert animations */
    @keyframes pattern-flash-bullish {
      0% { background-color: var(--row-bg-color); }
      50% { background-color: var(--pattern-flash-bullish-color); }
      100% { background-color: var(--row-bg-color); }
    }

    @keyframes pattern-flash-bearish {
      0% { background-color: var(--row-bg-color); }
      50% { background-color: var(--pattern-flash-bearish-color); }
      100% { background-color: var(--row-bg-color); }
    }

    .pattern-flash-bullish {
      animation: pattern-flash-bullish 1s ease-in-out 9;
    }

    .pattern-flash-bearish {
      animation: pattern-flash-bearish 1s ease-in-out 9;
    }

    /* Pattern alert box animation */
    @keyframes pattern-alert-flash {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.9; transform: scale(1.02); }
    }

    .pattern-alert-flash {
      animation: pattern-alert-flash 0.8s ease-in-out 4;
    }
  `, []);

  return <style>{stockTableStyles}</style>;
};

export default StockTableStyles;