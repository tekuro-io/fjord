'use client';

import { useState } from 'react';

type ExpandableDescriptionProps = {
  text: string;
  maxLength?: number;
};

export default function ExpandableDescription({ text, maxLength = 150 }: ExpandableDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const isTruncated = text.length > maxLength;
  const displayText = expanded || !isTruncated ? text : text.slice(0, maxLength) + '…';

  return (
    <p
      className="mt-1 text-sm text-gray-300 cursor-pointer"
      onClick={() => setExpanded((prev) => !prev)}
    >
      {displayText}
      {isTruncated && (
        <span className="ml-1 text-blue-400">
          {expanded ? '(less)' : '(more)'}
        </span>
      )}
    </p>
  );
}