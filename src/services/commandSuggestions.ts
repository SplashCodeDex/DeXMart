
import { db } from '../lib/firebase.js';
import { levenshteinDistance } from '../utils/levenshtein.js';

export default class CommandSuggestionsService {
  async getUserCommandHistory(userId: string, limit = 20) {
    if (!userId) return [];
    try {
      const snapshot = await db.collection('command_usage')
        .where('userId', '==', userId)
        .orderBy('usedAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          command: d.command,
          category: d.category,
          usedAt: d.usedAt ? d.usedAt.toDate() : new Date()
        };
      });
    } catch (e) {
      return [];
    }
  }

  async suggestCommands(input: string, recentCommands: any[] = [], options: any = {}) {
    const text = (input || '').toLowerCase().trim();
    if (!text) return [];

    // Build candidate set from recent
    const recentSet = new Map<string, number>();
    for (const rc of recentCommands || []) {
      const cmdName = (rc as any).command;
      if (cmdName) {
        recentSet.set(cmdName, (recentSet.get(cmdName) || 0) + 1);
      }
    }

    const candidates = new Map<string, any>();
    // Static popular list acting as base knowledge
    const staticPopular = [
      { command: 'menu', category: 'main', count: 100 },
      { command: 'sticker', category: 'sticker', count: 80 },
      { command: 'play', category: 'downloader', count: 70 },
      { command: 'gemini', category: 'ai-chat', count: 60 },
      { command: 'tiktok', category: 'downloader', count: 50 },
      { command: 'open', category: 'group', count: 40 },
      { command: 'close', category: 'group', count: 40 },
      { command: 'kick', category: 'group', count: 30 },
      { command: 'add', category: 'group', count: 30 }
    ];

    for (const p of staticPopular) {
      candidates.set(p.command, { command: p.command, category: p.category, baseScore: (p.count || 0) });
    }

    for (const [cmd, freq] of recentSet.entries()) {
      const existing = candidates.get(cmd) || { command: cmd, category: 'general', baseScore: 0 };
      existing.baseScore += 5 * (freq as number); // boost recency
      candidates.set(cmd, existing);
    }

    // Heuristic keyword mapping for common intents
    const keywordMap = [
      { keywords: ['youtube', 'yt', 'video'], command: 'youtubevideo', category: 'downloader', description: 'Download a YouTube video' },
      { keywords: ['youtube', 'yt', 'audio', 'mp3', 'song', 'music'], command: 'youtubeaudio', category: 'downloader', description: 'Download YouTube audio as MP3' },
      { keywords: ['download', 'link', 'save'], command: 'play', category: 'downloader', description: 'Find or download media from a link' },
      { keywords: ['image', 'generate', 'ai', 'art', 'picture'], command: 'text2image', category: 'ai-image', description: 'Generate an image from text' },
      { keywords: ['translate', 'language', 'terjemah'], command: 'translate', category: 'tool', description: 'Translate text' },
      { keywords: ['sticker', 'stiker'], command: 'sticker', category: 'sticker', description: 'Create a sticker from media' },
      { keywords: ['ocr', 'text', 'image'], command: 'ocr', category: 'tool', description: 'Extract text from an image' },
      { keywords: ['tts', 'speak', 'voice'], command: 'tts', category: 'tools', description: 'Convert text to speech' },
      { keywords: ['menu', 'help', 'commands'], command: 'menu', category: 'main', description: 'Show available commands' },
      { keywords: ['gemini', 'chat', 'ask', 'ai'], command: 'gemini', category: 'ai-chat', description: 'Chat with the AI' },
    ];

    for (const m of keywordMap) {
      const match = m.keywords.some(k => text.includes(k));
      if (match && !candidates.has(m.command)) {
        candidates.set(m.command, { command: m.command, category: m.category, baseScore: 3, description: m.description });
      }
    }

    // Score candidates using fuzzy match against command name
    const scored: any[] = [];
    for (const c of candidates.values()) {
      const distance = levenshteinDistance(text.split(' ')[0] || '', c.command);
      const fuzzyScore = distance === 0 ? 10 : Math.max(0, 5 - distance);
      const keywordBonus = keywordMap.find(k => k.command === c.command && k.keywords.some(kw => text.includes(kw))) ? 2 : 0;
      const score = c.baseScore + fuzzyScore + keywordBonus;
      const description = c.description || this.describe(c.command, c.category);
      scored.push({ command: c.command, category: c.category || 'general', score, description });
    }

    scored.sort((a, b) => b.score - a.score);

    // Normalize to expected output: include confidence 0..1
    const maxScore = scored[0]?.score || 1;
    return scored.slice(0, options.limit || 5).map(s => ({
      command: s.command,
      category: s.category,
      description: s.description,
      confidence: Math.max(0.1, Math.min(1, s.score / (maxScore || 1)))
    }));
  }

  describe(command: string, category: string) {
    const dictionary: Record<string, string> = {
      youtubevideo: 'Download a YouTube video',
      youtubeaudio: 'Download audio from YouTube',
      text2image: 'Generate an image from your prompt',
      translate: 'Translate text into another language',
      sticker: 'Create a sticker from an image or video',
      ocr: 'Extract text from an image',
      tts: 'Convert text to speech',
      menu: 'Show available commands',
      gemini: 'Chat with the AI assistant'
    };
    return dictionary[command] || `Run ${command} (${category || 'general'})`;
  }
}
