import { Suspense } from 'react';
import StockTableLoader from './components/StockTableLoader';
import Image from 'next/image'
import Spinner from './components/Spinner';
import { CommitLink } from './components/CommitLink';
import TradingViewWrapper from './components/TradingViewWrapper';



export default async function HomePage() {
    return (
        <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4">
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

        </main>
    );
}
