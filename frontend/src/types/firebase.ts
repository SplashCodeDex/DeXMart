/**
 * Firebase/Firestore Document Types
 *
 * These types mirror the Firestore document schemas.
 * All documents follow the subcollection multi-tenancy pattern:
 * tenants/{tenantId}/{collection}/{docId}
 */

import type { Timestamp } from "firebase/firestore";

/**
 * Base document fields present in all Firestore documents
 */
export interface BaseDocument {
  readonly id: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * User document (tenants/{tenantId}/users/{userId})
 */
export interface UserDocument extends BaseDocument {
  email: string;
  displayName: string;
  photoURL?: string;
  role: "owner" | "admin" | "member";
  status: "active" | "inactive" | "suspended";
  lastLoginAt?: Timestamp;
}

/**
 * Bot document (tenants/{tenantId}/bots/{botId})
 */
export interface BotDocument extends BaseDocument {
  name: string;
  phoneNumber?: string;
  status: "connected" | "disconnected" | "connecting" | "qr_pending";
  lastSeenAt?: Timestamp;
  settings: {
    autoReply: boolean;
    welcomeMessage?: string;
    awayMessage?: string;
  };
}

/**
 * Message document (tenants/{tenantId}/messages/{messageId})
 */
export interface MessageDocument extends BaseDocument {
  botId: string;
  remoteJid: string;
  fromMe: boolean;
  type: "text" | "image" | "video" | "audio" | "document" | "sticker";
  content: string;
  mediaUrl?: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  timestamp: Timestamp;
}

/**
 * Tenant document (tenants/{tenantId})
 */
export interface TenantDocument extends BaseDocument {
  name: string;
  slug: string;
  ownerId: string;
  plan: "free" | "pro" | "enterprise";
  limits: {
    maxBots: number;
    maxMessagesPerDay: number;
    maxTeamMembers: number;
  };
  billing: {
    customerId?: string;
    subscriptionId?: string;
    status: "active" | "past_due" | "canceled" | "trialing";
  };
}
