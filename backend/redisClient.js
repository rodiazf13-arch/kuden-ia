import { createClient } from 'redis';

let redisClient = null;

export async function initRedis() {
  if (!process.env.REDIS_HOST) {
    console.warn("No REDIS_HOST configured, skipping Redis initialization.");
    return null;
  }

  // Construct URL with password if available
  let redisUrl = 'redis://';
  if (process.env.REDIS_PASSWORD) {
    redisUrl += `:${process.env.REDIS_PASSWORD}@`;
  }
  redisUrl += `${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`;
  
  redisClient = createClient({
    url: redisUrl
  });

  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  redisClient.on('connect', () => console.log('Redis Client Connected'));

  try {
    await redisClient.connect();
    return redisClient;
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    redisClient = null;
    return null;
  }
}

export function getRedisClient() {
  return redisClient;
}

export async function getCachedHistory(convId) {
  if (!redisClient) return null;
  try {
    const key = `conv_history:${convId}`;
    const data = await redisClient.get(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error getting cached history:", err);
  }
  return null;
}

export async function setCachedHistory(convId, history, ttlSeconds = 7200) {
  if (!redisClient) return;
  try {
    const key = `conv_history:${convId}`;
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(history));
  } catch (err) {
    console.error("Error setting cached history:", err);
  }
}

export async function invalidateHistory(convId) {
  if (!redisClient) return;
  try {
    const key = `conv_history:${convId}`;
    await redisClient.del(key);
  } catch (err) {
    console.error("Error invalidating cached history:", err);
  }
}
