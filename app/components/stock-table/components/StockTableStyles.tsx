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

    /* Remove spacing for expanded rows */
    .expanded-table .expanded-parent {
      margin-bottom: 0 !important;
    }
    
    .expanded-table .expanded-child {
      margin-top: -4px !important;
      transform: translateY(-5px);
    }
    
    .expanded-table .expanded-child td {
      border-top: none !important;
      padding-top: 0 !important;
    }
    
    /* Override table spacing for connected rows */
    .expanded-table tbody .expanded-parent + .expanded-child {
      --border-spacing-y: 0px;
    }
  `, []);

  return <style>{stockTableStyles}</style>;
};

export default StockTableStyles;