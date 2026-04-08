// Prepared context for DeXMart - Firebase ready
// 2026 Mastermind Edition - Strictly Typed
import { ConfigService } from '../services/ConfigService.js';
import tools from '../tools/exports.js';
import * as formatter from '../utils/formatters.js';
import logger from '../utils/logger.js';
import state from '../utils/state.js';
import { CommandSystem } from '../services/commandSystem.js';
import { GlobalContext } from '../types/index.js';
import { groupService } from '../services/groupService.js';
import { databaseService } from '../services/database.js';
import { channelService } from '../services/ChannelService.js';
import { agentService } from '../services/AgentService.js';
import { ingressService } from '../services/IngressService.js';
import { userService } from '../services/userService.js';
import { tenantConfigService } from '../services/tenantConfigService.js';


/**
 * Singleton state for context initialization
 */
let initializationPromise: Promise<GlobalContext> | null = null;

/**
 * Initialize and return the fully prepared global context
 * 2026 Mastermind Edition: Singleton implementation with Promise-based guard
 */
async function initializeContext(): Promise<GlobalContext> {
    logger.info('>>> [MASTERMIND] initializeContext() called');
    // If initialization is already in progress or completed, return the same promise
    if (initializationPromise) {
        logger.info('>>> [MASTERMIND] initializeContext() returning existing promise');
        return initializationPromise;
    }

    // Capture the initialization process in a promise
    initializationPromise = (async () => {
        logger.info('>>> [MASTERMIND] Starting fresh initialization');
        try {
            const config = ConfigService.getInstance();

            // Build the base context object
            const context: GlobalContext = {
                config,
                database: databaseService,
                databaseService,
                formatter,
                state,
                tools,
                logger,
                groupService,
                channelService,
                agentService,
                ingressService,
                userService,
                tenantConfigService,
                // commandSystem initialized below after dependency setup
                commandSystem: null as any,
            };
            logger.info('>>> [MASTERMIND] Base context object built.');

            // Instantiate systems that depend on context
            // NOTE: unifiedAI removed — replaced by OpenClaw's runEmbeddedPiAgent() (Phase 4)
            const commandSystem = new CommandSystem(context);
            context.commandSystem = commandSystem;

            // Load commands eagerly
            logger.info('Initializing Command System and loading commands...');
            await commandSystem.loadCommands();
            logger.info('>>> [MASTERMIND] Command loading finished. Getting mock bot...');

            // OpenClaw skills are natively available in the unified src/ tree.
            // No bridge needed — skills are discovered by the agent runtime directly.

            logger.info('✅ Global Context initialized successfully');
            logger.info('>>> [MASTERMIND] Global Context initialized successfully');
            return context;
        } catch (error) {
            logger.error('❌ Failed to initialize Global Context:', error);
            initializationPromise = null; // Reset to allow retry on failure
            throw error;
        }
    })();

    return initializationPromise;
}

export default initializeContext;
