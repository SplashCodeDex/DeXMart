import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeXMartToolBridge } from './DeXMartToolBridge.js';
import { toolRegistry } from './toolRegistry.js';
import { channelManager } from './channels/ChannelManager.js';

// Mock dependencies
vi.mock('./toolRegistry.js', () => ({
    toolRegistry: {
        registerTool: vi.fn(),
        getAllTools: vi.fn(),
    },
}));

vi.mock('./channels/ChannelManager.js', () => ({
    channelManager: {
        getAdapter: vi.fn(),
    },
}));

vi.mock('../utils/logger.js', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('DeXMartToolBridge', () => {
    const mockChannel = {
        channelId: 'chan-1',
        tenantId: 'tenant-1',
        cmd: new Map([
            ['testcmd', { description: 'Test Command', category: 'misc', code: vi.fn() }],
            ['othercmd', { description: 'Other Command', category: 'misc', code: vi.fn() }],
        ]),
        executeMiddleware: vi.fn((ctx, next) => next()),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('registerCommands', () => {
        it('should bridge commands from the hardcoded list if they exist in the channel', () => {
            // Mock a channel that has one of the high-value commands
            const channelWithHighValue = {
                ...mockChannel,
                cmd: new Map([
                    ['weather', { description: 'Get weather', category: 'misc', code: vi.fn() }],
                ]),
            };

            DeXMartToolBridge.registerCommands(channelWithHighValue as any);

            expect(toolRegistry.registerTool).toHaveBeenCalledWith(expect.objectContaining({
                name: 'weather',
            }));
        });

        it('should NOT bridge commands that are not in the hardcoded list (Current behavior)', () => {
            DeXMartToolBridge.registerCommands(mockChannel as any);
            expect(toolRegistry.registerTool).not.toHaveBeenCalled();
        });

        it('should bridge ALL commands if enableAllTools is true', () => {
            const channelWithAllTools = {
                ...mockChannel,
                config: { enableAllTools: true },
            };

            DeXMartToolBridge.registerCommands(channelWithAllTools as any);

            expect(toolRegistry.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'testcmd' }));
            expect(toolRegistry.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'othercmd' }));
        });

        it('should bridge only specific commands if enabledTools is provided', () => {
            const channelWithSpecificTools = {
                ...mockChannel,
                config: { enabledTools: ['testcmd'] },
            };

            DeXMartToolBridge.registerCommands(channelWithSpecificTools as any);

            expect(toolRegistry.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'testcmd' }));
            expect(toolRegistry.registerTool).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'othercmd' }));
        });
    });

    describe('tool execution', () => {
        it('should use the channel from the execution context if available', async () => {
             // Mock tool registration to capture the execute function
             let capturedExecute: any;
             vi.mocked(toolRegistry.registerTool).mockImplementation((tool: any) => {
                 if (tool.name === 'weather') capturedExecute = tool.execute;
             });

             const channelWithWeather = {
                ...mockChannel,
                cmd: new Map([
                    ['weather', { description: 'Get weather', category: 'misc', code: vi.fn() }],
                ]),
            };

             DeXMartToolBridge.registerCommands(channelWithWeather as any);
             
             expect(capturedExecute).toBeDefined();

             const mockContext = {
                 tenantId: 'tenant-1',
                 channelId: 'chan-1',
                 userId: 'user-1',
             };

             const activeChannelMock = {
                 ...channelWithWeather,
                 executeMiddleware: vi.fn((ctx, next) => next()),
             };
             vi.mocked(channelManager.getAdapter).mockReturnValue(activeChannelMock as any);

             await capturedExecute({ location: 'London' }, mockContext);

             // Verify it tried to resolve the adapter
             expect(channelManager.getAdapter).toHaveBeenCalledWith('chan-1');
             // Verify it called executeMiddleware on the RESOLVED channel
             expect(activeChannelMock.executeMiddleware).toHaveBeenCalled();
        });
    });
});
