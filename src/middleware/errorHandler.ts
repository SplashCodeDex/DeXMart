import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import { isBoom } from '@hapi/boom';
import { ZodError } from 'zod';

/**
 * Global Error Handler (2026 Best Practice)
 * Handles Boom errors and standardizes error responses
 */
export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction) => {
    let statusCode = 500;
    let payload: Record<string, unknown> = {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
    };

    if (isBoom(error)) {
        statusCode = error.output.statusCode;
        payload = {
            error: error.output.payload.error,
            message: error.message,
            ...(error.data && { details: error.data })
        };
    } else if (error instanceof ZodError) {
        statusCode = 400;
        payload.error = 'Bad Request';
        payload.message = 'Validation failed';
        payload.details = error.issues;
    } else if (error instanceof Error) {
        payload.message = error.message;
    }

    logger.error(`[ErrorHandler] ${req.method} ${req.path}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        statusCode
    });

    res.status(statusCode).json({
        success: false,
        ...payload,
        ...(process.env.NODE_ENV === 'development' && error instanceof Error && { stack: error.stack })
    });
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.path} not found`
    });
};
