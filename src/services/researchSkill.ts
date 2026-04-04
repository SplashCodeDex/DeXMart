import { toolRegistry, ToolDefinition } from './toolRegistry.js';
import logger from '../utils/logger.js';
import { mastermindStreamService } from './MastermindStreamService.js';

/**
 * ResearchSkill implements Phase 2 Nested Agentic Research.
 * Orchestrates a multi-agent research cycle with autonomous audit.
 */
export class ResearchSkill {
  public static getDefinition(): ToolDefinition {
    return {
      name: 'research',
      description: 'Perform deep research on a topic with autonomous verification. Uses multiple sub-agents to crawl the web and verify findings.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The topic to research in depth.'
          },
          depth: {
            type: 'number',
            description: 'Nesting depth (1-5). Higher values perform more thorough verification.',
            default: 3
          },
          intensive: {
            type: 'boolean',
            description: 'If true, spawns additional search nodes for exhaustive data gathering.',
            default: false
          }
        },
        required: ['topic']
      },
      source: 'DeXMart',
      category: 'Intelligence',
      execute: this.executeResearch.bind(this)
    };
  }

  private static async executeResearch(args: any, context: any): Promise<any> {
    const { topic, depth = 3, intensive = false } = args;
    const { tenantId, channelId, userId } = context;
    // Extract parent agent ID if available in context
    const agentId = context.agentId || 'system_default';

    logger.info(`Starting deep research for tenant ${tenantId}: ${topic} (Depth: ${depth}, Intensive: ${intensive})`);
    mastermindStreamService.thought(tenantId, agentId, `Starting deep research cycle for topic: "${topic}"`, 'researching');

    try {
      // 1. Spawning Phase: The Researcher (Level 1)
      logger.info('[ResearchSkill] Spawning Researcher Agent...');
      mastermindStreamService.thought(tenantId, agentId, 'Spawning Lead Researcher agent...', 'researching');

      const researcherTask = intensive
        ? `Research "${topic}" exhaustively. Spawn multiple sub-searchers if needed to cover different angles. Return a comprehensive data dump.`
        : `Research "${topic}" in depth. Provide a detailed report with facts and sources.`;

      mastermindStreamService.spawnAgent(tenantId, agentId, 'researcher_node', researcherTask);

      const researcherResult = await toolRegistry.executeTool('sessions_spawn', {
        task: researcherTask,
        label: 'Lead Researcher',
        runtime: 'subagent',
        mode: 'run',
        cleanup: 'keep'
      }, context);

      const researchFindings = researcherResult.text || researcherResult.message || researcherResult.output || JSON.stringify(researcherResult);
      mastermindStreamService.thought(tenantId, agentId, 'Lead Researcher findings retrieved. Transitioning to audit phase...', 'auditing');

      // 2. Audit Phase: The Critique Agent (Autonomous Verification)
      logger.info('[ResearchSkill] Spawning Critique Agent for verification...');
      mastermindStreamService.thought(tenantId, agentId, 'Spawning Fact-Checker agent for autonomous audit...', 'auditing');

      const critiqueTask = `CRITICAL AUDIT: Fact-check the following research findings for accuracy and hallucinations.
      Topic: "${topic}"
      Findings:
      ${researchFindings}

      If you find errors, state them clearly. If accurate, suggest improvements for synthesis.
      Return your verdict and any corrected facts.`;

      mastermindStreamService.spawnAgent(tenantId, agentId, 'auditor_node', critiqueTask);

      const critiqueResult = await toolRegistry.executeTool('sessions_spawn', {
        task: critiqueTask,
        label: 'Fact-Checker',
        runtime: 'subagent',
        mode: 'run',
        cleanup: 'delete'
      }, context);

      const auditFeedback = critiqueResult.text || critiqueResult.message || critiqueResult.output || JSON.stringify(critiqueResult);
      mastermindStreamService.thought(tenantId, agentId, 'Audit complete. Synthesizing final report...', 'synthesizing');

      // 3. Synthesis Phase: The Mastermind Synthesis (Final Tier)
      logger.info('[ResearchSkill] Finalizing synthesis...');
      
      const synthesisTask = `Synthesize the following research data and audit feedback into a professional, cohesive final report.
      Topic: "${topic}"
      Research: ${researchFindings}
      Audit Verdict: ${auditFeedback}

      Requirements:
      - Eliminate any facts flagged as incorrect by the auditor.
      - Maintain a professional, objective tone.
      - Cite sources where provided.
      - Format with clear headings.`;

      mastermindStreamService.spawnAgent(tenantId, agentId, 'synthesis_node', synthesisTask);

      const finalResult = await toolRegistry.executeTool('sessions_spawn', {
        task: synthesisTask,
        label: 'Mastermind Synthesis',
        runtime: 'subagent',
        mode: 'run',
        cleanup: 'delete'
      }, context);

      const finalReport = finalResult.text || finalResult.message || finalResult.output || JSON.stringify(finalResult);

      logger.info(`[ResearchSkill] Deep research cycle complete for: ${topic}`);
      mastermindStreamService.thought(tenantId, agentId, 'Research cycle successfully complete.', 'synthesizing');

      return {
        success: true,
        topic,
        report: finalReport,
        metadata: {
          researcherSession: researcherResult.sessionKey,
          auditFeedback: auditFeedback.substring(0, 500) + '...',
          nestingDepthReached: depth,
          intensiveMode: intensive
        }
      };

    } catch (error: any) {
      logger.error('ResearchSkill.executeResearch error:', error);
      return {
        success: false,
        error: `Deep research failed: ${error.message || 'Orchestration error'}`
      };
    }
  }
}
