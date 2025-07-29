import React from 'react';
import { Search, SlidersHorizontal, Bell, BellRing, Lock, Unlock, Sun, Moon, BarChart3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import MarketStatus from './MarketStatus';
import { useTheme } from '../../ThemeContext';

interface TableControlsProps {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  showOptionsDrawer: boolean;
  setShowOptionsDrawer: (value: boolean) => void;
  isAlertActive: boolean;
  toggleAlert: () => void;
  isLocked: boolean;
  toggleLock: () => void;
  currentTimeET: string;
  marketStatus: string;
  getTop4Tickers: () => string[]; // Function to get top 4 tickers from sorted table
}

const TableControls: React.FC<TableControlsProps> = ({
  globalFilter,
  setGlobalFilter,
  showOptionsDrawer,
  setShowOptionsDrawer,
  isAlertActive,
  toggleAlert,
  isLocked,
  toggleLock,
  currentTimeET,
  marketStatus,
  getTop4Tickers,
}) => {
  const { theme, toggleTheme, colors } = useTheme();
  const router = useRouter();

  const handleMultiChartTop4 = () => {
    const top4Tickers = getTop4Tickers();
    if (top4Tickers.length > 0) {
      const tickerParam = top4Tickers.join(',');
      router.push(`/multichart?s=2x2&t=${tickerParam}`);
    }
  };
  return (
    <div className="p-6 flex flex-col sm:flex-row justify-between items-center pb-4 gap-4">
      {/* Left side: Primary controls (Search and Filters) */}
      <div className="flex items-center gap-4 flex-1">
        {/* Search bar - Primary function */}
        <div className="relative flex items-center w-full sm:w-64">
          <Search className={`absolute left-2 w-4 h-4 ${colors.textMuted}`} />
          <input
            type="text"
            placeholder="Search stocks..."
            value={globalFilter || ''}
            onChange={e => setGlobalFilter(e.target.value)}
            className={`w-full pl-8 pr-2 py-2 ${colors.inputBackground} ${colors.inputText} ${colors.inputPlaceholder} rounded-md border ${colors.inputBorder} focus:outline-none ${colors.inputFocusBorder} focus:ring-1 focus:ring-blue-500 text-sm`}
          />
        </div>

        {/* Secondary controls - Action buttons */}
        <div className={`flex items-center ${colors.secondary} rounded-lg ${colors.shadowSm} p-1`}>
          <button
            onClick={() => setShowOptionsDrawer(!showOptionsDrawer)}
            className={`p-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center cursor-pointer ${
              showOptionsDrawer
                ? `${colors.accent.replace('text-', 'bg-')} text-white`
                : `${colors.textMuted} hover:${colors.secondary}`
            }`}
            title={showOptionsDrawer ? 'Hide Filters' : 'Show Filters'}
            aria-label={showOptionsDrawer ? 'Hide Filters' : 'Show Filters'}
          >
            <SlidersHorizontal className={`w-4 h-4 transition-transform duration-300 ${showOptionsDrawer ? 'rotate-90' : ''}`} />
          </button>

          <button
            onClick={toggleAlert}
            className={`p-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center cursor-pointer ${
              isAlertActive
                ? 'bg-red-500 text-white'
                : `${colors.textMuted} hover:${colors.secondary}`
            }`}
            title={isAlertActive ? 'Deactivate Alert' : 'Activate Alert'}
            aria-label={isAlertActive ? 'Deactivate Alert' : 'Activate Alert'}
          >
            {isAlertActive ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleLock}
            className={`p-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center cursor-pointer ${
              isLocked
                ? 'bg-blue-500 text-white'
                : `${colors.textMuted} hover:${colors.secondary}`
            }`}
            title={isLocked ? 'Unlock View' : 'Lock View'}
            aria-label={isLocked ? 'Unlock View' : 'Lock View'}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center cursor-pointer ${colors.textMuted} hover:${colors.secondary}`}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Multi-Chart Top 4 Button */}
        <button
          onClick={handleMultiChartTop4}
          className={`ml-3 px-3 py-2 ${colors.buttonPrimary} text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2 text-sm font-medium hover:opacity-90`}
          title="Open top 4 stocks in multi-chart view"
          aria-label="Open top 4 stocks in multi-chart view"
        >
          <BarChart3 className="w-4 h-4" />
          Multi-Chart Top 4
        </button>
      </div>

      {/* Right side: Status information */}
      <MarketStatus currentTimeET={currentTimeET} marketStatus={marketStatus} />
    </div>
  );
};

export default TableControls;