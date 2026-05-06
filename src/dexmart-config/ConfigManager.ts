import fs from "fs";
import path from "path";
import logger from "../utils/logger.js";
import { envSchema, EnvConfig } from "./env.schema.js";

export interface Config {
  system: {
    useServer: boolean;
    port: number;
    timeZone: string;
    maxListeners: number;
    cooldown: number;
    antiCall: boolean;
    selfMode: boolean;
    requireChannelGroupMembership: boolean;
    [key: string]: any;
  };
  owner: {
    name: string;
    id: string;
    organization: string;
    [key: string]: any;
  };
  server: {
    port: number;
    host: string;
    environment: string;
    maxRequestSize: string;
    cors: {
      origins: string[];
      credentials: boolean;
    };
    [key: string]: any;
  };
  database: {
    maxConnections: number;
    connectionTimeout: number;
    idleTimeout: number;
    ssl: boolean;
  };
  redis: {
    url: string | undefined;
    host: string;
    port: number;
    maxRetriesPerRequest: number;
    retryDelayOnFailover: number;
    family: number;
    password: string | undefined;
    keyPrefix: string;
  };
  auth: {
    jwtSecret: string | undefined;
    jwtExpires: string;
    refreshSecret: string | undefined;
    refreshExpires: string;
    sessionSecret: string | undefined;
    sessionMaxAge: number;
    bcryptRounds: number;
    ownerNumber: string | undefined;
    adminNumbers: string[];
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  channel: {
    name: string;
    browser: [string, string, string];
    prefix: string[];
    mode: string;
    selfMode: boolean;
    maxCommandsPerMinute: number;
    cooldownMs: number;
    maintenance: boolean;
    autoReconnect: boolean;
    sessionPath: string;
    authAdapter: {
      default: {
        authDir: string;
      };
      [key: string]: any;
    };
  };
  ai: {
    google: {
      apiKey: string | undefined;
      model: string;
      maxTokens: number;
      temperature: number;
    };

    summarization: {
      SUMMARIZE_THRESHOLD: number;
      MESSAGES_TO_SUMMARIZE: number;
      HISTORY_PRUNE_LENGTH: number;
    };
    maxSpawnDepth: number;
    aiKeywords: string[];
  };
  payment: {
    stripe: {
      secretKey: string | undefined;
      publishableKey: string | undefined;
      webhookSecret: string | undefined;
      currency: string;
    };
    premium: {
      enabled: boolean;
      monthlyPrice: number;
      yearlyPrice: number;
      trialDays: number;
    };
  };
  monitoring: {
    enabled: boolean;
    metricsPort: number;
    healthCheckEnabled: boolean;
    logLevel: string;
    sentryDsn: string | undefined;
    enablePrometheus: boolean;
  };
  features: {
    aiCommands: boolean;
    downloadCommands: boolean;
    gameCommands: boolean;
    moderationCommands: boolean;
    analyticsTracking: boolean;
    websocketEnabled: boolean;
  };
  memory: {
    maxChatHistory: number;
    chatHistoryTTL: number;
    cacheMaxSize: number;
    cleanupInterval: number;
    maxMemoryUsage: number;
  };
  [key: string]: any;
}

export class ConfigManager {
  public config: Config;
  private configPath: string;
  private environment: string;
  private env: EnvConfig;

  constructor() {
    this.config = {} as Config;
    this.configPath = process.env.CONFIG_PATH || "./config";
    this.environment = process.env.NODE_ENV || "development";

    try {
      this.env = envSchema.parse(process.env);
      logger.info("✅ Environment variables validated via Zod");
    } catch (error: any) {
      logger.error("❌ Environment validation failed:", error.message);
      // Fallback or rethrow based on environment
      if (this.environment === "production") throw error;
      this.env = envSchema.parse({}); // Use defaults in dev
    }

    this.loadConfiguration();
    this.validateConfiguration();
  }

  loadConfiguration() {
    // Load base configuration from validated env
    this.config = {
      system: {
        useServer: this.env.USE_SERVER,
        port: this.env.PORT,
        timeZone: this.env.TIME_ZONE,
        maxListeners: this.env.MAX_LISTENERS,
        cooldown: this.env.CHANNEL_COOLDOWN_MS,
        antiCall: true,
        selfMode: this.env.SELF_OWNER,
        requireChannelGroupMembership: this.env.REQUIRE_CHANNEL_GROUP_MEMBERSHIP,
      },
      owner: {
        name: process.env.OWNER_NAME || "Owner",
        id: process.env.OWNER_NUMBER || "",
        organization: process.env.OWNER_ORGANIZATION || "CodeDeX",
      },
      // Server Configuration
      server: {
        port: this.env.PORT,
        host: process.env.HOST || "127.0.0.1",
        environment: this.environment,
        maxRequestSize: process.env.MAX_REQUEST_SIZE || "50mb",
        cors: {
          origins: (process.env.CORS_ORIGINS || "http://127.0.0.1:3000")
            .split(",")
            .map((o) => o.trim()),
          credentials: true,
        },
      },

      // Database Configuration
      database: {
        maxConnections: 20,
        connectionTimeout: 2000,
        idleTimeout: 30000,
        ssl: false,
      },

      // Redis Configuration
      redis: {
        url: this.env.REDIS_URL,
        host: this.env.REDIS_HOST,
        port: this.env.REDIS_PORT,
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        family: 4,
        password: this.env.REDIS_PASSWORD,
        keyPrefix: "whatsdx:",
      },

      // Authentication & Security
      auth: {
        jwtSecret: this.env.JWT_SECRET,
        jwtExpires: "4h",
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        refreshExpires: "7d",
        sessionSecret: process.env.SESSION_SECRET,
        sessionMaxAge: 7 * 24 * 60 * 60 * 1000,
        bcryptRounds: 12,
        ownerNumber: process.env.OWNER_NUMBER,
        adminNumbers: (process.env.ADMIN_NUMBERS || "")
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean),
      },

      // Rate Limiting
      rateLimit: {
        windowMs: 900000, // 15 minutes
        maxRequests: this.env.RATE_LIMIT_MAX,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
      },

      // Channel Configuration
      channel: {
        name: this.env.CHANNEL_NAME,
        browser: ["DeXMart", "Chrome", "1.0.0"],
        prefix: this.env.CHANNEL_PREFIX.startsWith("^")
          ? [this.env.CHANNEL_PREFIX]
          : this.env.CHANNEL_PREFIX.split(""),
        mode: "public",
        selfMode: this.env.SELF_OWNER,
        maxCommandsPerMinute: 60,
        cooldownMs: this.env.CHANNEL_COOLDOWN_MS,
        maintenance: false,
        autoReconnect: true,
        sessionPath: "./sessions",
        authAdapter: {
          default: {
            authDir: "./auth",
          },
        },
      },

      // AI Services
      ai: {
        google: {
          apiKey: this.env.GOOGLE_GEMINI_API_KEY,
          model: this.env.GEMINI_MODEL,
          maxTokens: this.env.GEMINI_MAX_TOKENS,
          temperature: this.env.GEMINI_TEMP,
        },

        summarization: {
          SUMMARIZE_THRESHOLD: this.env.AI_SUMMARIZE_THRESHOLD,
          MESSAGES_TO_SUMMARIZE: this.env.AI_MESSAGES_TO_SUMMARIZE,
          HISTORY_PRUNE_LENGTH: this.env.AI_HISTORY_PRUNE_LENGTH,
        },
        maxSpawnDepth: this.env.AI_MAX_SPAWN_DEPTH,
        aiKeywords: [],
      },

      // Payment Configuration
      payment: {
        stripe: {
          secretKey: this.env.STRIPE_SECRET_KEY,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
          webhookSecret: this.env.STRIPE_WEBHOOK_SECRET,
          currency: "USD",
        },
        premium: {
          enabled: true,
          monthlyPrice: 4.99,
          yearlyPrice: 49.99,
          trialDays: 7,
        },
      },

      // Monitoring & Analytics
      monitoring: {
        enabled: true,
        metricsPort: 9090,
        healthCheckEnabled: true,
        logLevel: "info",
        sentryDsn: process.env.SENTRY_DSN,
        enablePrometheus: false,
      },

      // Feature Flags
      features: {
        aiCommands: true,
        downloadCommands: true,
        gameCommands: true,
        moderationCommands: true,
        analyticsTracking: true,
        websocketEnabled: true,
      },

      // Memory Management
      memory: {
        maxChatHistory: 50,
        chatHistoryTTL: 3600000, // 1 hour
        cacheMaxSize: 1000,
        cleanupInterval: 300000, // 5 minutes
        maxMemoryUsage: 512, // MB
      },
    };

    // Load environment-specific overrides
    this.loadEnvironmentConfig();
  }

  loadEnvironmentConfig() {
    const envConfigPath = path.join(this.configPath, `${this.environment}.json`);

    if (fs.existsSync(envConfigPath)) {
      try {
        const envConfig = JSON.parse(fs.readFileSync(envConfigPath, "utf8"));
        this.config = this.mergeDeep(this.config, envConfig);
        logger.info(`✅ Loaded ${this.environment} configuration`);
      } catch (error: any) {
        logger.warn(`⚠️ Failed to load ${this.environment} config:`, error.message);
      }
    }
  }

  validateConfiguration() {
    // Only require JWT_SECRET for auth infrastructure
    const required: string[] = [];

    if (this.environment !== "test") {
      if (!this.env.JWT_SECRET || this.env.JWT_SECRET === "secret") {
        const msg =
          "⚠️ JWT_SECRET is missing or using default value! Tokens will be signed with an insecure key.";
        if (this.environment === "production") {
          logger.error(msg);
          throw new Error("JWT_SECRET must be set to a secure value in production");
        }
        logger.warn(msg);
      } else {
        logger.debug(`🔐 JWT_SECRET loaded (${this.env.JWT_SECRET.length} chars)`);
      }
    }

    if (this.environment === "production" && !this.env.REDIS_URL) {
      logger.error("❌ REDIS_URL is required in production");
      throw new Error("REDIS_URL is required in production");
    }

    // If REDIS_URL is missing but we have host/port, construct it
    if (!this.config.redis.url && this.config.redis.host) {
      const auth = this.config.redis.password ? `:${this.config.redis.password}@` : "";
      this.config.redis.url = `redis://${auth}${this.config.redis.host}:${this.config.redis.port}`;
      logger.info("🔗 Constructed internal REDIS_URL from host and port configuration");
    }

    logger.info("✅ Configuration validation passed");
  }

  get(path: string): any {
    return this.getNestedValue(this.config, path);
  }

  set(path: string, value: any) {
    this.setNestedValue(this.config, path, value);
  }

  getNestedValue(obj: any, path: string): any {
    const value = path.split(".").reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);

    // Fallback: If not found in config object, check if it's a flat env key in this.env
    if (value === undefined && (this.env as any)[path] !== undefined) {
      return (this.env as any)[path];
    }

    return value;
  }

  setNestedValue(obj: any, path: string, value: any) {
    const keys = path.split(".");
    const lastKey = keys.pop();
    if (!lastKey) return;
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  mergeDeep(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] instanceof Object && !Array.isArray(source[key])) {
        result[key] = this.mergeDeep(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  export(): Config {
    return JSON.parse(JSON.stringify(this.config));
  }

  getSafeConfig(): Partial<Config> {
    const safe = JSON.parse(JSON.stringify(this.config));
    if (safe.auth) {
      delete safe.auth.jwtSecret;
      delete safe.auth.refreshSecret;
      delete safe.auth.sessionSecret;
    }
    if (safe.ai && safe.ai.google) {
      delete safe.ai.google.apiKey;
    }
    if (safe.payment && safe.payment.stripe) {
      delete safe.payment.stripe.secretKey;
      delete safe.payment.stripe.webhookSecret;
    }
    return safe;
  }
}

const configManager = new ConfigManager();
export default configManager;
