import { getStockDataFromRedis, StockItem } from "../../lib/redis"; // Note the path and function name
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Call the new function that fetches full stock data from Redis
    const data: StockItem[] = await getStockDataFromRedis(); // Explicitly type data

    console.log(`🌐 API: Retrieved ${data.length} items from Redis`);
    
    if (data.length === 0) {
      console.warn("API: No stock data found from Redis. Returning empty array.");
      return NextResponse.json([]);
    }

    // Log a sample of the data being returned to see structure
    data.slice(0, 2).forEach((item, index) => {
      console.log(`\n🌐 API Sample ${index + 1} - ${item.ticker}:`);
      console.log(`   price: ${item.price} (type: ${typeof item.price})`);
      console.log(`   prev_price: ${item.prev_price} (type: ${typeof item.prev_price})`);
      console.log(`   volume: ${item.volume} (type: ${typeof item.volume})`);
      console.log(`   mav10: ${item.mav10} (type: ${typeof item.mav10})`);
      console.log(`   float: ${item.float} (type: ${typeof item.float})`);
      console.log(`   delta: ${item.delta} (type: ${typeof item.delta})`);
      console.log(`   multiplier: ${item.multiplier} (type: ${typeof item.multiplier})`);
      console.log(`   timestamp: ${item.timestamp} (type: ${typeof item.timestamp})`);
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("API Error: Failed to fetch stock data from Redis:", error);
    return NextResponse.json({ error: "Failed to fetch stock data" }, { status: 500 });
  }
}
