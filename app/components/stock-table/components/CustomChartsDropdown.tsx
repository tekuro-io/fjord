'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Grid3x3, ChevronDown } from 'lucide-react';
import { useTheme } from '../../ThemeContext';

interface CustomChartsDropdownProps {
  className?: string;
}

const CustomChartsDropdown: React.FC<CustomChartsDropdownProps> = ({ className = '' }) => {
  const { colors } = useTheme();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<{cols: number, rows: number} | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHoveredCell(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCellClick = (cols: number, rows: number) => {
    const layoutParam = `${cols}x${rows}`;
    router.push(`/multichart?s=${layoutParam}`);
    setIsOpen(false);
    setHoveredCell(null);
  };

  const handleCellHover = (cols: number, rows: number) => {
    setHoveredCell({ cols, rows });
  };

  const renderGridSelector = () => {
    const maxCols = 3;
    const maxRows = 3;
    const cells = [];

    for (let row = 1; row <= maxRows; row++) {
      for (let col = 1; col <= maxCols; col++) {
        const isSelected = hoveredCell && col <= hoveredCell.cols && row <= hoveredCell.rows;
        cells.push(
          <div
            key={`${col}-${row}`}
            className={`w-6 h-6 border-2 cursor-pointer transition-all duration-150 ${
              isSelected 
                ? `${colors.accent.replace('text-', 'bg-')} border-blue-500` 
                : `${colors.inputBackground} border-gray-400 hover:border-blue-400`
            }`}
            onMouseEnter={() => handleCellHover(col, row)}
            onClick={() => handleCellClick(col, row)}
            title={`${col}x${row} layout`}
          />
        );
      }
    }

    return (
      <div className="grid grid-cols-3 gap-1 p-3">
        {cells}
      </div>
    );
  };

  const getLayoutText = () => {
    if (!hoveredCell) return 'Select layout';
    return `${hoveredCell.cols}x${hoveredCell.rows}`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 ${colors.buttonPrimary} text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium hover:opacity-90`}
        title="Create custom multi-chart layout"
        aria-label="Create custom multi-chart layout"
      >
        <Grid3x3 className="w-4 h-4" />
        <span>Custom Charts</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute top-full left-0 mt-1 ${colors.containerGradient} rounded-lg border ${colors.border} shadow-lg z-50`}>
          <div className="p-2">
            <div className={`text-xs ${colors.textSecondary} mb-2 text-center`}>
              {getLayoutText()}
            </div>
            {renderGridSelector()}
            <div className={`text-xs ${colors.textMuted} text-center mt-2 px-2`}>
              Click to create blank multi-chart
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomChartsDropdown;