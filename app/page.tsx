import StockTable, { StockItem } from './components/StockTable'; // Correct import path for StockItem

// This function fetches data on the server side
async function getStockInitialData(): Promise<StockItem[]> {
  try {
    // Construct base URL robustly for SSR fetches
    const baseUrl = process.env.NODE_ENV === 'production'
      ? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://your-production-domain.com' // Replace with your actual production domain
      : 'http://localhost:3000';

    const res = await fetch(`${baseUrl}/api/stock-data`, {
      cache: 'no-store', // Ensures fresh data on each request, useful for real-time
    });

    if (!res.ok) { //
      const errorText = await res.text();
      throw new Error(`Failed to fetch initial stock data: ${res.status} ${res.statusText} - ${errorText}`);
    }

    const data: StockItem[] = await res.json();
    return data;
  } catch (error) {
    console.error("Error fetching initial stock data for SSR:", error); //
    return []; // Return empty array to allow the page to render with no data
  }
}

export default async function HomePage() {
  const initialData = await getStockInitialData();

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold text-center mb-8 text-emerald-400">
        Real-time Stock Dashboard
      </h1>
      {/* Correctly render StockTable as a JSX component */}
      <StockTable data={initialData} /> {/* THIS IS THE FIX for JSX component error */}
    </main>
  );
}