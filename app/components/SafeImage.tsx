'use client';

import { useState } from 'react';

type SafeImageProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
};

export default function SafeImage({ src, alt, width, height, className = '' }: SafeImageProps) {
  const [error, setError] = useState(false);

  if (error) return null;

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setError(true)}
    />
  );
}