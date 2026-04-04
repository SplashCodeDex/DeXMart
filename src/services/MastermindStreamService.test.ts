import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastermindStreamService } from './MastermindStreamService.js';
import { socketService } from './socketService.js';

// Mock SocketService
vi.mock('./socketService.js', () => ({
    socketService: {
        emitToTenant: vi.fn()
    }
}));

describe('MastermindStreamService', () => {
    let service: MastermindStreamService;
    const tenantId = 'tenant-123';
    const agentId = 'agent-456';

    beforeEach(() => {
        vi.clearAllMocks();
        service = MastermindStreamService.getInstance();
    });

    it('should emit reasoning:start event', () => {
        service.start(tenantId, agentId, 'session-789');
        
        expect(socketService.emitToTenant).toHaveBeenCalledWith(
            tenantId,
            'mastermind_event',
            expect.objectContaining({
                type: 'reasoning:start',
                agentId,
                sessionId: 'session-789'
            })
        );
    });

    it('should emit reasoning:thought event', () => {
        service.thought(tenantId, agentId, 'I am thinking...', 'planning');
        
        expect(socketService.emitToTenant).toHaveBeenCalledWith(
            tenantId,
            'mastermind_event',
            expect.objectContaining({
                type: 'reasoning:thought',
                agentId,
                content: 'I am thinking...',
                stage: 'planning'
            })
        );
    });

    it('should emit tool:invoke event', () => {
        service.invokeTool(tenantId, agentId, 'web_search', { query: 'DeXMart' });
        
        expect(socketService.emitToTenant).toHaveBeenCalledWith(
            tenantId,
            'mastermind_event',
            expect.objectContaining({
                type: 'tool:invoke',
                agentId,
                toolName: 'web_search',
                params: { query: 'DeXMart' }
            })
        );
    });

    it('should emit agent:spawn event', () => {
        service.spawnAgent(tenantId, agentId, 'sub-agent-1', 'Research DeXMart');
        
        expect(socketService.emitToTenant).toHaveBeenCalledWith(
            tenantId,
            'mastermind_event',
            expect.objectContaining({
                type: 'agent:spawn',
                agentId: 'sub-agent-1',
                parentAgentId: agentId,
                content: 'Research DeXMart'
            })
        );
    });

    it('should handle errors during emission without crashing', () => {
        vi.mocked(socketService.emitToTenant).mockImplementation(() => {
            throw new Error('Socket error');
        });

        // Should not throw
        expect(() => service.complete(tenantId, agentId)).not.toThrow();
    });
});
