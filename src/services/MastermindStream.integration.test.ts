import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResearchSkill } from './researchSkill.js';
import { toolRegistry } from './toolRegistry.js';
import { mastermindStreamService } from './MastermindStreamService.js';
import { socketService } from './socketService.js';

// Mock SocketService
vi.mock('./socketService.js', () => ({
    socketService: {
        emitToTenant: vi.fn()
    }
}));

// Mock sessions_spawn tool
const mockSpawn = vi.fn().mockResolvedValue({ text: 'Sample findings', sessionKey: 'session-123' });

describe('Mastermind Stream Integration', () => {
    const tenantId = 'tenant-trace-test';
    const agentId = 'master-agent';
    const context = {
        tenantId,
        agentId,
        platform: 'whatsapp',
        userId: 'user-123'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Register a mock sessions_spawn tool
        toolRegistry.registerTool({
            name: 'sessions_spawn',
            description: 'Mock spawn',
            parameters: { type: 'object', properties: {}, required: [] },
            execute: mockSpawn,
            source: 'DeXMart'
        });
    });

    it('should emit a complete trace during a research cycle', async () => {
        const researchTool = ResearchSkill.getDefinition();
        
        await researchTool.execute({ topic: 'AI Future' }, context);

        // Verify emissions in sequence (captured by mock)
        const calls = vi.mocked(socketService.emitToTenant).mock.calls;

        // 1. Initial thought
        expect(calls).toContainEqual([
            tenantId,
            'mastermind_event',
            expect.objectContaining({ type: 'reasoning:thought', content: expect.stringContaining('Starting deep research') })
        ]);

        // 2. Researcher Spawn
        expect(calls).toContainEqual([
            tenantId,
            'mastermind_event',
            expect.objectContaining({ type: 'agent:spawn', agentId: 'researcher_node' })
        ]);

        // 3. Auditor Spawn
        expect(calls).toContainEqual([
            tenantId,
            'mastermind_event',
            expect.objectContaining({ type: 'agent:spawn', agentId: 'auditor_node' })
        ]);

        // 4. Synthesis Spawn
        expect(calls).toContainEqual([
            tenantId,
            'mastermind_event',
            expect.objectContaining({ type: 'agent:spawn', agentId: 'synthesis_node' })
        ]);

        // 5. Final completion thought
        expect(calls).toContainEqual([
            tenantId,
            'mastermind_event',
            expect.objectContaining({ type: 'reasoning:thought', content: expect.stringContaining('Research cycle successfully complete') })
        ]);
    });

    it('should emit tool events via ToolRegistry', async () => {
        // Register a dummy tool
        const dummyTool = {
            name: 'calc_test',
            description: 'Calculator',
            parameters: { type: 'object', properties: {}, required: [] },
            execute: vi.fn().mockResolvedValue(42),
            source: 'DeXMart' as const
        };
        toolRegistry.registerTool(dummyTool);

        await toolRegistry.executeTool('calc_test', { val: 10 }, context);

        // Verify tool invocation event
        expect(socketService.emitToTenant).toHaveBeenCalledWith(
            tenantId,
            'mastermind_event',
            expect.objectContaining({
                type: 'tool:invoke',
                toolName: 'calc_test',
                params: { val: 10 }
            })
        );

        // Verify tool result event
        expect(socketService.emitToTenant).toHaveBeenCalledWith(
            tenantId,
            'mastermind_event',
            expect.objectContaining({
                type: 'tool:result',
                toolName: 'calc_test',
                result: 42
            })
        );
    });
});
