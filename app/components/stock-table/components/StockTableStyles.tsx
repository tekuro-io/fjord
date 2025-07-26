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
  `, []);

  return <style>{stockTableStyles}</style>;
};

export default StockTableStyles;