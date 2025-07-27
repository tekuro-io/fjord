'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: {
    // Background colors & gradients
    primary: string;
    secondary: string;
    tertiary: string;
    gradient: string;
    containerGradient: string;
    // Text colors
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    // Accent colors
    accent: string;
    accentHover: string;
    accentBackground: string;
    // State colors
    success: string;
    danger: string;
    warning: string;
    successBg: string;
    dangerBg: string;
    warningBg: string;
    // Table specific
    tableHeader: string;
    tableHeaderGradient: string;
    tableRow: string;
    tableRowHover: string;
    tableRowAlternate: string;
    expandedRow: string;
    expandedRowGradient: string;
    // Chart specific
    chartBackground: string;
    chartBackgroundHex: string;
    gridLines: string;
    candleUpColor: string;
    candleDownColor: string;
    candleWickUpColor: string;
    candleWickDownColor: string;
    chartWatermark: string;
    // Interactive elements
    buttonPrimary: string;
    buttonPrimaryHover: string;
    buttonSecondary: string;
    buttonSecondaryHover: string;
    // Borders & dividers
    border: string;
    divider: string;
    // Shadows
    shadowSm: string;
    shadowMd: string;
    shadowLg: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const darkColors = {
  // Background colors & gradients
  primary: 'bg-gray-800',
  secondary: 'bg-gray-700',
  tertiary: 'bg-gray-900',
  gradient: 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900',
  containerGradient: 'bg-gradient-to-b from-gray-800 to-gray-900',
  
  // Text colors
  textPrimary: 'text-white',
  textSecondary: 'text-gray-300',
  textMuted: 'text-gray-400',
  
  // Accent colors
  accent: 'text-blue-400',
  accentHover: 'text-blue-300',
  accentBackground: 'bg-blue-500/10',
  
  // State colors
  success: 'text-green-400',
  danger: 'text-red-400',
  warning: 'text-yellow-400',
  successBg: 'bg-green-500/10',
  dangerBg: 'bg-red-500/10',
  warningBg: 'bg-yellow-500/10',
  
  // Table specific
  tableHeader: 'bg-gray-700',
  tableHeaderGradient: 'bg-gradient-to-r from-gray-700 to-gray-600',
  tableRow: 'bg-gray-900',
  tableRowHover: 'hover:bg-gray-700',
  tableRowAlternate: 'bg-gray-800/50',
  expandedRow: 'bg-gray-700',
  expandedRowGradient: 'bg-gradient-to-r from-gray-700 to-gray-600',
  
  // Chart specific  
  chartBackground: 'bg-gray-900',
  chartBackgroundHex: '#1f2937',
  gridLines: '#374151',
  candleUpColor: '#22c55e',
  candleDownColor: '#ef4444',
  candleWickUpColor: '#22c55e',
  candleWickDownColor: '#ef4444',
  chartWatermark: 'rgba(8, 242, 246, 0.3)',
  
  // Interactive elements
  buttonPrimary: 'bg-blue-600 hover:bg-blue-500',
  buttonPrimaryHover: 'hover:bg-blue-500',
  buttonSecondary: 'bg-gray-600 hover:bg-gray-500',
  buttonSecondaryHover: 'hover:bg-gray-500',
  
  // Borders & dividers
  border: 'border-gray-600',
  divider: 'border-gray-700',
  
  // Shadows
  shadowSm: 'shadow-sm shadow-black/20',
  shadowMd: 'shadow-md shadow-black/20',
  shadowLg: 'shadow-lg shadow-black/25',
};

const lightColors = {
  // Background colors & gradients
  primary: 'bg-white',
  secondary: 'bg-slate-50',
  tertiary: 'bg-gray-50',
  gradient: 'bg-gradient-to-br from-blue-50 via-white to-slate-50',
  containerGradient: 'bg-gradient-to-b from-white via-blue-50/30 to-slate-100',
  
  // Text colors
  textPrimary: 'text-slate-900',
  textSecondary: 'text-slate-700',
  textMuted: 'text-slate-500',
  
  // Accent colors
  accent: 'text-blue-600',
  accentHover: 'text-blue-700',
  accentBackground: 'bg-blue-50',
  
  // State colors
  success: 'text-emerald-700',
  danger: 'text-red-700',
  warning: 'text-amber-700',
  successBg: 'bg-emerald-50',
  dangerBg: 'bg-red-50',
  warningBg: 'bg-amber-50',
  
  // Table specific
  tableHeader: 'bg-slate-100',
  tableHeaderGradient: 'bg-gradient-to-r from-slate-100 via-blue-50 to-slate-100',
  tableRow: 'bg-white',
  tableRowHover: 'hover:bg-blue-50/50',
  tableRowAlternate: 'bg-slate-50/50',
  expandedRow: 'bg-slate-50',
  expandedRowGradient: 'bg-gradient-to-r from-blue-50 via-slate-50 to-blue-50',
  
  // Chart specific  
  chartBackground: 'bg-white',
  chartBackgroundHex: '#ffffff',
  gridLines: '#e2e8f0',
  candleUpColor: '#059669', // emerald-600
  candleDownColor: '#dc2626', // red-600  
  candleWickUpColor: '#059669',
  candleWickDownColor: '#dc2626',
  chartWatermark: 'rgba(59, 130, 246, 0.15)', // blue with low opacity
  
  // Interactive elements
  buttonPrimary: 'bg-blue-600 hover:bg-blue-700',
  buttonPrimaryHover: 'hover:bg-blue-700',
  buttonSecondary: 'bg-slate-200 hover:bg-slate-300',
  buttonSecondaryHover: 'hover:bg-slate-300',
  
  // Borders & dividers
  border: 'border-slate-200',
  divider: 'border-slate-300',
  
  // Shadows
  shadowSm: 'shadow-sm shadow-slate-200/60',
  shadowMd: 'shadow-md shadow-slate-300/40',
  shadowLg: 'shadow-lg shadow-slate-400/30',
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