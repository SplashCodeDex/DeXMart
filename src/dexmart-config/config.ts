// Import necessary modules and dependencies
import logger from '../utils/logger.js';

interface FormatterType {
  quote: (text: string) => string;
  italic: (text: string) => string;
  bold: (text: string) => string;
  monospace: (text: string) => string;
}

const Formatter: FormatterType = {
  quote: (text: string) => `_${text}_`,
  italic: (text: string) => `_${text}_`,
  bold: (text: string) => `*${text}*`,
  monospace: (text: string) => `\`\`${text}\`\``,
};


// Configuration
import { configService } from '../services/ConfigService.js';

export default {
  // Basic bot information
  bot: configService.get('channel') || {},

  // Custom bot messages for specific situations
  msg: configService.msg,

  // Bot sticker
  sticker: {
    packname: 'DeXMart Sticker Pack',
    author: 'CodeDeX',
  },

  // API keys for various services
  api: {
    gemini: configService.get('GOOGLE_GEMINI_API_KEY') || '',
  },

  // AI configuration
  ai: configService.ai,

  // Redis configuration
  redis: {
    host: configService.get('REDIS_HOST'),
    port: configService.get('REDIS_PORT'),
    password: configService.get('REDIS_PASSWORD'),
  },

  // Rate limit configuration
  rateLimits: {
    global: { requests: configService.get('RATE_LIMIT_GLOBAL_REQ'), window: 60 },
    user: { requests: configService.get('RATE_LIMIT_USER_REQ'), window: 60 },
    command: { requests: configService.get('RATE_LIMIT_CMD_REQ'), window: 60 },
    ai: { requests: configService.get('RATE_LIMIT_AI_REQ'), window: 300 },
    download: { requests: configService.get('RATE_LIMIT_DOWNLOAD_REQ'), window: 60 },
    premium: { requests: configService.get('RATE_LIMIT_PREMIUM_REQ'), window: 60 }
  },

  // Bot system
  system: configService.system,

  // Connection configuration
  connection: {
    maxRetries: configService.get('CONN_MAX_RETRIES'),
    baseDelay: configService.get('CONN_BASE_DELAY'),
    maxDelay: configService.get('CONN_MAX_DELAY'),
    backoffMultiplier: configService.get('CONN_BACKOFF_MULTIPLIER'),
    circuitBreakerThreshold: configService.get('CONN_CB_THRESHOLD'),
    circuitBreakerTimeout: configService.get('CONN_CB_TIMEOUT'),
  },
};
