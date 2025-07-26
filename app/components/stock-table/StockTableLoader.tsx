import { connection } from "next/server";
import StockTable from "./StockTable"; 
import { getStockDataFromRedis } from "../../lib/redis";
import type { StockItem } from "./types"; 

export const dynamic = "force-dynamic";

export default async function StockTableLoader() {
    await connection()
    try {
        const data: StockItem[] = await getStockDataFromRedis();
        return <StockTable data={data} />;
    } catch (error) {
        console.error("Error in StockTableLoader: Failed to fetch data for StockTable:", error);
        return <StockTable data={[]} />;
    }
}
