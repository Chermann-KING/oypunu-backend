import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { User, UserRole } from '../../../users/schemas/user.schema';
import { CreateWordDto } from '../../dto/create-word.dto';
import { UpdateWordDto } from '../../dto/update-word.dto';
import { Word } from '../../schemas/word.schema';
import { IWordPermissionService } from '../../interfaces/word-permission.interface';

/**
 * Implémentation du service de permissions pour les mots
 * PHASE 1 - ÉTAPE 1 : Centralisation permissions
 */
@Injectable()
export class WordPermissionService implements IWordPermissionService {

  /**
   * Valide qu'un utilisateur peut créer un mot
   */
  async validateWordCreation(dto: CreateWordDto, user: User): Promise<void> {
    if (!user._id) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // Vérifier si l'utilisateur est actif
    if (!user.isActive) {
      throw new ForbiddenException('Compte utilisateur inactif');
    }

    // Les utilisateurs bannis ne peuvent pas créer de mots
    // Note: 'banned' n'est pas dans l'enum UserRole actuel
    // if (user.role === 'banned') {
    //   throw new ForbiddenException('Utilisateur banni');
    // }

    // Validation des permissions spéciales pour certains statuts
    if (dto.status === 'approved' && !this.canUserApproveRevisions(user)) {
      throw new ForbiddenException(
        'Permissions insuffisantes pour créer un mot directement approuvé'
      );
    }
  }

  /**
   * Valide qu'un utilisateur peut modifier un mot existant
   */
  async validateWordEdit(wordId: string, dto: UpdateWordDto, user: User): Promise<void> {
    if (!user._id) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // TODO: Récupérer le mot et vérifier les permissions
    // Cette méthode sera complétée quand le WordModel sera injecté
    
    // Validation basique des permissions de modification de statut
    if (dto.status && !this.canUserApproveRevisions(user)) {
      throw new ForbiddenException(
        'Permissions insuffisantes pour modifier le statut du mot'
      );
    }
  }

  /**
   * Vérifie si un utilisateur peut éditer un mot spécifique
   */
  async canUserEditWord(word: Word, user: User): Promise<boolean> {
    // Administrateurs peuvent tout éditer
    if (this.isAdminUser(user)) {
      return true;
    }

    // Créateur peut éditer son propre mot
    if (word.createdBy?.toString() === user._id?.toString()) {
      return true;
    }

    // Contributeurs peuvent éditer les mots en attente
    if (user.role === UserRole.CONTRIBUTOR && word.status === 'pending') {
      return true;
    }

    return false;
  }

  /**
   * Vérifie si un utilisateur peut supprimer un mot
   */
  async canUserDeleteWord(word: Word, user: User): Promise<boolean> {
    // Seuls les administrateurs et le créateur peuvent supprimer
    if (this.isAdminUser(user)) {
      return true;
    }

    if (word.createdBy?.toString() === user._id?.toString()) {
      // Le créateur peut supprimer seulement si le mot n'est pas encore approuvé
      // ou s'il n'a pas beaucoup d'interactions
      return word.status !== 'approved' || ((word as any).favoriteCount || 0) < 5;
    }

    return false;
  }

  /**
   * Vérifie si un utilisateur peut approuver des révisions
   */
  canUserApproveRevisions(user: User): boolean {
    return this.isAdminUser(user) || user.role === UserRole.CONTRIBUTOR;
  }

  /**
   * Vérifie si un utilisateur peut ajouter des fichiers audio
   */
  async canUserAddAudio(word: Word, user: User): Promise<boolean> {
    // Tous les utilisateurs authentifiés peuvent ajouter de l'audio
    if (!user._id || !user.isActive) {
      return false;
    }

    // Sauf les utilisateurs bannis (pas dans l'enum actuel)
    // if (user.role === 'banned') {
    //   return false;
    // }

    // Seuls les mots approuvés peuvent recevoir de l'audio
    return word.status === 'approved';
  }

  /**
   * Vérifie si un utilisateur peut voir un mot
   */
  async canUserViewWord(word: Word, user: User): Promise<boolean> {
    // Mots approuvés visibles par tous
    if (word.status === 'approved') {
      return true;
    }

    // Administrateurs voient tout
    if (this.isAdminUser(user)) {
      return true;
    }

    // Créateur voit ses propres mots
    if (word.createdBy?.toString() === user._id?.toString()) {
      return true;
    }

    // Contributeurs voient les mots en attente
    if (user.role === UserRole.CONTRIBUTOR && word.status === 'pending') {
      return true;
    }

    return false;
  }

  /**
   * Valide les permissions pour les opérations de traduction
   */
  async validateTranslationPermissions(word: Word, user: User): Promise<void> {
    if (!user._id || !user.isActive) {
      throw new ForbiddenException('Utilisateur non authentifié ou inactif');
    }

    // if (user.role === 'banned') {
    //   throw new ForbiddenException('Utilisateur banni');
    // }

    // Seuls les mots approuvés peuvent être traduits
    if (word.status !== 'approved') {
      throw new ForbiddenException('Seuls les mots approuvés peuvent être traduits');
    }
  }

  /**
   * Vérifie si un utilisateur peut ajouter aux favoris
   */
  async canUserAddToFavorites(word: Word, user: User): Promise<boolean> {
    if (!user._id || !user.isActive) {
      return false;
    }

    // if (user.role === 'banned') {
    //   return false;
    // }

    // Seuls les mots approuvés peuvent être ajoutés aux favoris
    return word.status === 'approved';
  }

  /**
   * Vérifie si un utilisateur a des permissions d'administrateur
   */
  private isAdminUser(user: User): boolean {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
  }

  /**
   * Vérifie si un utilisateur peut effectuer des actions modérées
   */
  canUserModerate(user: User): boolean {
    return this.isAdminUser(user) || user.role === UserRole.CONTRIBUTOR;
  }

  /**
   * Valide les permissions pour les opérations en lot
   */
  async validateBulkOperationPermissions(user: User, operationType: string): Promise<void> {
    if (!this.isAdminUser(user)) {
      throw new ForbiddenException(
        `Permissions insuffisantes pour l'opération en lot: ${operationType}`
      );
    }
  }

  /**
   * Vérifie les limites de taux pour un utilisateur
   */
  async checkRateLimit(user: User, action: string): Promise<boolean> {
    // TODO: Implémenter la logique de rate limiting
    // Pour l'instant, retourne toujours true
    return true;
  }
}