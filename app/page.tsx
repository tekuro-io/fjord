import { Suspense } from 'react';
import { StockTableLoader } from './components/stock-table';
import Image from 'next/image'
import Spinner from './components/ui/Spinner';
import { CommitLink } from './components/CommitLink';
import TradingViewWrapper from './components/TradingViewWrapper';
import { ThemeProvider } from './components/ThemeContext';
import { ThemeWrapper } from './components/ThemeWrapper';
import ClientPageWrapper from './components/ClientPageWrapper';

export default async function HomePage() {
    return (
        <ThemeProvider>
            <ThemeWrapper>
                <ClientPageWrapper>
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-emerald-400">
                            <Image
                                src="/stock.svg"          
                                width={120}
                                height={90}
                                alt="Stock Screener Icon"
                                className='inline-block mr-3 my-2'
                            />
                        </h1>
                    </div>

                    <TradingViewWrapper />
                    <Suspense fallback={<Spinner />}>
                        <StockTableLoader />
                    </Suspense>
                    <footer className="w-full pt-8 py-3 text-center text-sm text-gray-400 font-sans tracking-wide mt-8">
                        <CommitLink />
                    </footer>
                </ClientPageWrapper>
            </ThemeWrapper>
        </ThemeProvider>
    );
}
