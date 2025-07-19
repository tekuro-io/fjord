import Redis, { RedisOptions } from "ioredis";

const redisOptions: RedisOptions = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
};

export async function getTickers() {
    const redis = new Redis(redisOptions);
    try {
        const tickersJson = await redis.get("tickers");
        return tickersJson ? JSON.parse(tickersJson) : [];
    } catch (error) {
        console.error("Redis error", error);
        return [];
    }
}
