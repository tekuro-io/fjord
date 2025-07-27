import React from 'react';
import { BarChart2, WifiOff, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

interface TableHeaderProps {
  connectionStatus: 'connected' | 'disconnected';
}

const TableHeader: React.FC<TableHeaderProps> = ({ connectionStatus }) => {
  const { theme, toggleTheme, colors } = useTheme();
  
  return (
    <div className={`${colors.secondary} py-3 px-6 rounded-t-lg flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <BarChart2 className={`w-6 h-6 ${colors.accent}`} />
        <h2 className={`text-xl font-bold ${colors.textPrimary}`}>Momentum Scanner</h2>
        
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className={`ml-4 p-2 rounded-md ${colors.textMuted} hover:${colors.accent} transition-colors duration-200`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className={`flex items-center ${colors.textMuted} text-sm`}>
        {connectionStatus === 'connected' ? (
          <span className="relative flex h-3 w-3 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
        ) : (
          <span className="relative flex h-3 w-3 mr-2">
            <WifiOff className="w-4 h-4 text-red-500" />
          </span>
        )}
        <span>
          {connectionStatus === 'connected' ? 'Live Data Connected' : 'Connection Lost'}
        </span>
      </div>
    </div>
  );
};

export default TableHeader;