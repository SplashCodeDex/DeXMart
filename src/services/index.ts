/**
 * @fileoverview Services Barrel Export
 * Centralized exports for all services in backend/src/services
 *
 * Usage: import { AnalyticsService, CacheService } from './services/index.js';
 */

// Core Services
export { default as AnalyticsService } from './analytics.js';
export { default as DatabaseService } from './database.js';
export { default as CacheService } from './cache.js';

// AI Services
export { default as GeminiAI, geminiAI } from './geminiAI.js';
export { GeminiAI as EnhancedAIBrain } from './geminiAI.js'; // Legacy alias

// Bot Services (Omnichannel 2026)
export { default as CommandSystem } from './commandSystem.js';
export { default as MultiTenantService } from './multiTenantService.js';
export { default as ChannelService } from './ChannelService.js';
export { default as AgentService } from './AgentService.js';
export { default as IngressService } from './IngressService.js';

// Payment/Subscription
export { default as StripeService } from './stripeService.js';

// Utility Services
export { default as RateLimiter } from './rateLimiter.js';
export { default as JobQueue } from './jobQueue.js';
// export { default as MessageQueue } from './messageQueue.js';
export { default as ErrorHandler } from './errorHandler.js';

// Monitoring
export { default as HealthCheckService } from './healthCheckService.js';
export { default as MonitoringService } from './monitoring.js';
export { default as AuditService } from './auditService.js';

// Content Services
export { default as StickerService } from './stickerService.js';
export { default as ContentModeration } from './contentModeration.js';

// Auth
export { default as InteractiveAuth } from './interactiveAuth.js';
export { default as AuthSystem } from './authSystem.js';

// User/Settings
export { default as UserService } from './userService.js';
export { default as SettingsService } from './settingsService.js';
