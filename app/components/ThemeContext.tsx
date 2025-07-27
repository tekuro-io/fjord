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
    chartTextColor: string;
    // Interactive elements
    buttonPrimary: string;
    buttonPrimaryHover: string;
    buttonSecondary: string;
    buttonSecondaryHover: string;
    
    // Input elements
    inputBackground: string;
    inputBorder: string;
    inputFocusBorder: string;
    inputText: string;
    inputPlaceholder: string;
    
    // Borders & dividers
    border: string;
    divider: string;
    // Shadows
    shadowSm: string;
    shadowMd: string;
    shadowLg: string;
    
    // Multiplier backgrounds
    multiplierBg1: string;
    multiplierBg2: string;
    multiplierBg3: string;
    multiplierBg4: string;
    multiplierBg5: string;
    multiplierBg6: string;
    multiplierText: string;
    
    // Delta backgrounds
    deltaPositiveBg1: string;
    deltaPositiveBg2: string;
    deltaPositiveBg3: string;
    deltaPositiveBg4: string;
    deltaPositiveBg5: string;
    deltaPositiveBg6: string;
    deltaNegativeBg1: string;
    deltaNegativeBg2: string;
    deltaNegativeBg3: string;
    deltaNegativeBg4: string;
    deltaNegativeBg5: string;
    deltaNegativeBg6: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const darkColors = {
  // Background colors & gradients
  primary: 'bg-gray-800',
  secondary: 'bg-gray-700',
  tertiary: 'bg-gray-900',
  gradient: 'bg-gradient-to-b from-gray-900 to-gray-800',
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
  tableHeaderGradient: 'bg-gray-700',
  tableRow: 'bg-gray-900',
  tableRowHover: 'hover:bg-gray-700',
  tableRowAlternate: 'bg-gray-800/50',
  expandedRow: 'bg-gray-700',
  expandedRowGradient: 'bg-gray-700',
  
  // Chart specific  
  chartBackground: 'bg-gray-900',
  chartBackgroundHex: '#1f2937',
  gridLines: '#374151',
  candleUpColor: '#22c55e',
  candleDownColor: '#ef4444',
  candleWickUpColor: '#22c55e',
  candleWickDownColor: '#ef4444',
  chartWatermark: 'rgba(8, 242, 246, 0.3)',
  chartTextColor: '#e5e7eb', // gray-200 for good contrast on dark
  
  // Interactive elements
  buttonPrimary: 'bg-blue-600 hover:bg-blue-500',
  buttonPrimaryHover: 'hover:bg-blue-500',
  buttonSecondary: 'bg-gray-600 hover:bg-gray-500',
  buttonSecondaryHover: 'hover:bg-gray-500',
  
  // Input elements
  inputBackground: 'bg-gray-900',
  inputBorder: 'border-gray-600',
  inputFocusBorder: 'focus:border-blue-500',
  inputText: 'text-white',
  inputPlaceholder: 'placeholder:text-gray-400',
  
  // Borders & dividers
  border: 'border-gray-600',
  divider: 'border-gray-700',
  
  // Shadows
  shadowSm: 'shadow-sm shadow-black/20',
  shadowMd: 'shadow-md shadow-black/20',
  shadowLg: 'shadow-lg shadow-black/25',
  
  // Multiplier backgrounds for dark mode
  multiplierBg1: 'bg-teal-900', // >1000
  multiplierBg2: 'bg-teal-800', // >300  
  multiplierBg3: 'bg-teal-700', // >40
  multiplierBg4: 'bg-teal-600', // >10
  multiplierBg5: 'bg-teal-500', // >7
  multiplierBg6: 'bg-teal-400', // >4
  multiplierText: 'text-white', // White text for dark backgrounds
  
  // Delta backgrounds for dark mode
  deltaPositiveBg1: 'bg-emerald-900', // >0.15
  deltaPositiveBg2: 'bg-emerald-800', // >0.10
  deltaPositiveBg3: 'bg-emerald-700', // >0.07
  deltaPositiveBg4: 'bg-emerald-600', // >0.04
  deltaPositiveBg5: 'bg-emerald-500', // >0.02
  deltaPositiveBg6: 'bg-emerald-400', // >0.005
  deltaNegativeBg1: 'bg-red-900', // <-0.15
  deltaNegativeBg2: 'bg-red-800', // <-0.10
  deltaNegativeBg3: 'bg-red-700', // <-0.07
  deltaNegativeBg4: 'bg-red-600', // <-0.04
  deltaNegativeBg5: 'bg-red-500', // <-0.02
  deltaNegativeBg6: 'bg-red-400', // <-0.005
};

const lightColors = {
  // Background colors & gradients
  primary: 'bg-white',
  secondary: 'bg-slate-100',
  tertiary: 'bg-gray-50',
  gradient: 'bg-gradient-to-br from-slate-200 via-blue-100 to-slate-100',
  containerGradient: 'bg-gradient-to-b from-white via-blue-50/30 to-slate-100',
  
  // Text colors
  textPrimary: 'text-slate-900',
  textSecondary: 'text-slate-700',
  textMuted: 'text-slate-600',
  
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
  tableHeader: 'bg-slate-200',
  tableHeaderGradient: 'bg-slate-200',
  tableRow: 'bg-white',
  tableRowHover: 'hover:bg-slate-100/50',
  tableRowAlternate: 'bg-slate-50/50',
  expandedRow: 'bg-slate-50',
  expandedRowGradient: 'bg-slate-50',
  
  // Chart specific  
  chartBackground: 'bg-white',
  chartBackgroundHex: '#ffffff',
  gridLines: '#e2e8f0',
  candleUpColor: '#059669', // emerald-600
  candleDownColor: '#dc2626', // red-600  
  candleWickUpColor: '#059669',
  candleWickDownColor: '#dc2626',
  chartWatermark: 'rgba(59, 130, 246, 0.6)', // blue with higher opacity for contrast
  chartTextColor: '#374151', // gray-700 for good contrast on light
  
  // Interactive elements
  buttonPrimary: 'bg-blue-600 hover:bg-blue-700',
  buttonPrimaryHover: 'hover:bg-blue-700',
  buttonSecondary: 'bg-slate-600 hover:bg-slate-700',
  buttonSecondaryHover: 'hover:bg-slate-700',
  
  // Input elements
  inputBackground: 'bg-white',
  inputBorder: 'border-slate-300',
  inputFocusBorder: 'focus:border-blue-500',
  inputText: 'text-slate-900',
  inputPlaceholder: 'placeholder:text-slate-400',
  
  // Borders & dividers
  border: 'border-slate-200',
  divider: 'border-slate-300',
  
  // Shadows
  shadowSm: 'shadow-sm shadow-slate-200/60',
  shadowMd: 'shadow-md shadow-slate-300/40',
  shadowLg: 'shadow-lg shadow-slate-400/30',
  
  // Multiplier backgrounds for light mode (darker colors for better contrast)
  multiplierBg1: 'bg-teal-600', // >1000
  multiplierBg2: 'bg-teal-500', // >300  
  multiplierBg3: 'bg-teal-400', // >40
  multiplierBg4: 'bg-teal-300', // >10
  multiplierBg5: 'bg-teal-200', // >7
  multiplierBg6: 'bg-teal-100', // >4
  multiplierText: 'text-teal-900', // Dark text for light backgrounds
  
  // Delta backgrounds for light mode (lighter colors suitable for light theme)
  deltaPositiveBg1: 'bg-emerald-600', // >0.15
  deltaPositiveBg2: 'bg-emerald-500', // >0.10
  deltaPositiveBg3: 'bg-emerald-400', // >0.07
  deltaPositiveBg4: 'bg-emerald-300', // >0.04
  deltaPositiveBg5: 'bg-emerald-200', // >0.02
  deltaPositiveBg6: 'bg-emerald-100', // >0.005
  deltaNegativeBg1: 'bg-red-600', // <-0.15
  deltaNegativeBg2: 'bg-red-500', // <-0.10
  deltaNegativeBg3: 'bg-red-400', // <-0.07
  deltaNegativeBg4: 'bg-red-300', // <-0.04
  deltaNegativeBg5: 'bg-red-200', // <-0.02
  deltaNegativeBg6: 'bg-red-100', // <-0.005
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