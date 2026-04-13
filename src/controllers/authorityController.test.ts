import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../tenancy/resolver-instance.js', () => ({
  userContextResolver: { fromUserId: vi.fn() },
}));

vi.mock('../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { AuthorityController } from './authorityController.js';
import { userContextResolver } from '../tenancy/resolver-instance.js';

const mockRes = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('AuthorityController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no user on request', async () => {
    const req: any = { user: undefined };
    const res = mockRes();
    await AuthorityController.getCapabilities(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns capabilities from UserContext', async () => {
    const ctx = { plan: 'pro', capabilities: { maxMessages: 10000 } };
    vi.mocked(userContextResolver.fromUserId).mockResolvedValue(ctx as any);

    const req: any = { user: { tenantId: 'user-123' } };
    const res = mockRes();
    await AuthorityController.getCapabilities(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { tier: 'pro', capabilities: ctx.capabilities },
    });
  });

  it('returns 500 on resolver error', async () => {
    vi.mocked(userContextResolver.fromUserId).mockRejectedValue(new Error('DB error'));

    const req: any = { user: { tenantId: 'user-123' } };
    const res = mockRes();
    await AuthorityController.getCapabilities(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
