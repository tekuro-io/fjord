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
      className={`mt-1 text-sm cursor-pointer transition-all duration-200 ease-in-out text-left ${
        expanded
          ? 'text-gray-100 leading-relaxed'
          : 'text-gray-300 line-clamp-3'
      }`}
      onClick={() => setExpanded((prev) => !prev)}
    >
      {displayText}
      {isTruncated && (
        <span className="ml-1 text-blue-400 underline">
          {expanded ? '(less)' : '(more)'}
        </span>
      )}
    </p>
  );
}