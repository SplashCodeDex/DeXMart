import { toolRegistry } from './toolRegistry.js';
import { ResearchSkill } from './researchSkill.js';
import logger from '../utils/logger.js';

/**
 * Bridge for advanced Phase 2 Mastermind skills.
 */
export class MastermindSkillBridge {
  /**
   * Registers all new agentic skills in the unified registry.
   */
  public static registerSkills(): void {
    try {
      logger.info('🧠 Registering Mastermind Agentic Skills...');
      
      // Register Research Skill
      toolRegistry.registerTool(ResearchSkill.getDefinition());
      
      // Add more mastermind skills here as they are developed
      
      logger.info('✅ Mastermind skills registered.');
    } catch (error) {
      logger.error('Failed to register mastermind skills:', error);
    }
  }
}
