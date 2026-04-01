import { Timestamp } from 'firebase-admin/firestore';
import { ModerationItem, Violation, Campaign, Webhook, Contact, Audience, MessageTemplate, LearningData, AnalyticsData } from './contracts.js';

/**
 * Root 'tenants' collection document
 */
export interface TenantDocument {
  id: string;
  name: string;
  subdomain: string;
  plan: 'starter' | 'pro' | 'enterprise';
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused';
  status: 'active' | 'suspended' | 'cancelled';
  ownerId: string; // Firebase Auth UID
  stripeCustomerId?: string;
  trialEndsAt?: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  settings: {
    maxChannels: number;
    aiEnabled: boolean;
    customPairingCode?: string;
    timezone: string;
  };
}

/**
 * 'tenants/{tenantId}/users' subcollection document
 */
export interface TenantUserDocument {
  id: string; // Firebase Auth UID
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'viewer';
  plan: 'starter' | 'pro' | 'enterprise';
  subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused';
  trialEndsAt?: Timestamp | Date;
  joinedAt: Timestamp | Date;
  lastLogin?: Timestamp | Date;
  photoURL?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * 'tenants/{tenantId}/channels' subcollection document
 */
export interface ChannelDocument {
  id: string;
  name: string;
  type: 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'signal';
  phoneNumber?: string;
  identifier?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_pending' | 'error';
  lastSeenAt?: Timestamp | Date;
  connectionMetadata?: {
    browser?: [string, string, string];
    platform?: string;
  };
  credentials?: Record<string, any>;
  webhookUrl?: string;
  assignedAgentId?: string | null;
  stats: {
    messagesSent: number;
    messagesReceived: number;
    contactsCount: number;
    lastMessageAt?: Timestamp | Date | null;
    errorsCount: number;
  };
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

/**
 * 'tenants/{tenantId}/agents' subcollection document
 */
export interface AgentDocument {
  id: string;
  name: string;
  personality?: string;
  soul?: string;
  memorySearch: boolean;
  boundChannels: string[];
  skills: string[];
  metadata?: Record<string, unknown>;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

/**
 * 'tenants/{tenantId}/channels' subcollection document
 * @deprecated Use ChannelDocument instead.
 */
export type ChannelInstanceDocument = ChannelDocument;

/**
 * 'tenants/{tenantId}/members' subcollection document (WhatsApp users)
 */
export interface ChannelMemberDocument {
  id: string; // JID
  username?: string;
  coin: number;
  level: number;
  winGame: number;
  autolevelup?: boolean;
  banned?: boolean;
  afk?: {
    reason: string | null;
    timestamp: number;
  } | null;
  lastClaim?: Record<string, number>;
  lastSentMsg?: Record<string, unknown>;
  recentCommands?: unknown[];
  premium: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

/**
 * 'tenants/{tenantId}/groups' subcollection document
 */
export interface ChannelGroupDocument {
  id: string; // Group JID
  name: string;
  isBanned: boolean;
  prefix?: string;
  welcomeMessage?: string;
  settings?: {
    welcome?: {
      enabled: boolean;
      message: string;
      leaveMessage: string;
    };
    [key: string]: unknown;
  };
  metadata?: Record<string, unknown>;
  syncedAt?: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

/**
 * 'tenants/{tenantId}/subscriptions' subcollection document
 */
export interface SubscriptionDocument {
  id: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'trialing' | 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused';
  currentPeriodStart: Timestamp | Date;
  currentPeriodEnd: Timestamp | Date;
  trialStart?: Timestamp | Date;
  trialEnd?: Timestamp | Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

/**
 * Generic type for Firestore collections mapping
 */
export interface FirestoreSchema {
  tenants: TenantDocument;
  'tenants/{tenantId}/users': TenantUserDocument;
  'tenants/{tenantId}/channels': ChannelDocument;
  'tenants/{tenantId}/agents': AgentDocument;
  'tenants/{tenantId}/agents/{agentId}/channels': ChannelDocument;
  'tenants/{tenantId}/agents/{agentId}/channels/{channelId}/auth': { value: any };
  'tenants/{tenantId}/slots': ChannelInstanceDocument;
  'tenants/{tenantId}/members': ChannelMemberDocument;
  'tenants/{tenantId}/groups': ChannelGroupDocument;
  'tenants/{tenantId}/subscriptions': SubscriptionDocument;
  'tenants/{tenantId}/moderation': ModerationItem;
  'tenants/{tenantId}/violations': Violation;
  'tenants/{tenantId}/campaigns': Campaign;
  'tenants/{tenantId}/webhooks': Webhook;
  'tenants/{tenantId}/contacts': Contact;
  'tenants/{tenantId}/audiences': Audience;
  'tenants/{tenantId}/templates': MessageTemplate;
  'tenants/{tenantId}/channels/{channelId}/auth': { value: any };
  'tenants/{tenantId}/learning': LearningData;
  'tenants/{tenantId}/analytics': AnalyticsData;
}
