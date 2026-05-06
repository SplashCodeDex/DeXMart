import { Redis } from "ioredis";
import { db, admin } from "../lib/firebase.js";
import logger from "../utils/logger.js";
import { UserContext, UserContextResolver, PLAN_CAPABILITIES, PlanTier } from "./tenant-context.js";

export class UserContextResolverImpl implements UserContextResolver {
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly firestore: typeof db,
    private readonly auth: typeof admin,
    private readonly redis: Redis,
  ) {}

  /**
   * Resolve UserContext from a userId (the ISOLATION KEY).
   */
  async fromUserId(userId: string): Promise<UserContext> {
    const cacheKey = `user:context:${userId}`;

    // 1. Try Redis Cache
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as UserContext;
      }
    } catch (err) {
      logger.warn(`[UserContextResolver] Redis error for ${userId}:`, err);
    }

    // 2. Cache Miss -> Fetch from Firestore
    const userDoc = await this.firestore.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new Error(`User not found: ${userId}`);
    }

    const userData = userDoc.data()!;
    const plan = (userData.plan || "free") as PlanTier;

    // 3. Fetch Usage (Asynchronous but required for context)
    const usageDoc = await this.firestore
      .collection("users")
      .doc(userId)
      .collection("usage")
      .doc("current")
      .get();

    const usageData = usageDoc.exists ? usageDoc.data()! : {};

    // 4. Construct Full UserContext
    const context: UserContext = {
      userId: userId,
      displayName: userData.displayName || "User",
      email: userData.email || "",
      plan: plan,
      capabilities: PLAN_CAPABILITIES[plan],
      usage: {
        messagesThisPeriod: usageData.messagesThisPeriod || 0,
        activeChannels: usageData.activeChannels || 0,
        activeAgents: usageData.activeAgents || 0,
        tokensConsumed: usageData.tokensConsumed || 0,
        periodStart: usageData.periodStart?.toDate() || new Date(),
        periodEnd: usageData.periodEnd?.toDate() || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      subscription: {
        stripeCustomerId: userData.stripeCustomerId || null,
        stripeSubscriptionId: userData.stripeSubscriptionId || null,
        isActive: userData.subscriptionStatus === "active",
        isTrial: userData.subscriptionStatus === "trialing",
        trialEndsAt: userData.trialEndsAt?.toDate() || null,
        isOverLimit: false, // Calculated by usage trackers
      },
      meta: {
        createdAt: userData.createdAt?.toDate() || new Date(),
        lastActiveAt: new Date(),
        timezone: userData.settings?.timezone || "UTC",
      },
    };

    // 5. Cache result
    try {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(context));
    } catch (err) {
      logger.error(`[UserContextResolver] Failed to cache context for ${userId}:`, err);
    }

    return context;
  }

  /**
   * Resolve UserContext from a Firebase ID Token.
   */
  async fromToken(token: string): Promise<UserContext> {
    try {
      const decodedToken = await this.auth.auth().verifyIdToken(token);
      return await this.fromUserId(decodedToken.uid);
    } catch (err) {
      logger.error("[UserContextResolver] Token verification failed:", err);
      throw new Error("Unauthorized: Invalid token");
    }
  }

  /**
   * Resolve UserContext from a channel ID using global mapping.
   */
  async fromChannelId(channelId: string): Promise<UserContext> {
    const mappingCacheKey = `channel:user:${channelId}`;

    // 1. Check mapping cache
    try {
      const cachedUserId = await this.redis.get(mappingCacheKey);
      if (cachedUserId) {
        return await this.fromUserId(cachedUserId);
      }
    } catch (err) {
      logger.warn(`[UserContextResolver] Channel mapping cache error for ${channelId}:`, err);
    }

    // 2. Firestore lookup for mapping
    const mappingDoc = await this.firestore.collection("channelMappings").doc(channelId).get();
    if (!mappingDoc.exists) {
      throw new Error(`Channel mapping not found: ${channelId}`);
    }

    const userId = mappingDoc.data()!.userId;

    // 3. Cache the mapping (Longer TTL than context)
    try {
      await this.redis.setex(mappingCacheKey, 3600 * 24, userId); // 24 hours
    } catch (err) {
      logger.error(`[UserContextResolver] Failed to cache mapping for ${channelId}:`, err);
    }

    return await this.fromUserId(userId);
  }

  /**
   * Quick check for account status.
   */
  async isActive(userId: string): Promise<boolean> {
    try {
      const context = await this.fromUserId(userId);
      return context.subscription.isActive || context.subscription.isTrial;
    } catch {
      return false;
    }
  }
}
