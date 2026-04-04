/**
 * Centralized Error Handling Service
 */

import logger from '../utils/logger.js';
import { Result } from '../types/index.js';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public timestamp: string;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() { }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  public handleOperationalError(error: Error | unknown, context = {}): Result<never> {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Operational Error:', { message: err.message, context });
    return { success: false, error: err };
  }

  public getUserFriendlyMessage(error: unknown): string {
    if (error instanceof AppError) return error.message;
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'An unexpected error occurred';
  }

  /**
   * WhatsApp command error handler
   */
  public async handleCommandError(ctx: any, error: unknown): Promise<void> {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Command Error:', {
      command: ctx.used?.command,
      user: ctx.sender?.jid,
      message: err.message
    });

    const userMessage = `❎ Error: ${this.getUserFriendlyMessage(err)}`;
    await ctx.reply(userMessage);
  }
}

export const errorHandler = ErrorHandler.getInstance();
export default errorHandler;
