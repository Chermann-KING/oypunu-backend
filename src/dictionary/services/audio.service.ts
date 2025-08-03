/**
 * @fileoverview Service de gestion des fichiers audio pour le dictionnaire O'Ypunu
 * 
 * Ce service gère l'upload, la validation, le stockage et la suppression
 * des fichiers audio (prononciation) via Cloudinary avec contrôles
 * de qualité, formats supportés et optimisations pour le streaming.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, ConfigOptions } from 'cloudinary';
import { ConfigService } from '@nestjs/config';

/**
 * Interface pour le résultat d'upload Cloudinary
 * 
 * @interface CloudinaryUploadResult
 * @property {string} secure_url - URL sécurisée HTTPS du fichier
 * @property {string} public_id - ID public Cloudinary pour gestion
 * @property {string} format - Format du fichier audio (mp3, wav, etc.)
 * @property {number} duration - Durée en secondes
 * @property {number} bytes - Taille du fichier en octets
 * @property {string} resource_type - Type de ressource ('video' pour audio)
 */
interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  duration: number;
  bytes: number;
  resource_type: string;
}

interface AudioValidationConfig {
  maxSizeBytes: number;
  maxDurationSeconds: number;
  allowedFormats: string[];
  allowedMimeTypes: string[];
}

type CloudinaryDestroyResult = { result: string };

const cloudinaryInstance = cloudinary as unknown as {
  config: (config: ConfigOptions) => void;
  uploader: {
    upload_stream: (
      options: any,
      callback: (error: Error | null, result: CloudinaryUploadResult) => void,
    ) => { end: (buffer: Buffer) => void };
    destroy: (id: string, options: any) => Promise<any>;
  };
  url: (id: string, options: any) => string;
};

@Injectable()
export class AudioService {
  private readonly _audioConfig: AudioValidationConfig = {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB max
    maxDurationSeconds: 30, // 30 secondes max pour prononciation
    allowedFormats: ['mp3', 'wav', 'ogg', 'm4a', 'webm'],
    allowedMimeTypes: [
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/mp4',
      'audio/webm',
    ],
  };

  constructor(private _configService: ConfigService) {
    const config: ConfigOptions = {
      cloud_name: this._configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this._configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this._configService.get<string>('CLOUDINARY_API_SECRET'),
    };
    cloudinaryInstance.config(config);
  }

  /**
   * Valide un fichier audio avant upload
   */
  private _validateAudioFile(
    audioBuffer: Buffer,
    mimeType?: string,
  ): { isValid: boolean; error?: string } {
    console.log('🔍 Validation du fichier audio:', {
      bufferSize: audioBuffer.length,
      mimeType: mimeType || 'N/A',
      signature: audioBuffer.slice(0, 12).toString('hex'),
    });

    // 1. Validation de la taille
    if (audioBuffer.length > this._audioConfig.maxSizeBytes) {
      const error = `Fichier trop volumineux. Taille: ${audioBuffer.length} bytes, Maximum: ${this._audioConfig.maxSizeBytes / (1024 * 1024)}MB`;
      console.error('❌ Fichier trop volumineux:', error);
      return {
        isValid: false,
        error: error,
      };
    }

    // 2. Validation basique de taille minimale
    if (audioBuffer.length < 100) {
      const error = 'Fichier trop petit pour être un fichier audio valide';
      console.error('❌ Fichier trop petit:', error);
      return {
        isValid: false,
        error: error,
      };
    }

    // 3. Validation du type MIME (si fourni)
    if (mimeType && !this._audioConfig.allowedMimeTypes.includes(mimeType)) {
      console.warn('⚠️ Type MIME non supporté mais on continue:', mimeType);
      // On ne rejette plus automatiquement, on continue avec la validation des signatures
    }

    // 4. Validation des signatures de fichier (magic bytes)
    const signature = audioBuffer.slice(0, 12).toString('hex');
    const isValidAudio = this._isValidAudioSignature(signature);

    if (!isValidAudio) {
      // Validation moins stricte - on essaie de détecter d'autres patterns
      const extendedSignature = audioBuffer.slice(0, 32).toString('hex');
      console.warn(
        '⚠️ Signature standard non reconnue, vérification étendue:',
        {
          signature: signature,
          extendedSignature: extendedSignature,
        },
      );

      // Patterns supplémentaires pour les fichiers audio web
      const webAudioPatterns = [
        // WebM audio
        /1a45dfa3/i,
        // MP4/M4A patterns alternatifs
        /667479704d344120/i,
        /6674797069736f6d/i,
        // Formats audio HTML5
        /776562206d/i, // "web m"
        // Patterns MP3 encodés différemment
        /ff[ef][0-9a-f]/i,
        // OGG Vorbis patterns
        /4f676753/i,
      ];

      const hasWebPattern = webAudioPatterns.some((pattern) =>
        pattern.test(extendedSignature),
      );

      if (hasWebPattern) {
        console.log('✅ Pattern audio web détecté, acceptation du fichier');
        return { isValid: true };
      }

      // Si toujours pas valide et qu'on a un MIME type audio, on accepte quand même
      if (mimeType && mimeType.startsWith('audio/')) {
        console.log(
          '⚠️ Signature non reconnue mais MIME type audio détecté, acceptation du fichier',
        );
        return { isValid: true };
      }

      const error = 'Le fichier ne semble pas être un fichier audio valide';
      console.error('❌ Validation échouée:', {
        signature: signature,
        mimeType: mimeType,
        error: error,
      });
      return {
        isValid: false,
        error: error,
      };
    }

    console.log('✅ Fichier audio validé avec succès');
    return { isValid: true };
  }

  /**
   * Vérifie les signatures (magic bytes) des fichiers audio
   */
  private _isValidAudioSignature(signature: string): boolean {
    const audioSignatures = [
      // MP3 signatures variées
      'fffb', // MP3 standard
      'fff3', // MP3 MPEG-1 Layer III
      'fff2', // MP3 MPEG-2 Layer III
      'fffa', // MP3 MPEG-2.5 Layer III
      '494433', // MP3 avec ID3v2 tag

      // WAV signatures
      '52494646', // WAV/RIFF

      // OGG signatures
      '4f676753', // OGG

      // FLAC signatures
      '664c6143', // FLAC

      // M4A/MP4 signatures
      '00000018667479704d344120', // M4A type 1
      '00000020667479704d344120', // M4A type 2
      '66747970', // General MP4 container

      // WebM signatures
      '1a45dfa3', // WebM/Matroska

      // Autres formats audio
      '2e7261fd', // Real Audio
      '2e524d46', // RMF Real Media
      '2e524120', // RA Real Audio
    ];

    const sig = signature.toLowerCase();

    // Vérification des signatures exactes
    const hasValidSignature = audioSignatures.some((validSig) =>
      sig.startsWith(validSig.toLowerCase()),
    );

    if (hasValidSignature) {
      return true;
    }

    // Vérification supplémentaire pour MP3 avec frames variables
    // Les MP3 peuvent commencer par différents patterns selon l'encodage
    if (sig.match(/^ff[ef][0-9a-f]/)) {
      return true;
    }

    // Vérification pour les fichiers avec padding au début
    if (sig.startsWith('000000') && sig.length >= 16) {
      // Chercher une signature valide dans les 16 premiers octets
      for (let i = 2; i < 16; i += 2) {
        const subsig = sig.substring(i);
        if (
          audioSignatures.some((validSig) =>
            subsig.startsWith(validSig.toLowerCase()),
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Valide et formate l'accent
   */
  private _validateAndFormatAccent(accent: string): string {
    // Nettoyer et valider l'accent
    const cleanAccent = accent.trim().toLowerCase();

    // Accepter "standard" comme accent par défaut
    if (cleanAccent === 'standard') {
      return cleanAccent;
    }

    // Validation du format (ex: fr-fr, en-us, etc.)
    const accentRegex = /^[a-z]{2}(-[a-z]{2})?$/;
    if (!accentRegex.test(cleanAccent)) {
      // Si le format n'est pas valide, mais que c'est un code de langue simple,
      // on essaie de le convertir
      const langRegex = /^[a-z]{2}$/;
      if (langRegex.test(cleanAccent)) {
        // Convertir les codes de langue en accents par défaut
        const defaultAccents: { [key: string]: string } = {
          fr: 'fr-fr',
          en: 'en-us',
          es: 'es-es',
          de: 'de-de',
          it: 'it-it',
          pt: 'pt-br',
          ru: 'ru-ru',
          ja: 'ja-jp',
          zh: 'zh-cn',
          ar: 'ar-sa',
          ko: 'ko-kr',
          hi: 'hi-in',
        };

        const defaultAccent = defaultAccents[cleanAccent];
        if (defaultAccent) {
          return defaultAccent;
        }
      }

      // Si toujours pas valide, utiliser "standard"
      console.warn(
        `Format d'accent invalide: ${accent}. Utilisation de "standard".`,
      );
      return 'standard';
    }

    return cleanAccent;
  }

  /**
   * Upload un fichier audio phonétique avec validation complète
   */
  async uploadPhoneticAudio(
    word: string,
    language: string,
    audioBuffer: Buffer,
    accent: string = 'standard',
    mimeType?: string,
  ): Promise<{
    url: string;
    cloudinaryId: string;
    format: string;
    duration: number;
    fileSize: number;
  }> {
    try {
      // 1. Validation du fichier
      const validation = this._validateAudioFile(audioBuffer, mimeType);
      if (!validation.isValid) {
        throw new BadRequestException(validation.error);
      }

      // 2. Validation et formatage de l'accent
      const validAccent = this._validateAndFormatAccent(accent);

      // 3. Nettoyage des paramètres
      const cleanWord = word
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      const cleanLanguage = language.trim().toLowerCase();

      // 4. Configuration optimisée pour Cloudinary
      const uploadOptions = {
        resource_type: 'video' as const, // Cohérent pour audio
        folder: `phonetics/${cleanLanguage}/${validAccent}`,
        public_id: `${cleanWord}_${validAccent}_${Date.now()}`, // Éviter les collisions
        format: 'mp3', // Format de sortie standardisé
        quality: 'auto:good', // Optimisation automatique
        flags: 'streaming_attachment', // Optimisé pour le streaming
        // Validation côté Cloudinary
        allowed_formats: this._audioConfig.allowedFormats,
        // Métadonnées
        context: {
          word: cleanWord,
          language: cleanLanguage,
          accent: validAccent,
          uploaded_at: new Date().toISOString(),
        },
      };

      // 5. Upload vers Cloudinary
      const result = await new Promise<CloudinaryUploadResult>(
        (resolve, reject) => {
          const uploadStream = cloudinaryInstance.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) {
                console.error('Cloudinary upload error:', error);
                reject(new Error(`Erreur Cloudinary: ${error.message}`));
              } else if (!result) {
                reject(new Error("Résultat d'upload vide"));
              } else {
                resolve(result);
              }
            },
          );
          uploadStream.end(audioBuffer);
        },
      );

      // 6. Validation post-upload
      if (result.duration > this._audioConfig.maxDurationSeconds) {
        // Supprimer le fichier uploadé si trop long
        await this.deletePhoneticAudio(result.public_id);
        throw new BadRequestException(
          `Audio trop long: ${result.duration}s. Maximum: ${this._audioConfig.maxDurationSeconds}s`,
        );
      }

      return {
        url: result.secure_url,
        cloudinaryId: result.public_id,
        format: result.format,
        duration: result.duration,
        fileSize: result.bytes,
      };
    } catch (error: unknown) {
      console.error('Audio upload error:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(
          `Erreur lors de l'upload audio: ${error.message}`,
        );
      }
      throw new BadRequestException("Erreur inconnue lors de l'upload audio");
    }
  }

  /**
   * Suppression sécurisée d'un fichier audio
   */
  async deletePhoneticAudio(cloudinaryId: string): Promise<void> {
    try {
      if (!cloudinaryId || cloudinaryId.trim() === '') {
        throw new BadRequestException(
          'ID Cloudinary requis pour la suppression',
        );
      }

      const result = (await cloudinaryInstance.uploader.destroy(cloudinaryId, {
        resource_type: 'video',
        invalidate: true,
      })) as CloudinaryDestroyResult;

      if (result.result !== 'ok' && result.result !== 'not found') {
        throw new Error(`Échec de suppression: ${result.result}`);
      }
    } catch (error: unknown) {
      console.error('Audio deletion error:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Error) {
        throw new BadRequestException(
          `Erreur lors de la suppression audio: ${error.message}`,
        );
      }
      throw new BadRequestException(
        'Erreur inconnue lors de la suppression audio',
      );
    }
  }

  /**
   * Génération d'URL optimisée pour la lecture audio
   */
  getAudioUrl(
    cloudinaryId: string,
    options: { quality?: string; format?: string } = {},
  ): string {
    try {
      if (!cloudinaryId) {
        throw new BadRequestException('ID Cloudinary requis');
      }

      const urlOptions = {
        resource_type: 'video' as const,
        format: options.format || 'mp3',
        quality: options.quality || 'auto:good',
        flags: 'streaming_attachment',
        // Cache optimisé
        version: Math.floor(Date.now() / (1000 * 60 * 60)), // Cache 1h
      };

      return cloudinaryInstance.url(cloudinaryId, urlOptions);
    } catch (error) {
      console.error('URL generation error:', error);
      throw new BadRequestException("Impossible de générer l'URL audio");
    }
  }

  /**
   * Génération d'URL avec transformation audio (volume, vitesse, etc.)
   */
  getTransformedAudioUrl(
    cloudinaryId: string,
    transformations: {
      volume?: number; // -100 à 400 (pourcentage)
      speed?: number; // 0.5 à 2.0
      fade_in?: number; // millisecondes
      fade_out?: number; // millisecondes
    } = {},
  ): string {
    const audioTransformations: string[] = [];

    // Volume
    if (transformations.volume !== undefined) {
      const volume = Math.max(-100, Math.min(400, transformations.volume));
      audioTransformations.push(`e_volume:${volume}`);
    }

    // Vitesse de lecture
    if (transformations.speed !== undefined) {
      const speed = Math.max(0.5, Math.min(2.0, transformations.speed));
      audioTransformations.push(`e_accelerate:${Math.round(speed * 100)}`);
    }

    // Fade in/out
    if (transformations.fade_in) {
      audioTransformations.push(`e_fade_in:${transformations.fade_in}`);
    }
    if (transformations.fade_out) {
      audioTransformations.push(`e_fade_out:${transformations.fade_out}`);
    }

    const transformationString = audioTransformations.join(',');

    return cloudinaryInstance.url(cloudinaryId, {
      resource_type: 'video',
      format: 'mp3',
      quality: 'auto:good',
      transformation: transformationString || undefined,
    });
  }

  /**
   * Obtenir les métadonnées d'un fichier audio
   */
  getAudioMetadata(): Promise<{
    duration: number;
    format: string;
    fileSize: number;
    createdAt: Date;
  } | null> {
    try {
      // ?Note: Cette méthode nécessiterait l'API Admin de Cloudinary
      // ?qui n'est pas disponible dans le SDK standard
      // ?Implémentation simplifiée qui retourne null
      return Promise.resolve(null);
    } catch (error) {
      console.error('Metadata fetch error:', error);
      return Promise.resolve(null);
    }
  }
}
