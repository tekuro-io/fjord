'use client';

import React from 'react';
import { useTheme } from './ThemeContext';

interface ThemeWrapperProps {
  children: React.ReactNode;
}

export const ThemeWrapper: React.FC<ThemeWrapperProps> = ({ children }) => {
  const { colors } = useTheme();
  
  return (
    <main className={`min-h-screen ${colors.gradient} ${colors.textPrimary} p-4 transition-all duration-500`}>
      <style jsx global>{`
        * {
          transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
        }
      `}</style>
      {children}
    </main>
  );
};