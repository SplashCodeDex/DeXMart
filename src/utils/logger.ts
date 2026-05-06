import fs from "node:fs";
import path from "node:path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { SERVER_CONFIG } from "../dexmart-config/constants.js";

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "blue",
};

winston.addColors(colors);

// Define the format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
);

// Create the logger
const winstonLogger = winston.createLogger({
  level: SERVER_CONFIG.LOG_LEVEL,
  levels,
  format,
  transports: [
    new winston.transports.Console({
      level: process.env.CONSOLE_LOG_LEVEL || "info",
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new DailyRotateFile({
      filename: path.join(process.cwd(), SERVER_CONFIG.LOG_DIR, "app-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
      level: "debug",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
    }),
    new DailyRotateFile({
      filename: path.join(process.cwd(), SERVER_CONFIG.LOG_DIR, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
      level: "error",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
    }),
    new DailyRotateFile({
      filename: path.join(process.cwd(), SERVER_CONFIG.LOG_DIR, "http-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
      level: "http",
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
  ],
});

// Ensure logs directory exists
try {
  const logsDir = path.join(process.cwd(), SERVER_CONFIG.LOG_DIR);
  if (fs && typeof fs.existsSync === "function" && !fs.existsSync(logsDir)) {
    if (typeof fs.mkdirSync === "function") {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }
} catch (error: unknown) {
  // Silent fail during tests if fs is weirdly mocked
  if (process.env.NODE_ENV !== "test") {
    console.error(
      "❌ Warning: Failed to create logs directory:",
      error instanceof Error ? error.message : error,
    );
  }
}

// Enhanced logger interface
export interface Logger {
  error: (message: unknown, meta?: unknown) => void;
  warn: (message: unknown, meta?: unknown) => void;
  info: (message: unknown, meta?: unknown) => void;
  http: (message: unknown, meta?: unknown) => void;
  debug: (message: unknown, meta?: unknown) => void;
  trace: (message: unknown, meta?: unknown) => void;
  command: (
    command: string,
    userId: string,
    success?: boolean,
    executionTime?: number | null,
    error?: unknown,
  ) => void;
  userActivity: (userId: string, action: string, details?: unknown) => void;
  groupActivity: (groupId: string, action: string, userId: string, details?: unknown) => void;
  apiRequest: (
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    userId?: string | null,
  ) => void;
  performance: (operation: string, duration: number, metadata?: unknown) => void;
  security: (event: string, userId?: string | null, details?: unknown) => void;
  withContext: (context: Record<string, unknown>) => Logger;
  child: (meta?: unknown) => Logger;
  stream: { write: (message: string) => void };
  [key: string]: unknown;
}

// Helper to redact sensitive information (Scenario 35)
const redactSecrets = (obj: any): any => {
  if (!obj || typeof obj !== "object") return obj;
  const sensitiveKeys = [
    /secret/i,
    /key/i,
    /password/i,
    /token/i,
    /auth/i,
    /credential/i,
    /private/i,
  ];
  const redacted = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in redacted) {
    if (sensitiveKeys.some((regex) => regex.test(key))) {
      redacted[key] = "[REDACTED]";
    } else if (typeof redacted[key] === "object") {
      redacted[key] = redactSecrets(redacted[key]);
    }
  }
  return redacted;
};

// Helper to ensure meta is an object for winston
const toMeta = (meta: unknown): Record<string, unknown> | undefined => {
  if (meta === null || meta === undefined) return undefined;
  if (meta instanceof Error) return { error: meta.message, stack: meta.stack };
  const baseMeta = typeof meta === "object" ? (meta as Record<string, unknown>) : { data: meta };
  return redactSecrets(baseMeta);
};

// Enhanced logger implementation
const enhancedLogger: Logger = {
  error: (message, meta) => {
    winstonLogger.error(String(message), toMeta(meta));
  },
  warn: (message, meta) => {
    winstonLogger.warn(String(message), toMeta(meta));
  },
  info: (message, meta) => {
    winstonLogger.info(String(message), toMeta(meta));
  },
  http: (message, meta) => {
    winstonLogger.http(String(message), toMeta(meta));
  },
  debug: (message, meta) => {
    winstonLogger.debug(String(message), toMeta(meta));
  },
  trace: (message, meta) => {
    winstonLogger.debug(String(message), toMeta(meta));
  },

  command: (command, userId, success = true, executionTime = null, error = null) => {
    const level = success ? "info" : "error";
    const messageTxt = `Command: ${command} | User: ${userId} | Success: ${success}`;
    const metaData = {
      command,
      userId,
      success,
      executionTime,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    };
    winstonLogger.log(level, messageTxt, metaData);
  },

  userActivity: (userId, action, details) => {
    winstonLogger.info(`User Activity: ${action} | User: ${userId}`, {
      userId,
      action,
      ...toMeta(details),
    });
  },

  groupActivity: (groupId, action, userId, details) => {
    winstonLogger.info(`Group Activity: ${action} | Group: ${groupId} | User: ${userId}`, {
      groupId,
      userId,
      action,
      ...toMeta(details),
    });
  },

  apiRequest: (method, url, statusCode, responseTime, userId = null) => {
    const level = statusCode >= 400 ? "warn" : "http";
    winstonLogger.log(level, `${method} ${url} ${statusCode} ${responseTime}ms`, {
      method,
      url,
      statusCode,
      responseTime,
      userId,
    });
  },

  performance: (operation, duration, metadata) => {
    const meta: any = toMeta(metadata) || {};
    const unit = meta.unit || "ms";
    winstonLogger.info(`Performance: ${operation} = ${duration} ${unit}`, {
      operation,
      duration,
      ...meta,
    });
  },

  security: (event, userId = null, details) => {
    winstonLogger.warn(`Security Event: ${event}`, { userId, event, ...toMeta(details) });
  },

  withContext: (context) => ({
    ...enhancedLogger,
    error: (msg, mt) => enhancedLogger.error(msg, { ...context, ...toMeta(mt) }),
    warn: (msg, mt) => enhancedLogger.warn(msg, { ...context, ...toMeta(mt) }),
    info: (msg, mt) => enhancedLogger.info(msg, { ...context, ...toMeta(mt) }),
    debug: (msg, mt) => enhancedLogger.debug(msg, { ...context, ...toMeta(mt) }),
    trace: (msg, mt) => enhancedLogger.debug(msg, { ...context, ...toMeta(mt) }),
  }),

  child: (meta) => enhancedLogger.withContext(toMeta(meta) || {}),

  stream: {
    write: (message) => {
      winstonLogger.http(message.trim());
    },
  },
};

export { enhancedLogger as logger };
export default enhancedLogger;
