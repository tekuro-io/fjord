import React from 'react';

export const useMarketStatus = () => {
  const [currentTimeET, setCurrentTimeET] = React.useState('');
  const [marketStatus, setMarketStatus] = React.useState('');

  const getMarketStatus = React.useCallback(() => {
    const now = new Date();
    try {
      const etFormatter = new Intl.DateTimeFormatter('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
      const [etHours, etMinutes] = etFormatter.format(now).split(':').map(Number);

      const dayOfWeek = now.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return 'Market Closed';
      }

      const currentMinutesET = etHours * 60 + etMinutes;

      const preMarketOpen = 4 * 60;
      const marketOpen = 9 * 60 + 30;
      const marketClose = 16 * 60;
      const extendedMarketClose = 20 * 60;

      if (currentMinutesET >= marketOpen && currentMinutesET < marketClose) {
        return 'Market Open';
      } else if (currentMinutesET >= preMarketOpen && currentMinutesET < marketOpen) {
        return 'Pre-market';
      } else if (currentMinutesET >= marketClose && currentMinutesET < extendedMarketClose) {
        return 'Extended Hours';
      } else {
        return 'Market Closed';
      }
    } catch (e) {
      console.error("Error determining market status:", e);
      return 'Unknown';
    }
  }, []);

  React.useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      };
      setCurrentTimeET(new Intl.DateTimeFormat('en-US', options).format(now));
      setMarketStatus(getMarketStatus());
    };

    updateClock();
    const intervalId = setInterval(updateClock, 1000);
    return () => clearInterval(intervalId);
  }, [getMarketStatus]);

  return { currentTimeET, marketStatus };
};