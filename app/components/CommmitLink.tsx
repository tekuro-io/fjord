import React from "react";

const COMMIT_HASH = process.env.COMMIT_HASH;
const COMMIT_URL = `https://github.com/amazur/fjord/commit/${COMMIT_HASH}`;

export function CommitLink() {
  return (
    <a
      href={COMMIT_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{ fontFamily: 'monospace', fontSize: '0.9em' }}
    >
      commit {COMMIT_HASH?.slice(0, 7)}
    </a>
  );
}
