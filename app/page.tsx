import { Suspense } from 'react';
import StockTableLoader from './components/StockTableLoader';
import Image from 'next/image'
import Spinner from './components/Spinner';
import { CommitLink } from './components/CommitLink';

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
            <Suspense fallback={<Spinner />}>
                <StockTableLoader />
            </Suspense>
            <footer className="absolute bottom-0 left-0 w-full py-3 border-t border-gray-700 text-center text-sm text-gray-400 font-sans tracking-wide bg-gradient-to-b from-gray-900 to-gray-800">
                <CommitLink />
            </footer>
        </main>
    );
}
