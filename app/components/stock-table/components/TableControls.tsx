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

      <div className="flex space-x-2 sm:space-x-4 mb-4 sm:mb-0 w-full sm:w-auto justify-center">
        <button
          onClick={() => setShowOptionsDrawer(!showOptionsDrawer)}
          className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 flex items-center justify-center gap-1 text-sm"
        >
          <span className="hidden md:inline-block">{showOptionsDrawer ? 'Hide Filters' : 'Show Filters'}</span>
          <span className="md:hidden">Filters</span>
          <SlidersHorizontal className={`w-4 h-4 transition-transform duration-300 ${showOptionsDrawer ? 'rotate-90' : ''}`} />
        </button>

        <button
          onClick={toggleAlert}
          className={`px-2 py-1 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 ${
            isAlertActive
              ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
              : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
          } text-white font-semibold focus:ring-opacity-75 flex items-center justify-center gap-1 text-sm`}
        >
          <span className="hidden md:inline-block">{isAlertActive ? 'Deactivate Alert' : 'Activate Alert'}</span>
          <span className="md:hidden">Alert</span>
          {isAlertActive ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        </button>

        <button
          onClick={toggleLock}
          className={`px-2 py-1 rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 ${
            isLocked
              ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
              : 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500'
          } text-white font-semibold focus:ring-opacity-75 flex items-center justify-center gap-1 text-sm`}
        >
          <span className="hidden md:inline-block">{isLocked ? 'Unlock View' : 'Lock View'}</span>
          <span className="md:hidden">{isLocked ? 'Unlock' : 'Lock'}</span>
          {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
        </button>
      </div>

      <MarketStatus currentTimeET={currentTimeET} marketStatus={marketStatus} />
    </div>
  );
};

export default TableControls;