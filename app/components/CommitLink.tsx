import React from "react";

const COMMIT_HASH = process.env.NEXT_PUBLIC_COMMIT_HASH;
const COMMIT_URL = `https://github.com/amazr/fjord/commit/${COMMIT_HASH}`;

export function CommitLink() {

  const baseStyle = {
    color: 'rgba(40,76,109,1)', 
    textDecoration: 'none', 
  };

  const hoverStyle = {
    color: 'rgba(255, 255, 255, 0.1)', 
  };

  if (!COMMIT_HASH) {
    return null; 
  }

  return (
    <a
    href={COMMIT_URL}
    target="_blank"
    rel="noopener noreferrer"

    className="text-sm font-mono ml-6 mb-4 inline-block" 
    style={baseStyle} 
  >
    {COMMIT_HASH.slice(0, 7)}
  </a>
  );
}
