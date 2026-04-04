import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { ConfigService } from '../services/ConfigService.js';
import { cacheService } from '../services/cache.js';
import { parseDuration } from '../utils/time.js';

interface UserPayload {
    userId: string;
    email: string;
    tenantId: string;
    role: string;
    iat: number;
    exp: number;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: UserPayload;
        }
    }
}

/**
 * Middleware to authenticate requests using Custom JWT (issued by authController)
 * Expected Header: Authorization: Bearer <JWT>
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.token;
        const source = authHeader ? 'header' : (req.cookies?.token ? 'cookie' : 'none');

        const isMeRoute = req.path === '/me' || req.originalUrl?.endsWith('/me');

        if (!token) {
            if (isMeRoute) {
                return res.status(200).json({ success: true, data: { user: null } });
            }
            logger.security('Auth Middleware: Missing token', null, { ip: req.ip });
            return res.status(401).json({
                success: false,
                error: {
                    code: 'missing_token',
                    message: 'Access token required. Please log in again.'
                }
            });
        }

        const config = ConfigService.getInstance();
        const secret = config.get('JWT_SECRET');

        if (!secret) {
            logger.security('Auth Middleware: JWT_SECRET not configured', null, { ip: req.ip });
            return res.status(401).json({
                success: false,
                error: {
                    code: 'server_configuration_error',
                    message: 'Authentication system misconfigured. Please contact support.'
                }
            });
        }

        // Check Blacklist - Resilient
        try {
            const isBlacklisted = await cacheService.isTokenBlacklisted(token);
            if (isBlacklisted.success && isBlacklisted.data) {
                logger.security('Auth Middleware: Blacklisted token', null, { token: token.substring(0, 10) + '...', ip: req.ip });
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'token_revoked',
                        message: 'Your session has been revoked. Please log in again.'
                    }
                });
            }
        } catch (cacheError) {
            // Log but don't fail auth if cache is down
            logger.warn('Auth Middleware: Blacklist check skipped (cache unavailable)');
        }

        // Verify Custom JWT
        try {
            const decoded = jwt.verify(token, secret) as UserPayload;
            req.user = decoded;

            // --- Sliding Window Implementation ---
            // If the token is halfway to expiry (50% remains), we reissue the cookie to extend it.
            // This ensures active users rarely hit the 401/expired state.
            if (source === 'cookie' && decoded.exp && decoded.iat) {
                const totalLifetime = decoded.exp - decoded.iat;
                const currentTime = Math.floor(Date.now() / 1000);
                const remaining = decoded.exp - currentTime;
                const threshold = totalLifetime * 0.5; // 50% threshold for renewal

                if (remaining < threshold) {
                    // Optimized: Only renew if the token is at least 30 minutes old
                    // to prevent "burst" renewals from parallel requests.
                    const ageSeconds = currentTime - decoded.iat;
                    const MIN_RENEWAL_AGE_SEC = 30 * 60; // 30 minutes

                    if (ageSeconds > MIN_RENEWAL_AGE_SEC) {
                        try {
                            const jwtExpires = config.get('auth.jwtExpires') || '4h';
                            const jwtLifetimeMs = parseDuration(jwtExpires);

                            const newToken = jwt.sign(
                                {
                                    userId: decoded.userId,
                                    tenantId: decoded.tenantId,
                                    role: decoded.role,
                                    email: decoded.email
                                },
                                secret,
                                { expiresIn: jwtExpires }
                            );

                            res.cookie('token', newToken, {
                                httpOnly: true,
                                secure: process.env.NODE_ENV === 'production',
                                sameSite: 'strict',
                                maxAge: jwtLifetimeMs
                            });

                            logger.debug('Auth Middleware: Session sliding window extended (Threshold reached)', {
                                userId: decoded.userId,
                                remainingSeconds: remaining,
                                tokenAge: ageSeconds
                            });
                        } catch (renewalErr) {
                            // Non-fatal: log and continue with the existing valid token
                            logger.warn('Auth Middleware: Sliding window renewal failed, proceeding with current token', { error: renewalErr });
                        }
                    }
                }
            }

            return next();
        } catch (jwtError: unknown) {
            const name = jwtError instanceof Error ? jwtError.name : 'UnknownError';
            const message = jwtError instanceof Error ? jwtError.message : String(jwtError);

            if (isMeRoute) {
                return res.status(200).json({ success: true, data: { user: null } });
            }

            logger.security('Auth Middleware: Token verification failed', null, {
                error: message,
                type: name,
                source,
                ip: req.ip
            });

            if (name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'token_expired',
                        message: 'Your session has expired. Please log in again.'
                    }
                });
            }
            return res.status(401).json({
                success: false,
                error: {
                    code: 'invalid_token',
                    message: `Authentication failed: ${name}`,
                    details: 'The provided token is invalid or has been tampered with.'
                }
            });
        }

    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Auth Middleware Critical Error:', err);
        return res.status(500).json({ success: false, error: 'Internal server error in auth pipeline' });
    }
};

/**
 * Middleware to restrict access to specific roles
 */
export const authorizeRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'unauthorized',
                    message: 'Authentication required to access this resource.'
                }
            });
        }

        if (!roles.includes(user.role)) {
            logger.security('Auth Middleware: Insufficient permissions', user.userId, {
                requiredRoles: roles,
                userRole: user.role
            });

            const needsAdmin = roles.includes('admin');
            const message = needsAdmin
                ? 'This action requires Administrative privileges. Please contact your system administrator if you believe this is an error.'
                : `This action requires a higher permission level (${roles.join(' or ')}). Your current role is ${user.role}.`;

            return res.status(403).json({
                success: false,
                error: {
                    code: 'insufficient_permissions',
                    message: 'Access Denied',
                    details: message
                }
            });
        }

        next();
    };
};
