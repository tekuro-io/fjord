import { connection } from "next/server";
import StockTable from "./StockTable"; 
import { getStockDataFromRedis } from "../../lib/redis";
import type { StockItem } from "./types"; 

export const dynamic = "force-dynamic";

export default async function StockTableLoader() {
    await connection()
    try {
        const data: StockItem[] = await getStockDataFromRedis();
        
        console.log(`🔄 StockTableLoader: Retrieved ${data.length} items from Redis`);
        
        // Log detailed info about items with missing data
        data.forEach((item, index) => {
            const missingOrNullFields = [];
            if (!item.ticker) missingOrNullFields.push('ticker');
            if (item.price === null || item.price === undefined) missingOrNullFields.push('price');
            if (item.prev_price === null || item.prev_price === undefined) missingOrNullFields.push('prev_price');
            if (item.volume === null || item.volume === undefined) missingOrNullFields.push('volume');
            if (item.mav10 === null || item.mav10 === undefined) missingOrNullFields.push('mav10');
            if (item.float === null || item.float === undefined) missingOrNullFields.push('float');
            if (item.delta === null || item.delta === undefined) missingOrNullFields.push('delta');
            if (item.multiplier === null || item.multiplier === undefined) missingOrNullFields.push('multiplier');
            
            if (missingOrNullFields.length > 0) {
                console.warn(`⚠️  StockTableLoader: ${item.ticker || `Item ${index}`} has missing/null fields: [${missingOrNullFields.join(', ')}]`);
                console.log(`   Full item:`, JSON.stringify(item, null, 2));
            }
        });
        
        return <StockTable data={data} />;
    } catch (error) {
        console.error("Error in StockTableLoader: Failed to fetch data for StockTable:", error);
        return <StockTable data={[]} />;
    }
}
