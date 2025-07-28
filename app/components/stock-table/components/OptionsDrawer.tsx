import React from 'react';
import { useTheme } from '../../ThemeContext';

interface OptionsDrawerProps {
  showOptionsDrawer: boolean;
  numStocksToShow: number;
  setNumStocksToShow: (value: number) => void;
  multiplierFilter: number;
  setMultiplierFilter: (value: number) => void;
}

const OptionsDrawer: React.FC<OptionsDrawerProps> = ({
  showOptionsDrawer,
  numStocksToShow,
  setNumStocksToShow,
  multiplierFilter,
  setMultiplierFilter,
}) => {
  const { colors } = useTheme();
  
  if (!showOptionsDrawer) return null;

  return (
    <div className={`mx-6 mb-4 p-3 ${colors.secondary} rounded-lg ${colors.shadowMd} flex flex-col gap-2 transition-all duration-300 ease-in-out border ${colors.border}`}>
      <div className="flex flex-col sm:flex-row items-center justify-between mb-1">
        <label htmlFor="num-stocks-slider" className={`${colors.textSecondary} text-sm font-medium mb-1 sm:mb-0 sm:mr-3 flex-shrink-0`}>
          Show Count: <span className={colors.accent}>{numStocksToShow}</span>
        </label>
        <input
          id="num-stocks-slider"
          type="range"
          min="10"
          max="200"
          step="1"
          value={numStocksToShow}
          onChange={(e) => setNumStocksToShow(parseInt(e.target.value))}
          className={`w-full h-1.5 ${colors.inputBackground} ${colors.inputBorder} rounded-lg appearance-none cursor-pointer accent-blue-500`}
        />
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between">
        <label htmlFor="multiplier-filter-slider" className={`${colors.textSecondary} text-sm font-medium mb-1 sm:mb-0 sm:mr-3 flex-shrink-0`}>
          Min Multiplier: <span className={colors.accent}>{multiplierFilter.toFixed(1)}</span>
        </label>
        <input
          id="multiplier-filter-slider"
          type="range"
          min="1.0"
          max="20"
          step="0.1"
          value={multiplierFilter}
          onChange={(e) => setMultiplierFilter(parseFloat(e.target.value))}
          className={`w-full h-1.5 ${colors.inputBackground} ${colors.inputBorder} rounded-lg appearance-none cursor-pointer accent-blue-500`}
        />
      </div>
    </div>
  );
};

export default OptionsDrawer;