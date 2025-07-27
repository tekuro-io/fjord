import Redis, { RedisOptions } from "ioredis";
import { redisScannerReadDuration } from "./metrics/redis";

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
    const end = redisScannerReadDuration.startTimer();
    try {
        const redis = await getRedisClient()
        const keys = await redis.keys("scanner:latest:*");

        console.log(`🔍 Redis Query: Found ${keys.length} scanner:latest:* keys`);
        console.log(`🔑 Keys found:`, keys.map(k => k.toString()));
        
        // Store previous keys to detect new entries
        const previousKeys = (globalThis as any).previousRedisKeys || new Set();
        const currentKeys = new Set(keys.map(k => k.toString()));
        const newKeys = [...currentKeys].filter(key => !previousKeys.has(key));
        const removedKeys = [...previousKeys].filter(key => !currentKeys.has(key));
        
        if (newKeys.length > 0) {
            console.log(`🆕 NEW KEYS DETECTED:`, newKeys);
        }
        if (removedKeys.length > 0) {
            console.log(`🗑️  REMOVED KEYS:`, removedKeys);
        }
        
        // Update global tracking
        (globalThis as any).previousRedisKeys = currentKeys;

        if (keys.length === 0) {
            console.warn("No 'scanner:latest:*' keys found in Redis.");
            return [];
        }

        const results = await redis.mget(...keys);
        console.log(`📊 Redis mget returned ${results.length} results`);

        const stockItems: StockItem[] = [];
        results.forEach((jsonString, index) => {
            const key = keys[index];
            const ticker = key.split(':').pop(); // Extract ticker from key
            
            if (jsonString) {
                try {
                    const item: StockItem = JSON.parse(jsonString);
                    
                    // Log ALL items, not just first 3
                    console.log(`\n📈 Processing ${ticker} (${key}):`);
                    console.log(`   Raw JSON length: ${jsonString.length} chars`);
                    console.log(`   Raw JSON: ${jsonString}`);
                    console.log(`   Parsed ticker: ${item.ticker}`);
                    console.log(`   Parsed price: ${item.price}`);
                    console.log(`   Parsed prev_price: ${item.prev_price}`);
                    console.log(`   Parsed volume: ${item.volume}`);
                    console.log(`   Parsed mav10: ${item.mav10}`);
                    console.log(`   Parsed float: ${item.float}`);
                    console.log(`   Parsed delta: ${item.delta}`);
                    console.log(`   Parsed multiplier: ${item.multiplier}`);
                    console.log(`   Parsed timestamp: ${item.timestamp}`);
                    console.log(`   All parsed keys: [${Object.keys(item).join(', ')}]`);
                    
                    // Check for null/undefined values
                    const nullFields = Object.entries(item).filter(([key, value]) => value === null || value === undefined);
                    if (nullFields.length > 0) {
                        console.warn(`⚠️  ${ticker} has null/undefined fields:`, nullFields.map(([k, v]) => `${k}=${v}`));
                    }
                    
                    // Check for missing expected fields
                    const expectedFields = ['ticker', 'price', 'prev_price', 'volume', 'mav10', 'float', 'delta', 'multiplier'];
                    const missingFields = expectedFields.filter(field => !(field in item));
                    if (missingFields.length > 0) {
                        console.error(`❌ ${ticker} missing expected fields:`, missingFields);
                    }
                    
                    // Check for type mismatches
                    const typeIssues = [];
                    if (typeof item.price !== 'number' && item.price !== null) typeIssues.push(`price is ${typeof item.price}`);
                    if (typeof item.prev_price !== 'number' && item.prev_price !== null) typeIssues.push(`prev_price is ${typeof item.prev_price}`);
                    if (typeof item.volume !== 'number' && item.volume !== null) typeIssues.push(`volume is ${typeof item.volume}`);
                    if (typeof item.mav10 !== 'number' && item.mav10 !== null) typeIssues.push(`mav10 is ${typeof item.mav10}`);
                    if (typeof item.float !== 'number' && item.float !== null) typeIssues.push(`float is ${typeof item.float}`);
                    if (typeof item.delta !== 'number' && item.delta !== null) typeIssues.push(`delta is ${typeof item.delta}`);
                    if (typeof item.multiplier !== 'number' && item.multiplier !== null) typeIssues.push(`multiplier is ${typeof item.multiplier}`);
                    
                    if (typeIssues.length > 0) {
                        console.error(`🔢 ${ticker} type issues:`, typeIssues);
                    }
                    
                    // SPECIAL ALERT: Check if this is a new key with incomplete data
                    const isNewKey = newKeys.includes(key);
                    const hasOnlyPrice = item.price !== null && 
                                       (item.prev_price === null || item.prev_price === undefined) &&
                                       (item.volume === null || item.volume === undefined) &&
                                       (item.mav10 === null || item.mav10 === undefined) &&
                                       (item.float === null || item.float === undefined) &&
                                       (item.delta === null || item.delta === undefined) &&
                                       (item.multiplier === null || item.multiplier === undefined);
                    
                    if (isNewKey && hasOnlyPrice) {
                        console.error(`🚨🚨🚨 SUSPICIOUS NEW ENTRY DETECTED: ${ticker} 🚨🚨🚨`);
                        console.error(`   This is a NEW key with ONLY price data!`);
                        console.error(`   Key: ${key}`);
                        console.error(`   Raw JSON: ${jsonString}`);
                        console.error(`   This suggests data corruption or incomplete stock-poller processing!`);
                        console.error(`🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨`);
                    }
                    
                    stockItems.push(item);
                } catch (parseError) {
                    console.error(`❌ Error parsing JSON for key ${key}:`, parseError);
                    console.error(`   Raw data: ${jsonString}`);
                }
            } else {
                console.warn(`⚠️  No data found for key: ${key}`);
            }
        });

        console.log(`✅ Successfully processed ${stockItems.length} stock items from Redis`);
        return stockItems;
    } catch (error) {
        console.error("❌ Error fetching stock data from Redis:", error);
        return [];
    } finally {
        end()
    }
}
