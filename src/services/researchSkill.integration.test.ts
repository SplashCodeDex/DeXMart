import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResearchSkill } from './researchSkill.js';
import { toolRegistry } from './toolRegistry.js';

vi.mock('./toolRegistry.js', () => ({
  toolRegistry: {
    executeTool: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ResearchSkill Integration', () => {
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      tenantId: 'tenant-123',
      channelId: 'channel-1',
      userId: 'user-1'
    };
  });

  it('should successfully orchestrate a full research cycle (Researcher -> Auditor -> Synthesis)', async () => {
    // 1. Mock Researcher output
    (toolRegistry.executeTool as any).mockResolvedValueOnce({
      text: 'Original research finding: AI will replace all keyboards with drums by 2027.',
      sessionKey: 'session-researcher'
    });

    // 2. Mock Auditor output (fixing the hallucination)
    (toolRegistry.executeTool as any).mockResolvedValueOnce({
      text: 'AUDIT: The drum part is a hallucination. Revised: AI will improve developer productivity.',
      sessionKey: 'session-auditor'
    });

    // 3. Mock Synthesis output
    (toolRegistry.executeTool as any).mockResolvedValueOnce({
      text: 'Final Verified Report: AI is expected to significantly enhance software development workflows.',
      sessionKey: 'session-mastermind'
    });

    const result = await (ResearchSkill as any).executeResearch({
      topic: 'AI Trends 2026',
      depth: 3
    }, mockContext);

    expect(result.success).toBe(true);
    expect(result.report).toContain('Final Verified Report');
    expect(toolRegistry.executeTool).toHaveBeenCalledTimes(3);

    // Verify first call was for the Lead Researcher
    expect(toolRegistry.executeTool).toHaveBeenNthCalledWith(1, 'sessions_spawn', expect.objectContaining({
      label: 'Lead Researcher'
    }), expect.anything());

    // Verify second call was for the Fact-Checker
    expect(toolRegistry.executeTool).toHaveBeenNthCalledWith(2, 'sessions_spawn', expect.objectContaining({
      label: 'Fact-Checker'
    }), expect.anything());
  });

  it('should handle failures in the research cycle gracefully', async () => {
    (toolRegistry.executeTool as any).mockRejectedValue(new Error('Engine Overload'));

    const result = await (ResearchSkill as any).executeResearch({
      topic: 'Unreachable Topic'
    }, mockContext);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Deep research failed');
  });
});
