import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowEngine } from './flowEngine.js';
import logger from '../utils/logger.js';

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('FlowEngine Skill Execution', () => {
  let engine: FlowEngine;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = FlowEngine.getInstance();
    mockContext = {
      tenantId: 'tenant-123',
      bot: { id: 'bot-1' },
      unifiedAI: {
        executeTool: vi.fn(),
      },
      reply: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should successfully execute a skill node with parameters', async () => {
    const node = {
      id: 'node-skill-1',
      type: 'skill',
      data: {
        skillName: 'web_search',
        params: { query: 'latest news' }
      }
    };

    mockContext.unifiedAI.executeTool.mockResolvedValue({
      success: true,
      message: 'Found some news about AI.'
    });

    // Access private method for testing
    await (engine as any).executeSkillNode(node, mockContext);

    expect(mockContext.unifiedAI.executeTool).toHaveBeenCalledWith(
      'web_search',
      { query: 'latest news' },
      mockContext
    );
    expect(mockContext.reply).toHaveBeenCalledWith('Found some news about AI.');
  });

  it('should handle skill execution failure gracefully', async () => {
    const node = {
      id: 'node-skill-1',
      type: 'skill',
      data: {
        skillName: 'invalid_skill',
        params: {}
      }
    };

    mockContext.unifiedAI.executeTool.mockResolvedValue({
      success: false,
      error: 'Skill not found'
    });

    await (engine as any).executeSkillNode(node, mockContext);

    expect(mockContext.reply).toHaveBeenCalledWith('⚠️ Failed to execute invalid_skill.');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should skip execution if unifiedAI is missing from context', async () => {
    const node = {
      id: 'node-skill-1',
      type: 'skill',
      data: { skillName: 'test' }
    };
    
    const contextWithoutAI = { ...mockContext, unifiedAI: undefined };

    await (engine as any).executeSkillNode(node, contextWithoutAI);

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('unifiedAI not found'));
    expect(mockContext.reply).not.toHaveBeenCalled();
  });
});
