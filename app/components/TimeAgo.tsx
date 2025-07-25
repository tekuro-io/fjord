'use client';

type TimeAgoProps = {
  timestamp: number;
};

export default function TimeAgo({ timestamp }: TimeAgoProps) {
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000); // in seconds

  let display: string;
  if (diff < 5) display = 'just now';
  else if (diff < 60) display = `${diff} seconds ago`;
  else if (diff < 3600) display = `${Math.floor(diff / 60)} minutes ago`;
  else if (diff < 86400) display = `${Math.floor(diff / 3600)} hours ago`;
  else if (diff < 604800) display = `${Math.floor(diff / 86400)} days ago`;
  else display = new Date(timestamp).toLocaleDateString();

  return <span>Last fetched: {display}</span>;
}