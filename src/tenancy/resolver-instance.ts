import { db, admin } from '../lib/firebase.js';
import redisClient from '../lib/redis.js';
import { UserContextResolverImpl } from './context-resolver.js';

export const userContextResolver = new UserContextResolverImpl(db as any, admin as any, redisClient);
