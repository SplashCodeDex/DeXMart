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
   * Resolve UserContext from a userId or tenantId (the ISOLATION KEY).
   *
   * Callers throughout the codebase pass either a Firebase Auth UID or a
   * tenantId (prefixed with "tenant-"). The Firestore data model is:
   *   - `users/{uid}`                          → global lookup doc (email, tenantId, role, plan)
   *   - `tenants/{tenantId}`                    → tenant config (plan, ownerId, subscription, settings)
   *   - `tenants/{tenantId}/users/{uid}`        → full user profile within a tenant
   *
   * This method handles both cases:
   *   1. If the ID is a tenantId → look up `tenants/{tenantId}` directly.
   *   2. If the ID is a UID → look up `users/{uid}` to get tenantId, then `tenants/{tenantId}`.
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

    // 2. Cache Miss -> Determine resolution strategy based on ID format
    let tenantId: string;
    let ownerUid: string;
    let tenantData: FirebaseFirestore.DocumentData;
    let ownerData: FirebaseFirestore.DocumentData;

    if (userId.startsWith("tenant-")) {
      // --- Path A: Caller passed a tenantId ---
      tenantId = userId;
      const tenantDoc = await this.firestore.collection("tenants").doc(tenantId).get();
      if (!tenantDoc.exists) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }
      tenantData = tenantDoc.data()!;
      ownerUid = tenantData.ownerId;

      // Fetch the owner's profile from the tenant subcollection
      const ownerDoc = await this.firestore
        .collection("tenants")
        .doc(tenantId)
        .collection("users")
        .doc(ownerUid)
        .get();
      ownerData = ownerDoc.exists ? ownerDoc.data()! : {};
    } else {
      // --- Path B: Caller passed a Firebase Auth UID ---
      const lookupDoc = await this.firestore.collection("users").doc(userId).get();
      if (!lookupDoc.exists) {
        throw new Error(`User not found: ${userId}`);
      }
      const lookupData = lookupDoc.data()!;
      tenantId = lookupData.tenantId;
      ownerUid = userId;

      if (!tenantId) {
        throw new Error(`User ${userId} has no associated tenant`);
      }

      // Fetch the tenant document for plan/subscription data
      const tenantDoc = await this.firestore.collection("tenants").doc(tenantId).get();
      tenantData = tenantDoc.exists ? tenantDoc.data()! : {};

      // Fetch the user's profile from the tenant subcollection
      const userProfileDoc = await this.firestore
        .collection("tenants")
        .doc(tenantId)
        .collection("users")
        .doc(ownerUid)
        .get();
      ownerData = userProfileDoc.exists ? userProfileDoc.data()! : lookupData;
    }

    // 3. Resolve plan from tenant (source of truth) or fall back to user data
    const plan = (tenantData.plan || ownerData.plan || "free") as PlanTier;

    // 4. Fetch Usage from the tenant-scoped usage subcollection
    const usageDoc = await this.firestore
      .collection("tenants")
      .doc(tenantId)
      .collection("usage")
      .doc("current")
      .get();

    const usageData = usageDoc.exists ? usageDoc.data()! : {};

    // 5. Construct Full UserContext
    const context: UserContext = {
      userId: tenantId,
      displayName: ownerData.displayName || tenantData.name || "User",
      email: ownerData.email || "",
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
        stripeCustomerId: tenantData.stripeCustomerId || null,
        stripeSubscriptionId: tenantData.stripeSubscriptionId || null,
        isActive: tenantData.subscriptionStatus === "active",
        isTrial: tenantData.subscriptionStatus === "trialing",
        trialEndsAt: tenantData.trialEndsAt?.toDate() || null,
        isOverLimit: false, // Calculated by usage trackers
      },
      meta: {
        createdAt: tenantData.createdAt?.toDate() || ownerData.createdAt?.toDate() || new Date(),
        lastActiveAt: new Date(),
        timezone: tenantData.settings?.timezone || "UTC",
      },
    };

    // 6. Cache result
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
