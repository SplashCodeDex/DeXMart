import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlowEngine } from './flowEngine.js';
import { FlowData } from './flowService.js';
import { cacheService } from './cache.js';

vi.mock('./cache.js', () => ({
  cacheService: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn()
  }
}));

describe('FlowEngine', () => {
  let engine: FlowEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    (cacheService.get as any).mockResolvedValue({ success: false });
    engine = FlowEngine.getInstance();
  });

  it('should execute a simple Trigger -> Action flow', async () => {
    const mockReply = vi.fn().mockResolvedValue({ success: true });
    const context: any = {
      body: 'hello',
      reply: mockReply,
      sender: { jid: 'user1' },
      tenantId: 'tenant1'
    };

    const flow: FlowData = {
      id: 'flow1',
      name: 'Welcome Flow',
      isActive: true,
      tenantId: 'tenant1',
      nodes: [
        { id: 'n1', type: 'trigger', data: { keyword: 'hello' } },
        { id: 'n2', type: 'action', data: { message: 'Hi there!' } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await engine.executeFlow(flow, context);

    expect(result).toBe(true);
    expect(mockReply).toHaveBeenCalledWith('Hi there!');
  });

  it('should not execute if trigger keyword does not match', async () => {
    const mockReply = vi.fn();
    const context: any = {
      body: 'bye',
      reply: mockReply,
      sender: { jid: 'user1' }
    };

    const flow: FlowData = {
      id: 'flow1',
      name: 'Welcome Flow',
      isActive: true,
      tenantId: 'tenant1',
      nodes: [
        { id: 'n1', type: 'trigger', data: { keyword: 'hello' } },
        { id: 'n2', type: 'action', data: { message: 'Hi there!' } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await engine.executeFlow(flow, context);

    expect(result).toBe(false);
    expect(mockReply).not.toHaveBeenCalled();
  });

  it('should handle logic nodes with branching (Premium Check)', async () => {
    const mockReply = vi.fn().mockResolvedValue({ success: true });
    const context: any = {
      body: 'status',
      reply: mockReply,
      sender: { jid: 'user1' },
      tenant: { plan: 'enterprise' }
    };

    const flow: FlowData = {
      id: 'flow2',
      name: 'Logic Flow',
      isActive: true,
      tenantId: 'tenant1',
      nodes: [
        { id: 'n1', type: 'trigger', data: { keyword: 'status' } },
        { id: 'n2', type: 'logic', data: { condition: 'is_premium' } },
        { id: 'n3', type: 'action', data: { message: 'You are a VIP!' } },
        { id: 'n4', type: 'action', data: { message: 'Standard user.' } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3', label: 'true' },
        { id: 'e3', source: 'n2', target: 'n4', label: 'false' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await engine.executeFlow(flow, context);

    expect(mockReply).toHaveBeenCalledWith('You are a VIP!');
    expect(mockReply).not.toHaveBeenCalledWith('Standard user.');
  });

  it('should execute a Gemini AI node', async () => {
    const mockReply = vi.fn().mockResolvedValue({ success: true });
    const mockProcessMessage = vi.fn().mockResolvedValue({ success: true, data: { content: { text: 'AI Response' } } });

    const context: any = {
      body: 'ask ai',
      reply: mockReply,
      sender: { jid: 'user1' },
      channel: { channelId: 'chan1', tenantId: 'tenant1' },
      unifiedAI: {
        processOmnichannelMessage: mockProcessMessage
      }
    };

    const flow: FlowData = {
      id: 'flow3',
      name: 'AI Flow',
      isActive: true,
      tenantId: 'tenant1',
      nodes: [
        { id: 'n1', type: 'trigger', data: { keyword: 'ask ai' } },
        { id: 'n2', type: 'ai', data: { prompt: 'Help the user' } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await engine.executeFlow(flow, context);

    expect(mockProcessMessage).toHaveBeenCalled();
    expect(mockReply).toHaveBeenCalledWith('AI Response');
  });

  it('should handle AI Router nodes (Semantic Routing)', async () => {
    const mockReply = vi.fn().mockResolvedValue({ success: true });
    // Mock the specific AI call for routing
    const mockGetChatCompletion = vi.fn().mockResolvedValue('support');

    const context: any = {
      body: 'I need help with my account',
      reply: mockReply,
      sender: { jid: 'user1' },
      unifiedAI: {
        gemini: {
          getChatCompletion: mockGetChatCompletion
        }
      }
    };

    const flow: FlowData = {
      id: 'flow4',
      name: 'Router Flow',
      isActive: true,
      tenantId: 'tenant1',
      nodes: [
        { id: 'n1', type: 'trigger', data: { keyword: 'I need help with my account' } },
        {
          id: 'n2', type: 'ai_router', data: {
            options: [
              { label: 'sales', description: 'User wants to buy something' },
              { label: 'support', description: 'User has a technical issue' }
            ]
          }
        },
        { id: 'n3', type: 'action', data: { message: 'Transferring to Sales...' } },
        { id: 'n4', type: 'action', data: { message: 'Opening Support Ticket...' } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3', label: 'sales' },
        { id: 'e3', source: 'n2', target: 'n4', label: 'support' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await engine.executeFlow(flow, context);

    expect(mockGetChatCompletion).toHaveBeenCalled();
    expect(mockReply).toHaveBeenCalledWith('Opening Support Ticket...');
    expect(mockReply).not.toHaveBeenCalledWith('Transferring to Sales...');
  });

  it('should resume a flow from a saved state (Multi-turn)', async () => {
    const mockReply = vi.fn().mockResolvedValue({ success: true });
    const context: any = {
      body: 'I want a pizza',
      reply: mockReply,
      sender: { jid: 'user1' },
      tenantId: 'tenant1'
    };

    const flow: FlowData = {
      id: 'flow5',
      name: 'Pizza Flow',
      isActive: true,
      tenantId: 'tenant1',
      nodes: [
        { id: 'n1', type: 'trigger', data: { keyword: 'pizza' } },
        { id: 'n2', type: 'action', data: { message: 'What size would you like?' } },
        { id: 'n3', type: 'wait_for_input', data: {} },
        { id: 'n4', type: 'action', data: { message: 'Got it! Preparing your pizza...' } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4' }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 1. Initial trigger
    context.body = 'pizza';
    await engine.executeFlow(flow, context);
    expect(mockReply).toHaveBeenCalledWith('What size would you like?');
    expect(cacheService.set).toHaveBeenCalledWith(expect.stringContaining('user1'), expect.objectContaining({
      flowId: 'flow5',
      currentNodeId: 'n3'
    }), expect.any(Number));

    // 2. Mock state retrieval for resumption
    (cacheService.get as any).mockResolvedValue({
      success: true,
      data: { flowId: 'flow5', currentNodeId: 'n3' }
    });

    // 3. Second message
    context.body = 'large';
    await engine.executeFlow(flow, context);
    expect(mockReply).toHaveBeenCalledWith('Got it! Preparing your pizza...');
    expect(cacheService.delete).toHaveBeenCalledWith(expect.stringContaining('user1'));
  });
});
