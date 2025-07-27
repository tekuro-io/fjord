import React from 'react';
import { Clock } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

interface MarketStatusProps {
  currentTimeET: string;
  marketStatus: string;
}

const MarketStatus: React.FC<MarketStatusProps> = ({ currentTimeET, marketStatus }) => {
  const { colors } = useTheme();
  return (
    <div className="flex flex-col items-center sm:items-end text-center sm:text-right w-full sm:w-auto mt-4 sm:mt-0 space-y-1">
      <div className="flex items-center">
        <Clock className={`w-4 h-4 ${colors.textMuted} mr-2`} />
        <span className={`${colors.textSecondary} text-sm font-medium`}>{currentTimeET} ET</span>
      </div>
      <span className={`text-xs font-semibold ${
          marketStatus === 'Market Open' ? colors.success :
          marketStatus === 'Pre-market' || marketStatus === 'Extended Hours' ? colors.warning :
          colors.danger
        }`}>
        {marketStatus}
      </span>
    </div>
  );
};

export default MarketStatus;