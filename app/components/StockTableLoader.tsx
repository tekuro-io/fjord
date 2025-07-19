import Redis, { RedisOptions } from "ioredis";
import StockTable from "./StockTable";
import { connection } from "next/server";

export default async function StockTableLoader() {
    await connection() // Disables pre-rendering
    const redisOptions: RedisOptions = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
    };

    const redis = new Redis(redisOptions);

    try {
        const tickersJson = await redis.get('tickers');
        const data = tickersJson ? JSON.parse(tickersJson) : [];

        return <StockTable data={data} />;
    } catch (error) {
        console.error('Error fetching stock data from Redis:', error);
        return (
            <div className="text-red-400">Failed to load stock data.</div>
        );
    } finally {
        redis.disconnect();
    }
}
