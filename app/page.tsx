import { Suspense } from "react";
import Spinner from "./components/Spinner";
import StockTableLoader from "./components/StockTableLoader";

export default async function HomePage() {
  return (
    <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-teal-400 mb-8 drop-shadow-lg">Real-time Stock Dashboard</h1>
      <Suspense fallback={<Spinner />}>
        <StockTableLoader />
      </Suspense>
    </main>
  );
}
