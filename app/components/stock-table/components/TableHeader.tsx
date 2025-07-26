import React from 'react';
import { BarChart2, WifiOff } from 'lucide-react';

interface TableHeaderProps {
  connectionStatus: 'connected' | 'disconnected';
}

const TableHeader: React.FC<TableHeaderProps> = ({ connectionStatus }) => {
  return (
    <div className="bg-gray-700 py-3 px-6 rounded-t-lg flex items-center justify-between">
      <div className="flex items-center gap-3">
        <BarChart2 className="w-6 h-6 text-blue-400" />
        <h2 className="text-xl font-bold text-white">Momentum Scanner</h2>
      </div>

      <div className="flex items-center text-gray-400 text-sm">
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