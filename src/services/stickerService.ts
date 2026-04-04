/**
 * Sticker Service - Advanced sticker creation features
 */

import path from 'path';
import axios from 'axios';
import { promises as fs, writeFileSync } from 'fs';
import { spawn } from 'child_process';
import { writeExif } from '../lib/exif.js';
import { Result } from '../types/index.js';
import logger from '../utils/logger.js';

interface MixedSticker {
  url: string;
  name: string;
}

export class StickerService {
  private static instance: StickerService;
  private tempDir: string;

  private constructor() {
    this.tempDir = path.join(process.cwd(), 'database', 'temp');
  }

  public static getInstance(): StickerService {
    if (!StickerService.instance) {
      StickerService.instance = new StickerService();
    }
    return StickerService.instance;
  }

  /**
   * Emoji Mix
   */
  async emojiMix(emoji1: string, emoji2: string): Promise<Result<{ stickers: MixedSticker[]; message: string }>> {
    try {
      const response = await axios.get(
        `https://tenor.googleapis.com/v2/featured?key=LIVDSRZULELA&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${encodeURIComponent(emoji1)}_${encodeURIComponent(emoji2)}`
      );

      if (!response.data.results || response.data.results.length === 0) {
        return { success: false, error: new Error(`Mix Emoji ${emoji1}+${emoji2} Tidak Ditemukan!`) };
      }

      const stickers: MixedSticker[] = response.data.results.slice(0, 3).map((r: any, i: number) => ({
        url: r.url,
        name: `emojimix_${i + 1}.png`
      }));

      return {
        success: true,
        data: {
          stickers,
          message: `Berhasil membuat ${stickers.length} emoji mix`
        }
      };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * Create Brat Sticker
   */
  async createBratSticker(text: string): Promise<Result<{ buffer: Buffer; message: string }>> {
    try {
      if (text.length > 50) return { success: false, error: new Error('Text too long') };

      const response = await axios.get(
        `https://aqul-brat.hf.space/?text=${encodeURIComponent(text)}`,
        { responseType: 'arraybuffer' }
      );

      return {
        success: true,
        data: {
          buffer: Buffer.from(response.data),
          message: `Berhasil membuat brat sticker: "${text}"`
        }
      };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /**
   * Create sticker with EXIF
   */
  async createSticker(mediaBuffer: Buffer, options: { packname?: string; author?: string; categories?: string[] } = {}): Promise<Result<{ buffer: Buffer }>> {
    try {
      const { packname = 'DeXMart', author = 'CodeDeX', categories = [] } = options;
      const stickerBuffer = await writeExif(mediaBuffer, { packname, author, categories });
      return { success: true, data: { buffer: stickerBuffer } };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  public async ensureTempDir(): Promise<string> {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
    return this.tempDir;
  }
}

export const stickerService = StickerService.getInstance();
export default stickerService;
