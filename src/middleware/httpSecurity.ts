import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.js';
import { ConfigService } from '../services/ConfigService.js';

const config = ConfigService.getInstance();

/**
 * CSRF Protection Middleware
 * Validates Origin and Referer headers against the allowed app URL.
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
    // 1. Skip check for non-mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return next();
    }

    // 2. Skip check for logout (Safe destructive action)
    if (req.path === '/logout' || req.originalUrl?.endsWith('/logout')) {
        return next();
    }

    const origin = req.get('Origin');
    const referer = req.get('Referer');
    const allowedOrigin = config.get('NEXT_PUBLIC_APP_URL');

    // 1. Origin Check (Primary)
    if (origin) {
        const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
        if (origin !== allowedOrigin && !isLocalhost) {
            logger.warn(`Potential CSRF attack blocked: Origin mismatch. Origin: ${origin}, Expected: ${allowedOrigin}`);
            return res.status(403).json({ success: false, error: 'Forbidden: CSRF protection' });
        }
    }

    // 2. Referer Check (Fallback)
    if (!origin && referer) {
        try {
            const refererUrl = new URL(referer);
            const isLocalhost = refererUrl.origin.includes('localhost') || refererUrl.origin.includes('127.0.0.1');
            if (refererUrl.origin !== allowedOrigin && !isLocalhost) {
                logger.warn(`Potential CSRF attack blocked: Referer mismatch. Referer: ${referer}, Expected: ${allowedOrigin}`);
                return res.status(403).json({ success: false, error: 'Forbidden: CSRF protection' });
            }
        } catch (e) {
            logger.error('Error parsing referer for CSRF check', e);
            return res.status(403).json({ success: false, error: 'Forbidden: CSRF protection (Invalid Referer)' });
        }
    }

    // 3. Block if both are missing (Optional, but safer for API-only if stateful)
    if (!origin && !referer) {
        logger.info('Mutating request without Origin/Referer header', { path: req.path });
    }

    next();
};

/**
 * Specialized Rate Limiter for Authentication endpoints
 * Much stricter than global limits (e.g., 10 attempts per 15 mins)
 */
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many authentication attempts. Please try again in 15 minutes.'
    },
    handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
        logger.warn(`Auth rate limit exceeded for IP: ${req.ip} on ${req.originalUrl}`);
        res.status(options.statusCode).json(options.message);
    }
});

/**
 * Security Headers Middleware (Supplement to Helmet)
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
};
