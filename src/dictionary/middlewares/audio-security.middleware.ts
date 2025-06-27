import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import type { File as MulterFile } from "multer";

interface AudioUploadRequest extends Request {
  file?: MulterFile;
  audioValidation?: {
    isValid: boolean;
    errors: string[];
    metadata: {
      duration?: number;
      bitrate?: number;
      sampleRate?: number;
      channels?: number;
    };
  };
}

@Injectable()
export class AudioSecurityMiddleware implements NestMiddleware {
  private readonly rateLimitMap = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly uploadLimits = {
    maxUploadsPerHour: 10,
    maxUploadsPerDay: 50,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxDuration: 30, // 30 secondes
  };

  constructor(private configService: ConfigService) {}

  async use(req: AudioUploadRequest, res: Response, next: NextFunction) {
    try {
      // 1. Vérification du rate limiting
      await this.checkRateLimit(req);

      // 2. Validation de sécurité basique
      await this.performSecurityChecks(req);

      // 3. Analyse du fichier audio si présent
      if (req.file || (req as any).files) {
        await this.validateAudioFile(req);
      }

      // 4. Logging sécurisé
      this.logAudioRequest(req);

      next();
    } catch (error) {
      console.error("🚫 Audio Security Middleware Error:", error);
      next(error);
    }
  }

  /**
   * Vérification du rate limiting pour les uploads audio
   */
  private checkRateLimit(req: AudioUploadRequest): void {
    const clientId = this.getClientIdentifier(req);
    const now = Date.now();
    const hourInMs = 60 * 60 * 1000;

    // Nettoyer les anciennes entrées
    this.cleanupRateLimit(now, hourInMs);

    let clientData = this.rateLimitMap.get(clientId);

    if (!clientData) {
      clientData = { count: 0, resetTime: now + hourInMs };
      this.rateLimitMap.set(clientId, clientData);
    }

    // Reset si la période est expirée
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + hourInMs;
    }

    // Vérifier la limite
    if (clientData.count >= this.uploadLimits.maxUploadsPerHour) {
      throw new BadRequestException({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Trop d'uploads audio. Limite: ${this.uploadLimits.maxUploadsPerHour}/heure`,
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
      });
    }

    // Incrémenter le compteur
    clientData.count++;
  }

  /**
   * Contrôles de sécurité généraux
   */
  private performSecurityChecks(req: AudioUploadRequest): void {
    // 1. Vérification des headers suspects
    const suspiciousHeaders = ["x-forwarded-for", "x-real-ip"];
    for (const header of suspiciousHeaders) {
      const value = req.headers[header];
      if (value && typeof value === "string") {
        // Vérifier les patterns d'injection
        if (this.containsSuspiciousPatterns(value)) {
          throw new BadRequestException("Headers suspects détectés");
        }
      }
    }

    // 2. Validation de l'origine
    const origin = req.headers.origin || req.headers.referer;
    if (origin && !this.isValidOrigin(origin)) {
      throw new BadRequestException("Origine non autorisée");
    }

    // 3. Vérification de la taille de la requête
    const contentLength = parseInt(req.headers["content-length"] || "0");
    if (contentLength > this.uploadLimits.maxFileSize * 1.5) {
      // Marge pour les métadonnées
      throw new BadRequestException("Requête trop volumineuse");
    }

    // 4. Validation du User-Agent
    const userAgent = req.headers["user-agent"];
    if (!userAgent || this.isSuspiciousUserAgent(userAgent)) {
      console.warn("🔍 User-Agent suspect:", userAgent);
      // Ne pas bloquer, mais logger
    }
  }

  /**
   * Validation approfondie du fichier audio
   */
  private async validateAudioFile(req: AudioUploadRequest): Promise<void> {
    const file = req.file || (req as any).files?.[0];
    if (!file) return;

    const validation = {
      isValid: true,
      errors: [] as string[],
      metadata: {} as any,
    };

    try {
      // 1. Validation de la taille
      if (file.size > this.uploadLimits.maxFileSize) {
        validation.isValid = false;
        validation.errors.push(
          `Fichier trop volumineux: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
        );
      }

      // 2. Validation de la signature du fichier
      const signatureValidation = this.validateFileSignature(file.buffer);
      if (!signatureValidation.isValid) {
        validation.isValid = false;
        validation.errors.push(...signatureValidation.errors);
      }

      // 3. Analyse des métadonnées audio
      const audioMetadata = await this.extractAudioMetadata(file.buffer);
      validation.metadata = audioMetadata;

      // 4. Validation de la durée
      if (
        audioMetadata.duration &&
        audioMetadata.duration > this.uploadLimits.maxDuration
      ) {
        validation.isValid = false;
        validation.errors.push(
          `Audio trop long: ${audioMetadata.duration}s (max: ${this.uploadLimits.maxDuration}s)`
        );
      }

      // 5. Validation des paramètres audio
      if (audioMetadata.sampleRate && audioMetadata.sampleRate > 96000) {
        validation.errors.push("Sample rate trop élevé (>96kHz)");
      }

      if (audioMetadata.channels && audioMetadata.channels > 2) {
        validation.errors.push("Trop de canaux audio (max: 2)");
      }

      // 6. Détection de contenu malveillant
      const malwareCheck = await this.scanForMalware(file.buffer);
      if (!malwareCheck.safe) {
        validation.isValid = false;
        validation.errors.push("Fichier potentiellement malveillant détecté");
      }
    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`Erreur d'analyse: ${error.message}`);
    }

    // Attacher la validation à la requête
    req.audioValidation = validation;

    // Bloquer si invalide
    if (!validation.isValid) {
      throw new BadRequestException({
        message: "Fichier audio invalide",
        errors: validation.errors,
      });
    }
  }

  /**
   * Validation de la signature du fichier
   */
  private validateFileSignature(buffer: Buffer): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (buffer.length < 12) {
      return { isValid: false, errors: ["Fichier trop petit"] };
    }

    const signature = buffer.slice(0, 12).toString("hex").toLowerCase();

    // Signatures audio valides
    const validSignatures = [
      "fffb", // MP3
      "494433", // MP3 avec ID3
      "52494646", // WAV (RIFF)
      "4f676753", // OGG
      "664c6143", // FLAC
      "000000", // M4A/MP4
      "1a45dfa3", // WebM
    ];

    // Signatures malveillantes connues
    const maliciousSignatures = [
      "4d5a", // Exécutable Windows
      "7f454c46", // ELF (Linux executable)
      "cafebabe", // Java class
      "504b0304", // ZIP/JAR
      "d0cf11e0", // Microsoft Office
    ];

    // Vérifier les signatures malveillantes
    for (const malSig of maliciousSignatures) {
      if (signature.startsWith(malSig)) {
        errors.push("Signature de fichier malveillant détectée");
        return { isValid: false, errors };
      }
    }

    // Vérifier les signatures audio valides
    let isValidAudio = false;
    for (const validSig of validSignatures) {
      if (signature.startsWith(validSig)) {
        isValidAudio = true;
        break;
      }
    }

    if (!isValidAudio) {
      errors.push("Signature de fichier audio non reconnue");
    }

    return { isValid: isValidAudio, errors };
  }

  /**
   * Extraction des métadonnées audio
   */
  private async extractAudioMetadata(buffer: Buffer): Promise<{
    duration?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    format?: string;
  }> {
    try {
      // !Implémentation basique - en production, utiliser une librairie comme node-ffmpeg
      const metadata: any = {};

      // Détection du format basée sur la signature
      const signature = buffer.slice(0, 4).toString("hex").toLowerCase();

      if (signature.startsWith("fffb") || signature.startsWith("4944")) {
        metadata.format = "mp3";
        // Analyse simplifiée MP3
        metadata.duration = this.estimateMP3Duration(buffer);
      } else if (signature.startsWith("5249")) {
        metadata.format = "wav";
        // Analyse WAV
        const wavInfo = this.parseWAVHeader(buffer);
        metadata.duration = wavInfo.duration;
        metadata.sampleRate = wavInfo.sampleRate;
        metadata.channels = wavInfo.channels;
      }

      return metadata;
    } catch (error) {
      console.warn("Erreur extraction métadonnées audio:", error);
      return {};
    }
  }

  /**
   * Estimation de la durée MP3 (simplifiée)
   */
  private estimateMP3Duration(buffer: Buffer): number {
    // Implémentation très basique
    // En production, utiliser une vraie bibliothèque de parsing MP3
    const avgBitrate = 128000; // 128 kbps par défaut
    return (buffer.length * 8) / avgBitrate;
  }

  /**
   * Parse l'en-tête WAV
   */
  private parseWAVHeader(buffer: Buffer): {
    duration: number;
    sampleRate: number;
    channels: number;
  } {
    try {
      // Vérifier le header RIFF/WAVE
      if (
        buffer.toString("ascii", 0, 4) !== "RIFF" ||
        buffer.toString("ascii", 8, 12) !== "WAVE"
      ) {
        throw new Error("Format WAV invalide");
      }

      // Chercher le chunk fmt
      let offset = 12;
      while (offset < buffer.length - 8) {
        const chunkId = buffer.toString("ascii", offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);

        if (chunkId === "fmt ") {
          const channels = buffer.readUInt16LE(offset + 10);
          const sampleRate = buffer.readUInt32LE(offset + 12);
          const byteRate = buffer.readUInt32LE(offset + 16);

          // Trouver le chunk data pour calculer la durée
          let dataOffset = offset + 8 + chunkSize;
          while (dataOffset < buffer.length - 8) {
            const dataChunkId = buffer.toString(
              "ascii",
              dataOffset,
              dataOffset + 4
            );
            if (dataChunkId === "data") {
              const dataSize = buffer.readUInt32LE(dataOffset + 4);
              const duration = dataSize / byteRate;

              return { duration, sampleRate, channels };
            }
            dataOffset += 8 + buffer.readUInt32LE(dataOffset + 4);
          }

          break;
        }

        offset += 8 + chunkSize;
      }

      throw new Error("Impossible de parser les métadonnées WAV");
    } catch (error) {
      console.warn("Erreur parsing WAV:", error);
      return { duration: 0, sampleRate: 44100, channels: 2 };
    }
  }

  /**
   * Scan antimalware basique
   */
  private async scanForMalware(
    buffer: Buffer
  ): Promise<{ safe: boolean; reason?: string }> {
    // 1. Vérifier la taille suspecte
    if (buffer.length < 100) {
      return { safe: false, reason: "Fichier suspicieusement petit" };
    }

    // 2. Chercher des patterns suspects
    const suspiciousPatterns = [
      /exec\(/gi,
      /eval\(/gi,
      /script/gi,
      /<\?php/gi,
      /javascript:/gi,
    ];

    const content = buffer.toString("utf8", 0, Math.min(1024, buffer.length));
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        return { safe: false, reason: "Pattern suspect détecté" };
      }
    }

    // 3. Vérifier l'entropie (fichiers chiffrés/compressés suspects)
    const entropy = this.calculateEntropy(buffer.slice(0, 1024));
    if (entropy > 7.5) {
      console.warn("🔍 Entropie élevée détectée:", entropy);
      // Ne pas bloquer, mais logger
    }

    return { safe: true };
  }

  /**
   * Calcul de l'entropie pour détecter les fichiers suspects
   */
  private calculateEntropy(buffer: Buffer): number {
    const frequencies = new Array(256).fill(0);

    for (let i = 0; i < buffer.length; i++) {
      frequencies[buffer[i]]++;
    }

    let entropy = 0;
    for (const freq of frequencies) {
      if (freq > 0) {
        const p = freq / buffer.length;
        entropy -= p * Math.log2(p);
      }
    }

    return entropy;
  }

  /**
   * Utilitaires
   */
  private getClientIdentifier(req: Request): string {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    return crypto
      .createHash("sha256")
      .update(`${ip}:${userAgent}`)
      .digest("hex");
  }

  private cleanupRateLimit(now: number, maxAge: number): void {
    for (const [key, data] of this.rateLimitMap.entries()) {
      if (now > data.resetTime + maxAge) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  private containsSuspiciousPatterns(value: string): boolean {
    const patterns = [
      /[<>'"]/g, // XSS attempts
      /union\s+select/gi, // SQL injection
      /\.\.\//g, // Path traversal
      /eval\s*\(/gi, // Code injection
    ];

    return patterns.some((pattern) => pattern.test(value));
  }

  private isValidOrigin(origin: string): boolean {
    const allowedOrigins =
      this.configService.get<string[]>("ALLOWED_ORIGINS") || [];
    const allowedPatterns = [
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/.*\.vercel\.app$/,
      /^https?:\/\/.*\.netlify\.app$/,
    ];

    // Vérifier les origines explicitement autorisées
    if (allowedOrigins.includes(origin)) {
      return true;
    }

    // Vérifier les patterns autorisés
    return allowedPatterns.some((pattern) => pattern.test(origin));
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/gi,
      /crawler/gi,
      /spider/gi,
      /scraper/gi,
      /^$/, // User-agent vide
      /^Mozilla\/4\.0$/, // User-agent trop générique
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  private logAudioRequest(req: AudioUploadRequest): void {
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      fileSize: req.file?.size,
      mimeType: req.file?.mimetype,
      validation: req.audioValidation?.isValid ? "passed" : "failed",
    };

    console.log("🎵 Audio Request:", JSON.stringify(logData));
  }
}
