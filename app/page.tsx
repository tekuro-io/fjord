import { Suspense } from 'react';
import Spinner from './components/Spinner';
import StockTableLoader from './components/StockTableLoader';

export default async function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4">
      <h1 className="text-4xl font-bold text-center mb-8 text-emerald-400">
        <img
          src="/stock.svg"
          className="inline-block mr-3 my-2"
        />

      </h1>
      <Suspense fallback={<Spinner />}>
        <StockTableLoader />
      </Suspense>
    </main>
  );
}