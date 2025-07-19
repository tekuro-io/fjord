import { getStockDataFromRedis, StockItem } from "../../lib/redis"; // Note the path and function name
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Call the new function that fetches full stock data from Redis
    const data: StockItem[] = await getStockDataFromRedis(); // Explicitly type data

    if (data.length === 0) {
      console.warn("API: No stock data found from Redis. Returning empty array.");
      // You might want a more specific status code or message if no data is intentionally returned
      return NextResponse.json([]);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("API Error: Failed to fetch stock data from Redis:", error);
    return NextResponse.json({ error: "Failed to fetch stock data" }, { status: 500 });
  }
}
