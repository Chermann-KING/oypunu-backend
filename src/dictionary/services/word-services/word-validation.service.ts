import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Word, WordDocument } from '../../schemas/word.schema';
import { User } from '../../../users/schemas/user.schema';
import { CreateWordDto } from '../../dto/create-word.dto';
import { UpdateWordDto } from '../../dto/update-word.dto';
import { DatabaseErrorHandler } from "../../../common/errors";
import { QuotaService } from '../../../common/services/quota.service';

/**
 * Service centralisé pour la validation métier des mots
 * PHASE 1 - ÉTAPE 4 : Centralisation validation métier
 */
@Injectable()
export class WordValidationService {
  constructor(
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    private quotaService: QuotaService
  ) {}

  /**
   * Valide les données pour la création d'un mot
   */
  async validateWordCreation(dto: CreateWordDto, user: User): Promise<void> {
    return DatabaseErrorHandler.handleDatabaseOperation(
      async () => {
        // Validation basique des champs requis
        this.validateRequiredFields(dto);
        
        // Validation du format du mot
        this.validateWordFormat(dto.word);
        
        // Validation des significations
        this.validateMeanings(dto.meanings);
        
        // Validation de la langue
        await this.validateLanguage(dto.languageId || dto.language);
        
        // Vérification de l'unicité du mot dans la langue
        await this.validateWordUniqueness(dto.word, dto.languageId || dto.language);
        
        // Validation spécifique selon le rôle utilisateur
        await this.validateUserCapabilities(dto, user);
      },
      {
        operationName: 'VALIDATE_WORD_CREATION',
        entityName: 'Word',
        userId: user._id?.toString()
      }
    );
  }

  /**
   * Valide les données pour la mise à jour d'un mot
   */
  async validateWordUpdate(
    wordId: string,
    dto: UpdateWordDto,
    user: User,
    existingWord: Word
  ): Promise<void> {
    return DatabaseErrorHandler.handleDatabaseOperation(
      async () => {
        // Note: UpdateWordDto ne contient pas le champ 'word' directement
        // Cette validation sera ajustée selon les besoins métier
        // if (dto.word) {
        //   this.validateWordFormat(dto.word);
        //   
        //   // Vérifier l'unicité si le mot change
        //   if (dto.word !== existingWord.word) {
        //     await this.validateWordUniqueness(
        //       dto.word,
        //       dto.languageId || existingWord.language,
        //       wordId
        //     );
        //   }
        // }
        
        // Validation des significations si modifiées
        if (dto.meanings) {
          this.validateMeanings(dto.meanings);
        }
        
        // Validation des permissions de modification
        this.validateUpdatePermissions(dto, user, existingWord);
      },
      {
        operationName: 'VALIDATE_WORD_UPDATE',
        entityName: 'Word',
        entityId: wordId,
        userId: user._id?.toString()
      }
    );
  }

  /**
   * Valide qu'un mot peut être supprimé
   */
  async validateWordDeletion(word: Word, user: User): Promise<void> {
    // Seuls les créateurs ou admins peuvent supprimer
    if (word.createdBy?.toString() !== user._id?.toString() && 
        !['admin', 'superadmin'].includes(user.role)) {
      throw new BadRequestException(
        'Vous ne pouvez supprimer que vos propres mots ou être administrateur'
      );
    }

    // Empêcher la suppression de mots avec beaucoup d'interactions
    if ((word as any).favoriteCount > 10) {
      throw new BadRequestException(
        'Ce mot ne peut pas être supprimé car il est trop utilisé par la communauté'
      );
    }
  }

  /**
   * Valide le format et le contenu d'un mot
   */
  private validateWordFormat(word: string): void {
    if (!word || word.trim().length === 0) {
      throw new BadRequestException('Le mot ne peut pas être vide');
    }

    if (word.length < 1 || word.length > 100) {
      throw new BadRequestException('Le mot doit contenir entre 1 et 100 caractères');
    }

    // Vérifier les caractères interdits
    const forbiddenChars = /[<>\"'&]/;
    if (forbiddenChars.test(word)) {
      throw new BadRequestException('Le mot contient des caractères interdits');
    }

    // Pas uniquement des espaces ou des caractères spéciaux
    if (!/[a-zA-ZÀ-ÿ\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF]/.test(word)) {
      throw new BadRequestException('Le mot doit contenir au moins une lettre');
    }
  }

  /**
   * Valide les significations d'un mot
   */
  private validateMeanings(meanings: any[]): void {
    if (!meanings || meanings.length === 0) {
      throw new BadRequestException('Au moins une signification est requise');
    }

    if (meanings.length > 10) {
      throw new BadRequestException('Maximum 10 significations autorisées');
    }

    meanings.forEach((meaning, index) => {
      if (!meaning.partOfSpeech) {
        throw new BadRequestException(`Classe grammaticale requise pour la signification ${index + 1}`);
      }

      if (!meaning.definitions || meaning.definitions.length === 0) {
        throw new BadRequestException(`Au moins une définition requise pour la signification ${index + 1}`);
      }

      meaning.definitions.forEach((def: any, defIndex: number) => {
        if (!def.definition || def.definition.trim().length === 0) {
          throw new BadRequestException(
            `Définition ${defIndex + 1} de la signification ${index + 1} ne peut pas être vide`
          );
        }

        if (def.definition.length > 500) {
          throw new BadRequestException(
            `Définition ${defIndex + 1} trop longue (max 500 caractères)`
          );
        }
      });
    });
  }

  /**
   * Valide qu'une langue existe et est active
   */
  private async validateLanguage(language: string): Promise<void> {
    if (!language || language.trim().length === 0) {
      throw new BadRequestException('La langue est requise');
    }

    // TODO: Vérifier que la langue existe dans la base de données
    // Cette validation sera implémentée quand le service Language sera injecté
  }

  /**
   * Valide l'unicité d'un mot dans une langue
   */
  private async validateWordUniqueness(
    word: string,
    language: string,
    excludeWordId?: string
  ): Promise<void> {
    const query: any = {
      word: new RegExp(`^${word.trim()}$`, 'i'),
      $or: [
        { language: language },
        { languageId: language }
      ]
    };

    if (excludeWordId) {
      query._id = { $ne: excludeWordId };
    }

    const existingWord = await this.wordModel.findOne(query);
    
    if (existingWord) {
      throw new BadRequestException(
        `Le mot "${word}" existe déjà dans cette langue`
      );
    }
  }

  /**
   * Valide les champs requis pour la création
   */
  private validateRequiredFields(dto: CreateWordDto): void {
    if (!dto.word) {
      throw new BadRequestException('Le mot est requis');
    }

    if (!dto.languageId && !dto.language) {
      throw new BadRequestException('La langue est requise');
    }

    if (!dto.meanings || dto.meanings.length === 0) {
      throw new BadRequestException('Au moins une signification est requise');
    }
  }

  /**
   * Valide les capacités de l'utilisateur selon son rôle
   */
  private async validateUserCapabilities(dto: CreateWordDto, user: User): Promise<void> {
    // Les utilisateurs normaux ne peuvent pas créer de mots directement approuvés
    if (dto.status === 'approved' && !['admin', 'superadmin', 'contributor'].includes(user.role)) {
      throw new BadRequestException(
        'Vous ne pouvez pas créer de mots directement approuvés'
      );
    }

    // Limite du nombre de mots par jour pour les utilisateurs normaux
    if (user.role !== 'admin') {
      await this.quotaService.enforceQuota(user._id.toString(), 'dailyWordCreations', user.role);
    }
  }

  /**
   * Valide les permissions pour la mise à jour
   */
  private validateUpdatePermissions(
    dto: UpdateWordDto,
    user: User,
    existingWord: Word
  ): void {
    // Seuls le créateur ou les admins peuvent modifier
    if (existingWord.createdBy?.toString() !== user._id?.toString() && 
        !['admin', 'superadmin'].includes(user.role)) {
      throw new BadRequestException(
        'Vous ne pouvez modifier que vos propres mots'
      );
    }

    // Les utilisateurs normaux ne peuvent pas changer le status directement
    if (dto.status && 
        dto.status !== existingWord.status && 
        !['admin', 'superadmin'].includes(user.role)) {
      throw new BadRequestException(
        'Vous ne pouvez pas modifier le statut du mot'
      );
    }
  }

  /**
   * Valide les données d'un fichier audio
   */
  validateAudioFile(audioData: any): void {
    if (!audioData.url) {
      throw new BadRequestException('URL audio requise');
    }

    if (!audioData.accent) {
      throw new BadRequestException('Accent requis pour le fichier audio');
    }

    if (audioData.accent.length > 50) {
      throw new BadRequestException('Nom de l\'accent trop long');
    }

    // Validation basique de l'URL
    try {
      new URL(audioData.url);
    } catch {
      throw new BadRequestException('URL audio invalide');
    }
  }

  /**
   * Valide les données pour l'ajout aux favoris
   */
  async validateFavoriteAddition(wordId: string, userId: string): Promise<void> {
    if (!wordId || !userId) {
      throw new BadRequestException('ID du mot et utilisateur requis');
    }

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new BadRequestException('Mot non trouvé');
    }

    if (word.status !== 'approved') {
      throw new BadRequestException('Seuls les mots approuvés peuvent être ajoutés aux favoris');
    }
  }
}