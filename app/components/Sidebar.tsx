'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Star, Plus } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const { colors } = useTheme();

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full z-40 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${colors.primary} border-r ${colors.border} shadow-lg`}
        style={{ width: '280px' }}
      >
        {/* Sidebar Header */}
        <div className={`p-4 border-b ${colors.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className={`w-5 h-5 ${colors.accent}`} />
              <h2 className={`text-lg font-semibold ${colors.textPrimary}`}>Watchlist</h2>
            </div>
            <button
              onClick={onToggle}
              className={`p-1 rounded-md ${colors.textMuted} hover:${colors.textSecondary} hover:${colors.secondary} transition-colors`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="p-4">
          {/* Add Ticker Button */}
          <button
            className={`w-full flex items-center gap-2 p-3 rounded-lg ${colors.secondary} border ${colors.border} ${colors.textSecondary} hover:${colors.tableRowHover} transition-colors group`}
          >
            <Plus className={`w-4 h-4 ${colors.textMuted} group-hover:${colors.accent}`} />
            <span className="text-sm font-medium">Add Ticker</span>
          </button>

          {/* Watchlist Items - Stub */}
          <div className="mt-4 space-y-2">
            <div className={`p-3 rounded-lg ${colors.secondary} border ${colors.border}`}>
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${colors.accent}`}>AAPL</span>
                <span className={`text-sm ${colors.textMuted}`}>$150.25</span>
              </div>
              <div className={`text-xs ${colors.success} mt-1`}>+2.5%</div>
            </div>
            
            <div className={`p-3 rounded-lg ${colors.secondary} border ${colors.border}`}>
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${colors.accent}`}>TSLA</span>
                <span className={`text-sm ${colors.textMuted}`}>$225.50</span>
              </div>
              <div className={`text-xs ${colors.danger} mt-1`}>-1.2%</div>
            </div>

            <div className={`p-3 rounded-lg ${colors.secondary} border ${colors.border}`}>
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${colors.accent}`}>NVDA</span>
                <span className={`text-sm ${colors.textMuted}`}>$890.75</span>
              </div>
              <div className={`text-xs ${colors.success} mt-1`}>+5.1%</div>
            </div>
          </div>

          {/* Empty State (commented for stub) */}
          {/* 
          <div className="mt-8 text-center">
            <Star className={`w-12 h-12 ${colors.textMuted} mx-auto mb-3 opacity-50`} />
            <p className={`text-sm ${colors.textMuted}`}>No tickers in watchlist</p>
            <p className={`text-xs ${colors.textMuted} mt-1`}>Add some tickers to get started</p>
          </div>
          */}
        </div>
      </div>

      {/* Toggle Button (when sidebar is closed) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className={`fixed left-4 top-4 z-50 p-2 rounded-lg ${colors.primary} border ${colors.border} ${colors.textMuted} hover:${colors.textSecondary} hover:${colors.secondary} transition-all shadow-lg`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Overlay (when sidebar is open on mobile) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
};

export default Sidebar;