import { Suspense } from 'react';
import StockTableLoader from './components/StockTableLoader';
import Image from 'next/image'
import Spinner from './components/Spinner';

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
        </main>
    );
}
