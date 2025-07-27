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
    /* Ensure blue borders align perfectly between parent and child rows */
    .expanded-table .expanded-parent .blue-border {
      position: absolute;
      left: 1px; /* Move parent 1px right to align with child */
      top: 0;
      width: 4px;
      height: 100%;
    }

    .expanded-table .expanded-child .blue-border {
      position: absolute;
      left: 1px; /* Match parent border position */
      top: 0px; /* Connect seamlessly with parent border */
      width: 4px;
      height: 100%;
    }

    /* Pattern alert animations */
    @keyframes pattern-flash-bullish {
      0% { background-color: rgb(31 41 55); } /* gray-800 */
      50% { background-color: rgba(34, 197, 94, 0.3); } /* green flash */
      100% { background-color: rgb(31 41 55); }
    }

    @keyframes pattern-flash-bearish {
      0% { background-color: rgb(31 41 55); } /* gray-800 */
      50% { background-color: rgba(239, 68, 68, 0.3); } /* red flash */
      100% { background-color: rgb(31 41 55); }
    }

    .pattern-flash-bullish {
      animation: pattern-flash-bullish 1s ease-in-out 3;
    }

    .pattern-flash-bearish {
      animation: pattern-flash-bearish 1s ease-in-out 3;
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