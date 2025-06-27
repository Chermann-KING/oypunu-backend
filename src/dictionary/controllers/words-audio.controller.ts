import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from '../../users/schemas/user.schema';
import { Word } from '../schemas/word.schema';
import { WordsService } from '../services/words.service';

interface RequestWithUser {
  user: User;
}

// Interceptor personnalisé pour la validation audio
class AudioFileInterceptor {
  static create() {
    return FileInterceptor('audioFile', {
      // Limites de sécurité
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
        files: 1, // Un seul fichier
      },
      // Filtrage des fichiers
      fileFilter: (req, file, callback) => {
        // Validation du type MIME
        const allowedMimeTypes = [
          'audio/mpeg',
          'audio/mp3',
          'audio/wav',
          'audio/x-wav',
          'audio/ogg',
          'audio/mp4',
          'audio/m4a',
          'audio/webm',
          'audio/x-m4a',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              `Format audio non supporté: ${file.mimetype}. ` +
                `Formats acceptés: ${allowedMimeTypes.join(', ')}`,
            ),
            false,
          );
        }

        // Validation de l'extension
        const allowedExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.webm'];
        const fileExtension = file.originalname
          .toLowerCase()
          .substring(file.originalname.lastIndexOf('.'));

        if (!allowedExtensions.includes(fileExtension)) {
          return callback(
            new BadRequestException(
              `Extension de fichier non supportée: ${fileExtension}. ` +
                `Extensions acceptées: ${allowedExtensions.join(', ')}`,
            ),
            false,
          );
        }

        callback(null, true);
      },
    });
  }
}

@Controller('words-audio')
export class WordsAudioController {
  constructor(private readonly wordsService: WordsService) {}

  @Post(':id/audio')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(AudioFileInterceptor.create())
  @ApiOperation({
    summary: "Téléverser un fichier audio pour la prononciation d'un mot",
    description: `
        Téléverse un fichier audio pour la prononciation d'un mot spécifique.
        
        **Contraintes:**
        - Taille maximum: 10MB
        - Formats supportés: MP3, WAV, OGG, M4A, WebM
        - Durée maximum: 30 secondes (vérifiée après upload)
        - Seuls les créateurs du mot et les admins peuvent ajouter des prononciations
        
        **Formats d'accent supportés:**
        - fr-fr, fr-ca (Français)
        - en-us, en-gb (Anglais)  
        - es-es, es-mx (Espagnol)
        - de-de (Allemand)
        - it-it (Italien)
        - pt-br (Portugais)
        - standard (générique)
      `,
  })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiBody({
    description: 'Fichier audio et accent',
    schema: {
      type: 'object',
      required: ['accent', 'audioFile'],
      properties: {
        accent: {
          type: 'string',
          example: 'fr-fr',
          description: 'Accent ou dialecte (format: langue-région)',
          pattern: '^[a-z]{2}(-[a-z]{2})?$',
        },
        audioFile: {
          type: 'string',
          format: 'binary',
          description: 'Fichier audio (MP3, WAV, OGG, M4A, WebM)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Fichier audio téléversé avec succès',
    type: Word,
    schema: {
      example: {
        id: '60a1b2c3d4e5f6a7b8c9d0e1',
        word: 'bonjour',
        language: 'fr',
        audioFiles: {
          'fr-fr': {
            url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/phonetics/fr/fr-fr/bonjour_fr-fr.mp3',
            cloudinaryId: 'phonetics/fr/fr-fr/bonjour_fr-fr',
            language: 'fr',
            accent: 'fr-fr',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Fichier invalide, accent invalide, ou données manquantes',
    schema: {
      example: {
        statusCode: 400,
        message:
          'Format audio non supporté: audio/video. Formats acceptés: audio/mpeg, audio/wav, audio/ogg, audio/mp4, audio/webm',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Token d'authentification manquant ou invalide",
  })
  @ApiResponse({
    status: 403,
    description: 'Permissions insuffisantes pour modifier ce mot',
  })
  @ApiResponse({
    status: 404,
    description: 'Mot non trouvé',
  })
  @ApiResponse({
    status: 413,
    description: 'Fichier trop volumineux (> 10MB)',
  })
  @ApiResponse({
    status: 422,
    description:
      'Audio trop long (> 30 secondes) ou autre erreur de validation',
  })
  async uploadAudio(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({
            fileType: /^audio\/(mpeg|mp3|wav|x-wav|ogg|mp4|m4a|webm|x-m4a)$/,
          }),
        ],
        errorHttpStatusCode: 422,
        exceptionFactory: (error) => {
          return new BadRequestException(
            `Validation du fichier échouée: ${error}`,
          );
        },
      }),
    )
    file: Express.Multer.File,
    @Body('accent') accent: string,
  ): Promise<Word> {
    // 1. Validation des paramètres requis
    if (!file) {
      throw new BadRequestException('Fichier audio manquant.');
    }

    if (!accent || accent.trim() === '') {
      throw new BadRequestException("L'accent est requis.");
    }

    // 2. Validation du format d'accent
    this.validateAccentFormat(accent);

    // 3. Validation supplémentaire du fichier
    this.validateAudioFile(file);

    // 4. Log pour audit
    console.log(`🎵 Upload audio pour mot ${id}:`, {
      userId: req.user._id,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      accent: accent,
      timestamp: new Date().toISOString(),
    });

    try {
      // 5. Appel au service avec gestion d'erreur
      const updatedWord = await this.wordsService.addAudioFile(
        id,
        accent.trim().toLowerCase(),
        file.buffer,
        req.user,
      );

      // 6. Log de succès
      console.log(
        `✅ Audio uploadé avec succès pour mot ${id}, accent ${accent}`,
      );

      return updatedWord;
    } catch (error) {
      // 7. Log d'erreur détaillé
      console.error(`❌ Erreur upload audio pour mot ${id}:`, {
        error: error instanceof Error ? error.message : '',
        userId: req.user._id,
        fileName: file.originalname,
        accent: accent,
      });

      throw error;
    }
  }

  @Delete(':id/audio/:accent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Supprimer un fichier audio de prononciation',
    description: `
        Supprime un fichier audio de prononciation pour un accent spécifique.
        Seuls les créateurs du mot et les admins peuvent supprimer des prononciations.
      `,
  })
  @ApiParam({
    name: 'id',
    description: 'ID du mot',
    example: '60a1b2c3d4e5f6a7b8c9d0e1',
  })
  @ApiParam({
    name: 'accent',
    description: 'Accent à supprimer',
    example: 'fr-fr',
  })
  @ApiResponse({
    status: 200,
    description: 'Fichier audio supprimé avec succès',
    type: Word,
  })
  @ApiResponse({
    status: 400,
    description: 'Accent invalide ou fichier non trouvé',
  })
  @ApiResponse({
    status: 401,
    description: 'Non autorisé',
  })
  @ApiResponse({
    status: 403,
    description: 'Permissions insuffisantes',
  })
  @ApiResponse({
    status: 404,
    description: 'Mot non trouvé',
  })
  async deleteAudio(
    @Param('id') id: string,
    @Param('accent') accent: string,
    @Request() req: RequestWithUser,
  ): Promise<Word> {
    // 1. Validation de l'accent
    this.validateAccentFormat(accent);

    // 2. Log pour audit
    console.log(`🗑️ Suppression audio pour mot ${id}, accent ${accent}:`, {
      userId: req.user._id,
      timestamp: new Date().toISOString(),
    });

    try {
      // 3. Appel au service de suppression
      const updatedWord = await this.wordsService.deleteAudioFile(
        id,
        accent.trim().toLowerCase(),
        req.user,
      );

      // 4. Log de succès
      console.log(
        `✅ Audio supprimé avec succès pour mot ${id}, accent ${accent}`,
      );

      return updatedWord;
    } catch (error) {
      // 5. Log d'erreur
      console.error(`❌ Erreur suppression audio pour mot ${id}:`, {
        error: error instanceof Error ? error.message : '',
        userId: req.user._id,
        accent: accent,
      });

      throw error;
    }
  }

  /**
   * Validation du format d'accent
   */
  private validateAccentFormat(accent: string): void {
    const accentRegex = /^[a-z]{2}(-[a-z]{2})?$/;
    const cleanAccent = accent.trim().toLowerCase();

    if (!accentRegex.test(cleanAccent)) {
      throw new BadRequestException(
        "Format d'accent invalide. Utilisez le format: fr-fr, en-us, standard, etc.",
      );
    }

    // Liste des accents supportés
    const supportedAccents = [
      'fr-fr',
      'fr-ca',
      'en-us',
      'en-gb',
      'es-es',
      'es-mx',
      'de-de',
      'it-it',
      'pt-br',
      'pt-pt',
      'ru-ru',
      'ja-jp',
      'zh-cn',
      'zh-tw',
      'ko-kr',
      'ar-sa',
      'hi-in',
      'standard',
    ];

    if (!supportedAccents.includes(cleanAccent)) {
      throw new BadRequestException(
        `Accent non supporté: ${cleanAccent}. ` +
          `Accents supportés: ${supportedAccents.join(', ')}`,
      );
    }
  }

  /**
   * Validation supplémentaire du fichier audio
   */
  private validateAudioFile(file: Express.Multer.File): void {
    // 1. Vérification de la taille (double-check)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException(
        `Fichier trop volumineux: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum: 10MB`,
      );
    }

    // 2. Vérification de la taille minimale
    if (file.size < 1024) {
      // 1KB minimum
      throw new BadRequestException('Fichier audio trop petit. Minimum: 1KB');
    }

    // 3. Validation du nom de fichier
    if (!file.originalname || file.originalname.length > 255) {
      throw new BadRequestException('Nom de fichier invalide ou trop long');
    }

    // 4. Vérifier les caractères spéciaux
    const specialChars = /[<>:"/\\|?*]/;
    if (specialChars.test(file.originalname)) {
      throw new BadRequestException(
        'Le nom de fichier contient des caractères non autorisés',
      );
    }
    // Vérifier les caractères de contrôle (code < 32)
    for (let i = 0; i < file.originalname.length; i++) {
      if (file.originalname.charCodeAt(i) < 32) {
        throw new BadRequestException(
          'Le nom de fichier contient des caractères de contrôle non autorisés',
        );
      }
    }

    // 5. Validation des signatures de fichier (magic bytes)
    this.validateFileSignature(file.buffer);
  }

  /**
   * Validation de la signature du fichier (magic bytes)
   */
  private validateFileSignature(buffer: Buffer): void {
    if (buffer.length < 12) {
      throw new BadRequestException(
        'Fichier trop petit pour être un audio valide',
      );
    }

    const signature = buffer.slice(0, 12).toString('hex');

    // Signatures audio connues
    const audioSignatures = new Map([
      ['mp3', ['fffb', '494433']], // MP3 et MP3 avec ID3
      ['wav', ['52494646']], // WAV (RIFF)
      ['ogg', ['4f676753']], // OGG
      ['m4a', ['00000018667479704d344120', '00000020667479704d344120']], // M4A
      ['webm', ['1a45dfa3']], // WebM
    ]);

    let isValidSignature = false;

    // Vérifier contre toutes les signatures audio
    for (const signatures of audioSignatures.values()) {
      for (const sig of signatures) {
        if (signature.toLowerCase().startsWith(sig.toLowerCase())) {
          isValidSignature = true;
          break;
        }
      }
      if (isValidSignature) break;
    }

    if (!isValidSignature) {
      throw new BadRequestException(
        'Le fichier ne semble pas être un fichier audio valide. ' +
          "Vérifiez que le fichier n'est pas corrompu.",
      );
    }
  }
}
