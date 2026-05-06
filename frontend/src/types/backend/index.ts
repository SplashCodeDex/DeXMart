// Backend API Interface Definitions
// Mirrors backend/src/types/contracts.ts + Controller Responses

export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E | string;
  meta?: unknown;
}

// Analytics Controller
export interface DashboardStats {
  totalBots: number;
  activeBots: number;
  totalMessages: number;
  totalContacts: number;
  systemHealth: "Healthy" | "Degraded";
  metrics: unknown;
}

// Contact Controller
export interface Contact {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  attributes?: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Campaign Controller
export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  templateId: string;
  audience: {
    type: "groups" | "contacts" | "audience";
    targetId: string;
  };
  distribution: {
    type: "single" | "pool";
    botId?: string;
  };
  schedule: {
    type: "immediate" | "scheduled";
    scheduledAt?: string;
  };
  stats: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
  };
  status: "draft" | "pending" | "sending" | "completed" | "paused" | "error" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

// Tenant Settings Controller
export interface TenantSettings {
  maxBots: number;
  aiEnabled: boolean;
  customPairingCode?: string;
  timezone?: string;
  ownerName?: string;
  ownerNumber?: string;
}
