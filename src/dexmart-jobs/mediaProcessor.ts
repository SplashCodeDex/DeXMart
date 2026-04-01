import path from 'path';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import logger from '../utils/logger.js';
import { Job } from 'bullmq';

/**
 * Media Processing Job Handlers
 * Handles background media processing tasks like image optimization, video processing, etc.
 */

interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: keyof sharp.FitEnum;
  withoutEnlargement?: boolean;
}

interface ImageOptimizationData {
  imagePath: string;
  options: ImageOptions;
  userId: string;
}

interface BatchImageProcessingData {
  images: { id: string; path: string; options?: ImageOptions }[];
  options: ImageOptions;
  userId: string;
}

interface VideoThumbnailData {
  videoPath: string;
  timestamp?: number;
  size?: { width: number; height: number };
  userId: string;
}

interface FileConversionData {
  inputPath: string;
  outputFormat: string;
  options: any;
  userId: string;
}

interface MediaCleanupData {
  olderThan: number;
  patterns?: string[];
  userId: string;
}

interface MediaAnalyticsData {
  timeRange?: { start?: string | Date; end?: string | Date };
  userId: string;
}

class MediaProcessor {
  private supportedFormats: {
    images: string[];
    videos: string[];
    audio: string[];
  };
  private tempDir: string;
  private outputDir: string;

  constructor() {
    this.supportedFormats = {
      images: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'],
      videos: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'],
      audio: ['mp3', 'wav', 'ogg', 'aac', 'flac'],
    };

    this.tempDir = path.join(process.cwd(), 'temp');
    this.outputDir = path.join(process.cwd(), 'processed');

    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.outputDir, { recursive: true });
      logger.debug('Media processing directories ensured');
    } catch (error: any) {
      logger.error('Failed to create media processing directories', { error: error.message });
    }
  }

  /**
   * Process image optimization job
   * @param {Object} jobData - Job data
   * @param {Object} job - Bull job instance
   * @returns {Promise<Object>} Processing result
   */
  async processImageOptimization(jobData: ImageOptimizationData, job: Job): Promise<any> {
    const { imagePath, options, userId } = jobData;

    try {
      logger.info('Processing image optimization', {
        jobId: job.id,
        userId,
        imagePath,
        options,
      });

      const inputPath = path.resolve(imagePath);
      const filename = path.basename(inputPath, path.extname(inputPath));
      const outputPath = path.join(this.outputDir, `${filename}_optimized.webp`);

      // Get image metadata
      const metadata = await sharp(inputPath).metadata();

      // Apply optimizations
      let sharpInstance = sharp(inputPath);

      // Resize if specified
      if (options.width || options.height) {
        sharpInstance = sharpInstance.resize(options.width, options.height, {
          fit: options.fit || 'cover',
          withoutEnlargement: options.withoutEnlargement !== false,
        });
      }

      // Apply quality/compression
      if (options.quality) {
        sharpInstance = sharpInstance.webp({ quality: options.quality });
      } else {
        sharpInstance = sharpInstance.webp({ quality: 80 }); // Default quality
      }

      // Process the image
      await sharpInstance.toFile(outputPath);

      // Get output file size
      const stats = await fs.stat(outputPath);
      const originalStats = await fs.stat(inputPath);

      const compressionRatio = (
        ((originalStats.size - stats.size) / originalStats.size) *
        100
      ).toFixed(2);

      logger.info('Image optimization completed', {
        jobId: job.id,
        originalSize: originalStats.size,
        optimizedSize: stats.size,
        compressionRatio: `${compressionRatio}%`,
        outputPath,
      });

      const processingTime = Date.now() - (job.processedOn ?? Date.now());

      return {
        success: true,
        originalPath: inputPath,
        outputPath,
        originalSize: originalStats.size,
        optimizedSize: stats.size,
        compressionRatio: parseFloat(compressionRatio),
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
        },
        processingTime,
      };
    } catch (error: any) {
      logger.error('Image optimization failed', {
        jobId: job.id,
        userId,
        imagePath,
        error: error.message,
      });

      throw new Error(`Image optimization failed: ${error.message}`);
    }
  }

  /**
   * Process batch image processing job
   * @param {Object} jobData - Job data
   * @param {Object} job - Bull job instance
   * @returns {Promise<Object>} Processing result
   */
  async processBatchImageProcessing(jobData: BatchImageProcessingData, job: Job): Promise<any> {
    const { images, options, userId } = jobData;

    try {
      logger.info('Processing batch image processing', {
        jobId: job.id,
        userId,
        imageCount: images.length,
        options,
      });

      const results: any[] = [];

      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];

        try {
          const result = await this.processImageOptimization(
            {
              imagePath: imageData.path,
              options: { ...options, ...imageData.options },
              userId,
            },
            { ...job, id: `${job.id}_${i}` } as any
          );

          results.push({
            id: imageData.id,
            ...result,
            success: true,
          });
        } catch (imageError: any) {
          logger.warn('Failed to process image in batch', {
            jobId: job.id,
            imageId: imageData.id,
            error: imageError.message,
          });

          results.push({
            id: imageData.id,
            error: imageError.message,
            success: false,
          });
        }

        // Update job progress
        await job.updateProgress(((i + 1) / images.length) * 100);
      }

      const successful = results.filter(r => r.success).length;

      return {
        success: true,
        totalImages: images.length,
        successful,
        failed: images.length - successful,
        results,
        processingTime: Date.now() - (job.processedOn ?? Date.now()),
      };
    } catch (error: any) {
      logger.error('Batch image processing failed', {
        jobId: job.id,
        userId,
        error: error.message,
      });

      throw new Error(`Batch image processing failed: ${error.message}`);
    }
  }

  /**
   * Process video thumbnail generation
   * @param {Object} jobData - Job data
   * @param {Object} job - Bull job instance
   * @returns {Promise<Object>} Processing result
   */
  async processVideoThumbnail(jobData: VideoThumbnailData, job: Job): Promise<any> {
    const { videoPath, timestamp, size, userId } = jobData;

    try {
      logger.info('Processing video thumbnail generation', {
        jobId: job.id,
        userId,
        videoPath,
        timestamp,
        size,
      });

      const thumbnailPath = path.join(
        this.outputDir,
        `${path.basename(videoPath, path.extname(videoPath))}_thumbnail.jpg`
      );

      // Try to use ffmpeg to grab a frame, fallback to placeholder if not available
      const { spawn } = await import('child_process');
      const ts = typeof timestamp === 'number' ? Math.max(0, timestamp) : 0;
      const ffArgs = ['-y', '-ss', String(ts), '-i', videoPath, '-frames:v', '1', '-vf', `scale=${size?.width || 320}:${size?.height || -1}:force_original_aspect_ratio=decrease`, thumbnailPath];
      const runFfmpeg = () => new Promise((resolve, reject) => {
        try {
          const ff = spawn('ffmpeg', ffArgs);
          ff.on('error', reject);
          ff.on('close', code => (code === 0 ? resolve(true) : reject(new Error(`ffmpeg exited ${code}`))));
        } catch (e) { reject(e); }
      });

      let usedFfmpeg = false;
      try {
        await runFfmpeg();
        usedFfmpeg = true;
      } catch (_) {
        // Fallback: generate a simple placeholder thumbnail
        await sharp({
          create: {
            width: size?.width || 320,
            height: size?.height || 180,
            channels: 3,
            background: { r: 100, g: 100, b: 100 },
          },
        }).jpeg().toFile(thumbnailPath);
      }

      // Get file sizes
      const videoStats = await fs.stat(videoPath);
      const thumbnailStats = await fs.stat(thumbnailPath);

      const processingTime = Date.now() - (job.processedOn ?? Date.now());

      return {
        success: true,
        videoPath,
        thumbnailPath,
        videoSize: videoStats.size,
        thumbnailSize: thumbnailStats.size,
        timestamp: ts,
        usedFfmpeg,
        size: {
          width: size?.width || 320,
          height: size?.height || 180,
        },
        processingTime,
      };
    } catch (error: any) {
      logger.error('Video thumbnail generation failed', {
        jobId: job.id,
        userId,
        videoPath,
        error: error.message,
      });

      throw new Error(`Video thumbnail generation failed: ${error.message}`);
    }
  }

  /**
   * Process file format conversion
   * @param {Object} jobData - Job data
   * @param {Object} job - Bull job instance
   * @returns {Promise<Object>} Processing result
   */
  async processFileConversion(jobData: FileConversionData, job: Job): Promise<any> {
    const { inputPath, outputFormat, options, userId } = jobData;

    try {
      logger.info('Processing file conversion', {
        jobId: job.id,
        userId,
        inputPath,
        outputFormat,
        options,
      });

      const inputExt = path.extname(inputPath).toLowerCase().slice(1);
      const filename = path.basename(inputPath, path.extname(inputPath));
      const outputPath = path.join(this.outputDir, `${filename}.${outputFormat}`);

      if (
        this.supportedFormats.images.includes(inputExt) &&
        this.supportedFormats.images.includes(outputFormat)
      ) {
        // Image format conversion
        let sharpInstance = sharp(inputPath);

        // Apply conversion options
        switch (outputFormat) {
          case 'webp':
            sharpInstance = sharpInstance.webp(options);
            break;
          case 'png':
            sharpInstance = sharpInstance.png(options);
            break;
          case 'jpg':
          case 'jpeg':
            sharpInstance = (sharpInstance as any).jpeg(options);
            break;
          default:
            sharpInstance = sharpInstance.toFormat(outputFormat as any, options);
        }

        await sharpInstance.toFile(outputPath);
      } else {
        // For unsupported conversions, just copy the file
        await fs.copyFile(inputPath, outputPath);
        logger.warn('Unsupported conversion, file copied as-is', {
          jobId: job.id,
          inputFormat: inputExt,
          outputFormat,
        });
      }

      // Get file sizes
      const inputStats = await fs.stat(inputPath);
      const outputStats = await fs.stat(outputPath);

      const processingTime = Date.now() - (job.processedOn ?? Date.now());

      return {
        success: true,
        inputPath,
        outputPath,
        inputFormat: inputExt,
        outputFormat,
        inputSize: inputStats.size,
        outputSize: outputStats.size,
      };

      return {
        success: true,
        inputPath,
        outputPath,
        inputFormat: inputExt,
        outputFormat,
        inputSize: inputStats.size,
        outputSize: outputStats.size,
        processingTime,
      };
    } catch (error: any) {
      logger.error('File conversion failed', {
        jobId: job.id,
        userId,
        inputPath,
        outputFormat,
        error: error.message,
      });

      throw new Error(`File conversion failed: ${error.message}`);
    }
  }

  /**
   * Process media cleanup job
   * @param {Object} jobData - Job data
   * @param {Object} job - Bull job instance
   * @returns {Promise<Object>} Processing result
   */
  async processMediaCleanup(jobData: MediaCleanupData, job: Job): Promise<any> {
    const { olderThan, patterns, userId } = jobData;

    try {
      logger.info('Processing media cleanup', {
        jobId: job.id,
        userId,
        olderThan,
        patterns,
      });

      const cutoffTime = Date.now() - olderThan * 60 * 60 * 1000; // Convert hours to milliseconds
      let deletedCount = 0;
      let freedSpace = 0;

      // Clean temp directory
      const tempFiles = await fs.readdir(this.tempDir);
      for (const file of tempFiles) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          // Check if file matches cleanup patterns
          const shouldDelete =
            !patterns ||
            patterns.some(pattern => file.includes(pattern) || file.match(new RegExp(pattern)));

          if (shouldDelete) {
            await fs.unlink(filePath);
            deletedCount++;
            freedSpace += stats.size;

            logger.debug('Cleaned up temp file', {
              jobId: job.id,
              file,
              size: stats.size,
              age: (Date.now() - stats.mtime.getTime()) / (60 * 60 * 1000),
            });
          }
        }
      }

      // Clean processed directory (be more conservative)
      const processedFiles = await fs.readdir(this.outputDir);
      for (const file of processedFiles) {
        const filePath = path.join(this.outputDir, file);
        const stats = await fs.stat(filePath);

        // Only delete very old processed files (7 days)
        const processedCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (stats.mtime.getTime() < processedCutoff) {
          await fs.unlink(filePath);
          deletedCount++;
          freedSpace += stats.size;

          logger.debug('Cleaned up processed file', {
            jobId: job.id,
            file,
            size: stats.size,
          });
        }
      }

      const processingTime = Date.now() - (job.processedOn ?? Date.now());

      return {
        success: true,
        deletedFiles: deletedCount,
        freedSpace,
        tempDir: this.tempDir,
        outputDir: this.outputDir,
        processingTime,
      };
    } catch (error: any) {
      logger.error('Media cleanup failed', {
        jobId: job.id,
        userId,
        error: error.message,
      });

      throw new Error(`Media cleanup failed: ${error.message}`);
    }
  }

  /**
   * Process media analytics job
   * @param {Object} jobData - Job data
   * @param {Object} job - Bull job instance
   * @returns {Promise<Object>} Processing result
   */
  async processMediaAnalytics(jobData: MediaAnalyticsData, job: Job): Promise<any> {
    const { timeRange, userId } = jobData;

    try {
      logger.info('Processing media analytics', {
        jobId: job.id,
        userId,
        timeRange,
      });

      // Compute analytics from actual processed directory
      const walk = async (dir: string): Promise<string[]> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        let files: string[] = [];
        for (const e of entries) {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) files = files.concat(await walk(p));
          else files.push(p);
        }
        return files;
      };

      const files = await walk(this.outputDir);
      const images = files.filter(f => ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'].includes(path.extname(f).toLowerCase()));
      const videos = files.filter(f => ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'].includes(path.extname(f).toLowerCase()));
      let totalSize = 0;
      for (const f of files) {
        const s = await fs.stat(f);
        totalSize += s.size;
      }
      const toGB = (bytes: number) => `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;

      // Additionally compute average processing time and success rate from analytics table (last 30d or provided)
      const avgProcessing: number | null = null;
      const successRate: number | null = null;

      const analytics = {
        totalProcessed: files.length,
        imagesOptimized: images.length,
        videosProcessed: videos.length,
        storageUsed: toGB(totalSize),
        averageProcessingTime: avgProcessing,
        successRate,
        popularFormats: Array.from(new Set(files.map(f => path.extname(f).slice(1).toLowerCase()))).slice(0, 5),
        timeRange,
        generatedAt: new Date().toISOString(),
      };

      return {
        success: true,
        analytics,
        processingTime: Date.now() - (job.processedOn ?? Date.now()),
      };
    } catch (error: any) {
      logger.error('Media analytics processing failed', {
        jobId: job.id,
        userId,
        error: error.message,
      });

      throw new Error(`Media analytics processing failed: ${error.message}`);
    }
  }

  /**
   * Get supported formats
   * @returns {Object} Supported formats
   */
  getSupportedFormats(): { images: string[]; videos: string[]; audio: string[] } {
    return this.supportedFormats;
  }

  /**
   * Check if file format is supported
   * @param {string} filename - Filename to check
   * @param {string} type - Type of media (images, videos, audio)
   * @returns {boolean} Whether format is supported
   */
  isFormatSupported(filename: string, type: 'images' | 'videos' | 'audio' = 'images'): boolean {
    const ext = path.extname(filename).toLowerCase().slice(1);
    return this.supportedFormats[type]?.includes(ext) || false;
  }
}

export default MediaProcessor;
