import Redis, { RedisOptions } from "ioredis";

export interface StockItem {
  ticker: string;
  prev_price: number | null;
  price: number | null;
  delta: number | null;
  float: number | null;
  mav10: number | null;
  volume: number | null;
  multiplier: number | null;
  timestamp?: string;

}

const redisOptions: RedisOptions = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    connectTimeout: 10000,
    maxRetriesPerRequest: null, 
};

let redisClientPromise: Promise<Redis> | null = null;

function getRedisClient(): Promise<Redis> {
  if (redisClientPromise) return redisClientPromise;

  redisClientPromise = (async () => {
    const redis = new Redis(redisOptions);

    redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redis.on('connect', () => {
      console.log('Redis client connected successfully!');
    });

    redis.on('ready', () => {
      console.log('Redis client is ready to use.');
    });

    redis.on('end', () => {
      console.warn('Redis client connection ended.');
    });

    redis.on('reconnecting', (delay: number) => {
      console.log(`Redis client reconnecting... delay: ${delay}ms`);
    });

    return redis;
  })();

  return redisClientPromise;
}


export async function getStockDataFromRedis(): Promise<StockItem[]> {
    try {
        const redis = await getRedisClient()
        const keys = await redis.keys("scanner:latest:*");
        console.log("Found Redis keys:", keys);

        if (keys.length === 0) {
            console.warn("No 'scanner:latest:*' keys found in Redis.");
            return [];
        }

        const results = await redis.mget(...keys);
        console.log("Raw Redis mget results:", results);

        const stockItems: StockItem[] = [];
        results.forEach((jsonString, index) => {
            if (jsonString) {
                try {
                    const item: StockItem = JSON.parse(jsonString);
                    stockItems.push(item);
                } catch (parseError) {
                    console.error(`Error parsing JSON for key ${keys[index]}:`, parseError);
                }
            } else {
                console.warn(`No data found for key: ${keys[index]}`);
            }
        });

        return stockItems;
    } catch (error) {
        console.error("Error fetching stock data from Redis:", error);
        return [];
    }
}
