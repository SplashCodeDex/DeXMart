import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticateToken } from './authMiddleware.js';
import jwt from 'jsonwebtoken';
import { ConfigService } from '../services/ConfigService.js';
import logger from '../utils/logger.js';

// Mock ConfigService
vi.mock('../services/ConfigService.js', () => {
  const mockGet = vi.fn((key: string) => {
    if (key === 'JWT_SECRET') return 'test-secret';
    return null;
  });
  const mockConfig = {
    get: mockGet,
  };
  return {
    ConfigService: {
      getInstance: vi.fn(() => mockConfig),
      resetInstance: vi.fn(),
    },
    default: mockConfig
  };
});

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

// Mock cacheService
vi.mock('../services/cache.js', () => ({
  cacheService: {
    isTokenBlacklisted: vi.fn().mockResolvedValue({ success: true, data: false }),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  default: {
    security: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('authMiddleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    req = {
      headers: {},
      cookies: {},
      ip: '127.0.0.1',
      path: '/test',
      originalUrl: '/test'
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it('should return 401 if no token is provided', async () => {
    await authenticateToken(req, res, next);
    // If it receives 500, let's see why
    if (vi.mocked(logger.error).mock.calls.length > 0) {
        console.log('Auth error:', vi.mocked(logger.error).mock.calls[0]);
    }
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 403 if token verification fails', async () => {
    req.headers['authorization'] = 'Bearer invalid-token';
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 401 if token is expired', async () => {
    req.headers['authorization'] = 'Bearer expired-token';
    vi.mocked(jwt.verify).mockImplementation(() => {
      const err = new Error('Expired') as any;
      err.name = 'TokenExpiredError';
      throw err;
    });

    await authenticateToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should call next() and populate req.user if token is valid', async () => {
    req.headers['authorization'] = 'Bearer valid-token';
    const decodedUser = { userId: 'user-123', email: 'test@example.com', tenantId: 'tenant-abc', role: 'user' };
    vi.mocked(jwt.verify).mockReturnValue(decodedUser as any);

    await authenticateToken(req, res, next);
    
    expect(req.user).toEqual(decodedUser);
    expect(next).toHaveBeenCalled();
  });
});
