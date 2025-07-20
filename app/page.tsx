import { Suspense } from 'react';
import Loader from './components/Spinner';
import StockTableLoader from './components/StockTableLoader';
import Image from 'next/image'

export default async function HomePage() {
    return (
        <main className="min-h-screen bg-gray-900 text-white p-4">
            <h1 className="text-4xl font-bold text-center mb-8 text-emerald-400">
                <Image
                    src="/stock.png"
                    alt="Stock Screener Icon"
                    className='inline-block mr-3 my-2'
                />
            </h1>
            <Suspense fallback={<Loader />}>
                <StockTableLoader />
            </Suspense>
        </main>
    );
}
