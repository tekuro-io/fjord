'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: {
    // Background colors
    primary: string;
    secondary: string;
    tertiary: string;
    // Text colors
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    // Accent colors (keep consistent)
    accent: string;
    accentHover: string;
    // State colors
    success: string;
    danger: string;
    warning: string;
    // Chart/table specific
    tableHeader: string;
    tableRow: string;
    tableRowHover: string;
    expandedRow: string;
    chartBackground: string;
    gridLines: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const darkColors = {
  primary: 'bg-gray-800',
  secondary: 'bg-gray-700',
  tertiary: 'bg-gray-900',
  textPrimary: 'text-white',
  textSecondary: 'text-gray-300',
  textMuted: 'text-gray-400',
  accent: 'text-blue-400',
  accentHover: 'text-blue-300',
  success: 'text-green-400',
  danger: 'text-red-400',
  warning: 'text-yellow-400',
  tableHeader: 'bg-gray-700',
  tableRow: 'bg-gray-900',
  tableRowHover: 'bg-gray-700',
  expandedRow: 'bg-gray-700',
  chartBackground: '#1f2937',
  gridLines: '#374151',
};

const lightColors = {
  primary: 'bg-white',
  secondary: 'bg-gray-100',
  tertiary: 'bg-gray-50',
  textPrimary: 'text-gray-900',
  textSecondary: 'text-gray-700',
  textMuted: 'text-gray-500',
  accent: 'text-blue-600',
  accentHover: 'text-blue-700',
  success: 'text-green-600',
  danger: 'text-red-600',
  warning: 'text-yellow-600',
  tableHeader: 'bg-gray-200',
  tableRow: 'bg-white',
  tableRowHover: 'bg-gray-50',
  expandedRow: 'bg-gray-100',
  chartBackground: '#ffffff',
  gridLines: '#e5e7eb',
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('dark');

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const colors = theme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};