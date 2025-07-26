import React from 'react';
import { Clock } from 'lucide-react';

interface MarketStatusProps {
  currentTimeET: string;
  marketStatus: string;
}

const MarketStatus: React.FC<MarketStatusProps> = ({ currentTimeET, marketStatus }) => {
  return (
    <div className="flex flex-col items-center sm:items-end text-center sm:text-right w-full sm:w-auto mt-4 sm:mt-0 space-y-1">
      <div className="flex items-center">
        <Clock className="w-4 h-4 text-gray-400 mr-2" />
        <span className="text-gray-300 text-sm font-medium">{currentTimeET} ET</span>
      </div>
      <span className={`text-xs font-semibold ${
          marketStatus === 'Market Open' ? 'text-green-400' :
          marketStatus === 'Pre-market' || marketStatus === 'Extended Hours' ? 'text-yellow-400' :
          'text-red-400'
        }`}>
        {marketStatus}
      </span>
    </div>
  );
};

export default MarketStatus;