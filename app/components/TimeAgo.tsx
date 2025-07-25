'use client';

import { useEffect, useState } from 'react';

type TimeAgoProps = {
  timestamp: number; // unix millis
};

export default function TimeAgo({ timestamp }: TimeAgoProps) {
  const [relative, setRelative] = useState('');

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const diff = Math.floor((now - timestamp) / 1000); // seconds

      if (diff < 5) return setRelative('just now');
      if (diff < 60) return setRelative(`${diff} seconds ago`);
      if (diff < 3600) return setRelative(`${Math.floor(diff / 60)} minutes ago`);
      if (diff < 86400) return setRelative(`${Math.floor(diff / 3600)} hours ago`);
      if (diff < 604800) return setRelative(`${Math.floor(diff / 86400)} days ago`);

      const date = new Date(timestamp);
      return setRelative(date.toLocaleDateString());
    };

    update();

    const interval = setInterval(update, 10000); // update every 10s
    return () => clearInterval(interval);
  }, [timestamp]);

  return <span>{relative}</span>;
}