import React from 'react';
import { Search, SlidersHorizontal, Bell, BellRing, Lock, Unlock } from 'lucide-react';
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
}) => {
  const { colors } = useTheme();
  return (
    <div className="p-6 flex flex-col sm:flex-row justify-between items-center pb-4">
      <div className="relative flex items-center w-full sm:w-48 mb-4 sm:mb-0">
        <Search className={`absolute left-2 w-4 h-4 ${colors.textMuted}`} />
        <input
          type="text"
          placeholder="Search..."
          value={globalFilter || ''}
          onChange={e => setGlobalFilter(e.target.value)}
          className={`w-full pl-8 pr-2 py-1 ${colors.inputBackground} ${colors.inputText} ${colors.inputPlaceholder} rounded-md border ${colors.inputBorder} focus:outline-none ${colors.inputFocusBorder} focus:ring-1 focus:ring-blue-500 text-sm`}
        />
      </div>

      <div className={`flex items-center ${colors.secondary} rounded-lg ${colors.shadowSm} p-1 mb-4 sm:mb-0`}>
        <button
          onClick={() => setShowOptionsDrawer(!showOptionsDrawer)}
          className={`p-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
          className={`p-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
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
          className={`p-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isLocked
              ? 'bg-blue-500 text-white'
              : `${colors.textMuted} hover:${colors.secondary}`
          }`}
          title={isLocked ? 'Unlock View' : 'Lock View'}
          aria-label={isLocked ? 'Unlock View' : 'Lock View'}
        >
          {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
        </button>
      </div>

      <MarketStatus currentTimeET={currentTimeET} marketStatus={marketStatus} />
    </div>
  );
};

export default TableControls;