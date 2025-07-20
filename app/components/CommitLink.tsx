import React from "react";

const COMMIT_HASH = process.env.COMMIT_HASH;
const COMMIT_URL = `https://github.com/amazr/fjord/commit/${COMMIT_HASH}`;

export function CommitLink() {
  return (
    <a
      href={COMMIT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 text-sm font-mono hover:underline ml-6 mb-4 inline-block"
    >
      {COMMIT_HASH?.slice(0, 7)}
    </a>
  );
}
