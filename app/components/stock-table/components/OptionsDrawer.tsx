import React from 'react';

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
  if (!showOptionsDrawer) return null;

  return (
    <div className="mx-6 mb-6 p-4 bg-gray-700 rounded-lg shadow-inner flex flex-col gap-4 transition-all duration-300 ease-in-out">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4">
        <label htmlFor="num-stocks-slider" className="text-gray-300 text-lg font-semibold mb-2 sm:mb-0 sm:mr-4 flex-shrink-0">
          Show Count: <span className="text-blue-400">{numStocksToShow}</span>
        </label>
        <input
          id="num-stocks-slider"
          type="range"
          min="10"
          max="200"
          step="1"
          value={numStocksToShow}
          onChange={(e) => setNumStocksToShow(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between">
        <label htmlFor="multiplier-filter-slider" className="text-gray-300 text-lg font-semibold mb-2 sm:mb-0 sm:mr-4 flex-shrink-0">
          Min Multiplier: <span className="text-blue-400">{multiplierFilter.toFixed(1)}</span>
        </label>
        <input
          id="multiplier-filter-slider"
          type="range"
          min="1.0"
          max="20"
          step="0.1"
          value={multiplierFilter}
          onChange={(e) => setMultiplierFilter(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>
    </div>
  );
};

export default OptionsDrawer;