import { Redis } from 'ioredis';
import configManager from '../config/ConfigManager.js';
import logger from '../utils/logger.js';


const config: any = configManager.export();

const redisConfig = {
  host: config.redis?.host || 'localhost',
  port: config.redis?.port || 6379,
  password: config.redis?.password,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: null, // Required for Bull/BullMQ compatibility if used directly, though this is a general client
};

const redisClient = new Redis(redisConfig);

redisClient.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redisClient.on('error', err => {
  logger.error('❌ Redis connection error:', err);
});

export default redisClient;
