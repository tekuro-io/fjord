'use client';

import React, { useState, Suspense } from 'react';
import { StockTableLoader } from './components/stock-table';
import Image from 'next/image'
import Spinner from './components/ui/Spinner';
import { CommitLink } from './components/CommitLink';
import TradingViewWrapper from './components/TradingViewWrapper';
import { ThemeProvider } from './components/ThemeContext';
import { ThemeWrapper } from './components/ThemeWrapper';
import Sidebar from './components/Sidebar';

export default function HomePage() {
    // Sidebar state
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const toggleSidebar = () => {
        setSidebarOpen(prev => !prev);
    };

    return (
        <ThemeProvider>
            <ThemeWrapper>
                {/* Sidebar Component - Comment this section to disable */}
                <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
                
                {/* Main Content */}
                <div className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-72' : ''}`}>
                    <h1 className="text-4xl font-bold text-center mb-8 text-emerald-400">
                        <Image
                            src="/stock.svg"          
                            width={120}
                            height={90}
                            alt="Stock Screener Icon"
                            className='inline-block mr-3 my-2'
                        />
                    </h1>

                    <TradingViewWrapper />
                    <Suspense fallback={<Spinner />}>
                        <StockTableLoader />
                    </Suspense>
                    <footer className="w-full pt-8 py-3 text-center text-sm text-gray-400 font-sans tracking-wide mt-8">
                        <CommitLink />
                    </footer>
                </div>
            </ThemeWrapper>
        </ThemeProvider>
    );
}
