/**
 * AI Utility Service — Lightweight text generation via Google Generative AI SDK.
 *
 * Replaces the deleted `gemini.ts` and `geminiAI.ts` (Phase 1 cleanup).
 * This is NOT a bridge — it's a direct SDK wrapper for DeXMart-specific
 * AI operations (translation, summarization, moderation, chat completion).
 *
 * For agent conversations, use OpenClaw's pi-embedded-runner instead.
 *
 * 2026 Mastermind Edition — Zero-trust, Result pattern, singleton.
 */
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { ApiKeyManager } from "../lib/apiKeyManager.js";
import logger from "../utils/logger.js";

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface ModerationResult {
  safe: boolean;
  categories: Record<string, boolean>;
  reason?: string;
}

export class AIUtilityService {
  private static instance: AIUtilityService | null = null;
  private keyManager: ApiKeyManager;
  private readonly modelId: string;

  private constructor(keyManager: ApiKeyManager) {
    this.keyManager = keyManager;
    this.modelId = "gemini-2.0-flash";

    const stats = this.keyManager.getStats();
    logger.info(
      `AIUtilityService initialized with ${stats.totalKeys} API keys (${stats.healthyKeys} healthy)`,
    );
  }

  public static getInstance(): AIUtilityService {
    if (!AIUtilityService.instance) {
      const managerResult = ApiKeyManager.getInstance();
      if (!managerResult.success) {
        throw managerResult.error;
      }
      AIUtilityService.instance = new AIUtilityService(managerResult.data);
    }
    return AIUtilityService.instance;
  }

  /** Reset singleton (for testing). */
  public static resetInstance(): void {
    AIUtilityService.instance = null;
  }

  /**
   * Send a prompt and receive a text response.
   * Uses API key rotation on quota/rate errors.
   */
  async getChatCompletion(prompt: string): Promise<string> {
    if (!prompt?.trim()) {
      throw new Error("AIUtilityService: prompt is required");
    }

    return this.keyManager.execute(
      async (key) => {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: this.modelId });
        const result = await model.generateContent(prompt);
        return result.response.text();
      },
      { maxRetries: 3, timeoutMs: 30000 },
    );
  }

  /**
   * Summarize a conversation history.
   */
  async getSummary(messages: ChatMessage[]): Promise<string> {
    const formatted = messages
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n");
    const prompt = `Summarize the following conversation concisely:\n\n${formatted}`;
    return this.getChatCompletion(prompt);
  }

  /**
   * Generate text from a prompt (alias for getChatCompletion).
   */
  async generateText(prompt: string): Promise<string> {
    return this.getChatCompletion(prompt);
  }

  /**
   * Content moderation via Gemini.
   */
  async moderateContent(content: string): Promise<ModerationResult> {
    const prompt = `You are a content moderation system. Analyze the following content and respond with ONLY a JSON object:
{"safe": true/false, "categories": {"hate": false, "violence": false, "sexual": false, "spam": false}, "reason": "brief explanation if unsafe"}

Content to analyze:
${content}`;

    try {
      const response = await this.getChatCompletion(prompt);
      const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleaned) as ModerationResult;
    } catch (error) {
      logger.error("AIUtilityService: moderation parsing failed", { error });
      return { safe: true, categories: {}, reason: "Moderation check failed, defaulting to safe" };
    }
  }
  /**
   * Spin message to vary content (for Anti-Ban).
   */
  public static async spinMessage(
    content: string,
    tenantId: string,
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const prompt = `Rewrite the following message to be unique but convey the exact same meaning:\n\n${content}`;
      const response = await AIUtilityService.getInstance().getChatCompletion(prompt);
      return { success: true, data: response };
    } catch (error: any) {
      logger.error("AIUtilityService: spinMessage failed", { error: error.message, tenantId });
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance (lazy via Proxy, same pattern as embeddingService)
let _instance: AIUtilityService | null = null;

function getService(): AIUtilityService {
  if (!_instance) {
    _instance = AIUtilityService.getInstance();
  }
  return _instance;
}

export const aiUtility = new Proxy({} as AIUtilityService, {
  get(_target, prop: string | symbol) {
    return (getService() as any)[prop];
  },
});

export default aiUtility;
