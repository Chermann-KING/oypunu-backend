/**
 * @fileoverview Service de gestion des permissions pour les mots O'Ypunu
 * 
 * Ce service centralise toute la logique de permissions pour les opérations
 * sur les mots du dictionnaire avec validation des rôles, quotas utilisateur
 * et contrôles d'accès granulaires selon les statuts et droits.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, ForbiddenException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { User, UserRole } from '../../../users/schemas/user.schema';
import { CreateWordDto } from '../../dto/create-word.dto';
import { UpdateWordDto } from '../../dto/update-word.dto';
import { Word } from '../../schemas/word.schema';
import { IWordPermissionService } from '../../interfaces/word-permission.interface';
import { WordCoreService } from './word-core.service';
import { QuotaService } from '../../../common/services/quota.service';

/**
 * Service de gestion des permissions pour les mots O'Ypunu
 * 
 * Centralise toute la logique de permissions et de contrôle d'accès
 * pour les opérations sur les mots avec validation des rôles,
 * gestion des quotas et contrôles granulaires selon les statuts.
 * 
 * ## Fonctionnalités de permissions :
 * - Validation création/modification selon rôles utilisateur
 * - Contrôle d'accès granulaire par statut de mot
 * - Gestion quotas par utilisateur et période
 * - Permissions spéciales pour modérateurs/administrateurs
 * - Validation des droits d'approbation et révision
 * 
 * @class WordPermissionService
 * @implements {IWordPermissionService}
 * @version 1.0.0
 */
@Injectable()
export class WordPermissionService implements IWordPermissionService {
  private readonly logger = new Logger(WordPermissionService.name);
  
  constructor(
    @Inject(forwardRef(() => WordCoreService))
    private wordCoreService: WordCoreService,
    private quotaService: QuotaService
  ) {}

  /**
   * Valide qu'un utilisateur peut créer un mot
   */
  async validateWordCreation(dto: CreateWordDto, user: User): Promise<void> {
    if (!user._id) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // Vérifier si l'utilisateur est explicitement inactif (undefined = actif par défaut)
    if (user.isActive === false) {
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
   * PHASE 2-1: Refactoring - Logique complète extraite de words.service.ts
   */
  async canUserEditWord(word: Word, user: User): Promise<boolean>;
  async canUserEditWord(word: Word, user: User, detailed: false): Promise<boolean>;
  async canUserEditWord(
    word: Word, 
    user: User, 
    detailed: true
  ): Promise<{
    canEdit: boolean;
    permissions: {
      isOwner: boolean;
      isAdmin: boolean;
      isContributor: boolean;
      canModifyStatus: boolean;
      canDelete: boolean;
      canAddTranslations: boolean;
    };
    restrictions: string[];
    reason?: string;
  }>;
  async canUserEditWord(
    word: Word, 
    user: User, 
    detailed?: boolean
  ): Promise<boolean | {
    canEdit: boolean;
    permissions: {
      isOwner: boolean;
      isAdmin: boolean;
      isContributor: boolean;
      canModifyStatus: boolean;
      canDelete: boolean;
      canAddTranslations: boolean;
    };
    restrictions: string[];
    reason?: string;
  }> {    console.log("Word:", {
      id: word._id,
      word: word.word,
      createdBy: word.createdBy,
      status: word.status,
    });
    console.log("User:", {
      _id: user._id,
      username: user.username,
      role: user.role,
    });

    // Permissions de base
    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
    const isContributor = user.role === UserRole.CONTRIBUTOR;
    
    // Gérer le cas où createdBy est un ObjectId (string) ou un objet User peuplé
    let createdByIdToCompare: string;
    if (typeof word.createdBy === "object" && "_id" in word.createdBy) {
      createdByIdToCompare = String(word.createdBy._id);    } else {
      createdByIdToCompare = String(word.createdBy);    }

    const userIdToCompare = String(user._id);
    const isOwner = createdByIdToCompare === userIdToCompare;    // Calculer les permissions
    const restrictions: string[] = [];
    let canEdit = false;
    let reason: string | undefined;

    // Administrateurs peuvent tout éditer
    if (isAdmin) {
      console.log("✅ User is admin/superadmin, allowing edit");
      canEdit = true;
    }
    // Vérifications de base
    else if (!word.createdBy) {
      console.log("❌ No createdBy");
      restrictions.push("Aucun créateur identifié");
      reason = "Le mot n'a pas de créateur identifié";
    }
    else if (word.status === "rejected") {
      console.log("❌ Word is rejected");
      restrictions.push("Mot rejeté");
      reason = "Les mots rejetés ne peuvent pas être édités";
    }
    // Propriétaire peut éditer
    else if (isOwner) {
      console.log("✅ User is owner, allowing edit");
      canEdit = true;
    }
    // Contributeurs peuvent aussi éditer les mots en attente
    else if (isContributor && word.status === 'pending') {
      console.log("✅ Contributor can edit pending word");
      canEdit = true;
    }
    else {
      restrictions.push("Permissions insuffisantes");
      reason = "Seuls les administrateurs, le créateur ou les contributeurs (pour les mots en attente) peuvent éditer ce mot";
    }

    console.log("✅ Can edit result:", canEdit);    if (detailed === true) {
      return {
        canEdit,
        permissions: {
          isOwner,
          isAdmin,
          isContributor,
          canModifyStatus: isAdmin || isContributor,
          canDelete: isAdmin || (isOwner && word.status !== 'approved'),
          canAddTranslations: word.status === 'approved',
        },
        restrictions,
        reason,
      };
    }

    return canEdit;
  }

  /**
   * Vérifie si un utilisateur peut éditer un mot par son ID
   * PHASE 2-1: Méthode de convenance qui récupère le mot et délègue vers canUserEditWord
   */
  async canUserEditWordById(wordId: string, user: User): Promise<boolean> {
    try {
      const word = await this.wordCoreService.findOne(wordId);
      if (!word) {
        console.log("❌ Word not found");
        return false;
      }
      
      return this.canUserEditWord(word, user);
    } catch (error) {
      console.log("❌ Error checking word permissions:", error);
      return false;
    }
  }

  /**
   * Vérifie si un utilisateur peut supprimer un mot
   */
  async canUserDeleteWord(word: Word, user: User): Promise<boolean>;
  async canUserDeleteWord(word: Word, user: User, detailed: false): Promise<boolean>;
  async canUserDeleteWord(
    word: Word, 
    user: User, 
    detailed: true
  ): Promise<{
    canDelete: boolean;
    permissions: {
      isOwner: boolean;
      isAdmin: boolean;
      hasLowInteractions: boolean;
    };
    restrictions: string[];
    reason?: string;
  }>;
  async canUserDeleteWord(
    word: Word, 
    user: User, 
    detailed?: boolean
  ): Promise<boolean | {
    canDelete: boolean;
    permissions: {
      isOwner: boolean;
      isAdmin: boolean;
      hasLowInteractions: boolean;
    };
    restrictions: string[];
    reason?: string;
  }> {
    const isAdmin = this.isAdminUser(user);
    const isOwner = word.createdBy?.toString() === user._id?.toString();
    const hasLowInteractions = ((word as any).favoriteCount || 0) < 5;
    
    const restrictions: string[] = [];
    let canDelete = false;
    let reason: string | undefined;

    // Seuls les administrateurs et le créateur peuvent supprimer
    if (isAdmin) {
      canDelete = true;
    } else if (isOwner) {
      // Le créateur peut supprimer seulement si le mot n'est pas encore approuvé
      // ou s'il n'a pas beaucoup d'interactions
      if (word.status === 'approved' && !hasLowInteractions) {
        restrictions.push("Mot approuvé avec beaucoup d'interactions");
        reason = "Les mots approuvés avec plus de 5 favoris ne peuvent pas être supprimés par leur créateur";
      } else {
        canDelete = true;
      }
    } else {
      restrictions.push("Permissions insuffisantes");
      reason = "Seuls les administrateurs et le créateur peuvent supprimer ce mot";
    }

    if (detailed === true) {
      return {
        canDelete,
        permissions: {
          isOwner,
          isAdmin,
          hasLowInteractions,
        },
        restrictions,
        reason,
      };
    }

    return canDelete;
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
  async canUserAddAudio(word: Word, user: User): Promise<boolean> {    console.log('User:', {
      _id: user._id,
      isActive: user.isActive,
      role: user.role
    });
    console.log('Word:', {
      _id: (word as any)._id,
      status: word.status,
      createdBy: (word as any).createdBy,
      createdByType: typeof (word as any).createdBy
    });

    // Tous les utilisateurs authentifiés peuvent ajouter de l'audio
    if (!user._id) {
      console.log('❌ User not authenticated');
      return false;
    }

    // Vérifier si l'utilisateur est explicitement inactif (undefined = actif par défaut)
    if (user.isActive === false) {
      console.log('❌ User explicitly inactive');
      return false;
    }

    // Sauf les utilisateurs bannis (pas dans l'enum actuel)
    // if (user.role === 'banned') {
    //   return false;
    // }

    // Les mots approuvés peuvent toujours recevoir de l'audio
    if (word.status === 'approved') {
      console.log('✅ Word is approved - allowing audio');
      return true;
    }

    // Les mots en attente peuvent recevoir de l'audio de leur créateur
    if (word.status === 'pending') {
      const wordRaw = word as unknown as { createdBy: { _id?: any } | string };
      const createdById = typeof wordRaw.createdBy === 'object' 
        ? String(wordRaw.createdBy._id) 
        : String(wordRaw.createdBy);
      const userId = String(user._id);      const result = createdById === userId;
      console.log(result ? '✅ User is owner - allowing audio' : '❌ User is not owner - denying audio');
      return result;
    }

    // Les mots rejetés ne peuvent pas recevoir d'audio
    console.log('❌ Word status is rejected or unknown - denying audio');
    return false;
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
    try {
      // Mapping des actions vers les quotas correspondants
      const actionQuotaMap: { [key: string]: 'dailyWordCreations' | 'dailyWordUpdates' | 'dailyTranslations' | 'dailyComments' | 'dailyMessages' | 'dailyReports' | 'hourlyApiCalls' | 'hourlyUploads' | 'monthlyWordsLimit' | 'monthlyStorageLimit' } = {
        'create_word': 'dailyWordCreations',
        'update_word': 'dailyWordUpdates',
        'add_translation': 'dailyTranslations',
        'add_comment': 'dailyComments',
        'send_message': 'dailyMessages',
        'report': 'dailyReports',
        'api_call': 'hourlyApiCalls',
        'upload': 'hourlyUploads'
      };

      const quotaAction = actionQuotaMap[action];
      if (!quotaAction) {
        this.logger.warn(`Action de rate limiting non reconnue: ${action}`);
        return true; // Autoriser par défaut pour les actions non mappées
      }

      return await this.quotaService.canPerformAction(
        user._id.toString(), 
        quotaAction, 
        user.role
      );
    } catch (error) {
      this.logger.error(`Erreur vérification rate limit: ${error.message}`, error.stack);
      return false; // Bloquer en cas d'erreur pour la sécurité
    }
  }

  /**
   * Vérifie si un utilisateur peut modérer un mot spécifique
   */
  async canUserModerateWord(
    word: Word, 
    user: User
  ): Promise<{
    canModerate: boolean;
    permissions: {
      isAdmin: boolean;
      isContributor: boolean;
      canApprove: boolean;
      canReject: boolean;
      canRequestChanges: boolean;
    };
    restrictions: string[];
    reason?: string;
  }> {
    const isAdmin = this.isAdminUser(user);
    const isContributor = user.role === UserRole.CONTRIBUTOR;
    
    const restrictions: string[] = [];
    let canModerate = false;
    let reason: string | undefined;

    if (isAdmin || isContributor) {
      canModerate = true;
    } else {
      restrictions.push("Permissions de modération insuffisantes");
      reason = "Seuls les administrateurs et contributeurs peuvent modérer les mots";
    }

    if (word.status === 'approved') {
      restrictions.push("Mot déjà approuvé");
    }

    return {
      canModerate,
      permissions: {
        isAdmin,
        isContributor,
        canApprove: isAdmin || isContributor,
        canReject: isAdmin || isContributor,
        canRequestChanges: isAdmin || isContributor,
      },
      restrictions,
      reason,
    };
  }

  /**
   * Vérifie si un utilisateur peut réviser un mot
   */
  async canUserReviseWord(
    word: Word, 
    user: User
  ): Promise<{
    canRevise: boolean;
    permissions: {
      isAuthenticated: boolean;
      isActive: boolean;
      canSuggestChanges: boolean;
      canCreateRevision: boolean;
    };
    restrictions: string[];
    reason?: string;
  }> {
    const isAuthenticated = !!user._id;
    const isActive = user.isActive;
    
    const restrictions: string[] = [];
    let canRevise = false;
    let reason: string | undefined;

    if (!isAuthenticated) {
      restrictions.push("Utilisateur non authentifié");
      reason = "Vous devez être connecté pour réviser un mot";
    } else if (!isActive) {
      restrictions.push("Compte inactif");
      reason = "Votre compte doit être actif pour réviser des mots";
    } else if (word.status !== 'approved') {
      restrictions.push("Mot non approuvé");
      reason = "Seuls les mots approuvés peuvent être révisés";
    } else {
      canRevise = true;
    }

    return {
      canRevise,
      permissions: {
        isAuthenticated,
        isActive,
        canSuggestChanges: canRevise,
        canCreateRevision: canRevise,
      },
      restrictions,
      reason,
    };
  }

  /**
   * Obtient un résumé des permissions d'un utilisateur pour un mot
   */
  async getWordPermissionSummary(
    word: Word, 
    user: User
  ): Promise<{
    wordId: string;
    userId: string;
    permissions: {
      canView: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canModerate: boolean;
      canRevise: boolean;
      canAddAudio: boolean;
      canAddToFavorites: boolean;
      canTranslate: boolean;
    };
    userRoles: {
      isOwner: boolean;
      isAdmin: boolean;
      isContributor: boolean;
      isRegularUser: boolean;
    };
    wordStatus: string;
    restrictions: string[];
  }> {
    const editPermissions = await this.canUserEditWord(word, user, true) as {
      canEdit: boolean;
      permissions: {
        isOwner: boolean;
        isAdmin: boolean;
        isContributor: boolean;
        canModifyStatus: boolean;
        canDelete: boolean;
        canAddTranslations: boolean;
      };
      restrictions: string[];
    };
    
    const deletePermissions = await this.canUserDeleteWord(word, user, true) as {
      canDelete: boolean;
      permissions: {
        isOwner: boolean;
        isAdmin: boolean;
        hasLowInteractions: boolean;
      };
      restrictions: string[];
    };
    
    const moderatePermissions = await this.canUserModerateWord(word, user);
    const revisePermissions = await this.canUserReviseWord(word, user);
    
    const canView = await this.canUserViewWord(word, user);
    const canAddAudio = await this.canUserAddAudio(word, user);
    const canAddToFavorites = await this.canUserAddToFavorites(word, user);
    
    let canTranslate = false;
    try {
      await this.validateTranslationPermissions(word, user);
      canTranslate = true;
    } catch {
      canTranslate = false;
    }

    const allRestrictions = [
      ...editPermissions.restrictions,
      ...deletePermissions.restrictions,
      ...moderatePermissions.restrictions,
      ...revisePermissions.restrictions,
    ].filter((restriction, index, array) => array.indexOf(restriction) === index); // Remove duplicates

    return {
      wordId: word._id?.toString() || '',
      userId: user._id?.toString() || '',
      permissions: {
        canView,
        canEdit: editPermissions.canEdit,
        canDelete: deletePermissions.canDelete,
        canModerate: moderatePermissions.canModerate,
        canRevise: revisePermissions.canRevise,
        canAddAudio,
        canAddToFavorites,
        canTranslate,
      },
      userRoles: {
        isOwner: editPermissions.permissions.isOwner,
        isAdmin: editPermissions.permissions.isAdmin,
        isContributor: editPermissions.permissions.isContributor,
        isRegularUser: !editPermissions.permissions.isAdmin && !editPermissions.permissions.isContributor,
      },
      wordStatus: word.status,
      restrictions: allRestrictions,
    };
  }

  /**
   * Vérifie les permissions en lot pour plusieurs mots
   */
  async batchCheckUserPermissions(
    wordIds: string[], 
    user: User, 
    permission: 'edit' | 'delete' | 'moderate' | 'view'
  ): Promise<{
    results: Array<{
      wordId: string;
      hasPermission: boolean;
      reason?: string;
    }>;
    summary: {
      total: number;
      allowed: number;
      denied: number;
    };
  }> {
    const results: Array<{
      wordId: string;
      hasPermission: boolean;
      reason?: string;
    }> = [];

    let allowed = 0;
    let denied = 0;

    for (const wordId of wordIds) {
      try {
        const word = await this.wordCoreService.findOne(wordId);
        if (!word) {
          results.push({
            wordId,
            hasPermission: false,
            reason: 'Mot non trouvé',
          });
          denied++;
          continue;
        }

        let hasPermission = false;
        let reason: string | undefined;

        switch (permission) {
          case 'edit':
            const editResult = await this.canUserEditWord(word, user, true) as {
              canEdit: boolean;
              reason?: string;
            };
            hasPermission = editResult.canEdit;
            reason = editResult.reason;
            break;
          case 'delete':
            const deleteResult = await this.canUserDeleteWord(word, user, true) as {
              canDelete: boolean;
              reason?: string;
            };
            hasPermission = deleteResult.canDelete;
            reason = deleteResult.reason;
            break;
          case 'moderate':
            const moderateResult = await this.canUserModerateWord(word, user);
            hasPermission = moderateResult.canModerate;
            reason = moderateResult.reason;
            break;
          case 'view':
            hasPermission = await this.canUserViewWord(word, user);
            if (!hasPermission) {
              reason = 'Permissions de visualisation insuffisantes';
            }
            break;
        }

        results.push({
          wordId,
          hasPermission,
          reason,
        });

        if (hasPermission) {
          allowed++;
        } else {
          denied++;
        }
      } catch (error) {
        results.push({
          wordId,
          hasPermission: false,
          reason: `Erreur lors de la vérification: ${error instanceof Error ? error.message : String(error)}`,
        });
        denied++;
      }
    }

    return {
      results,
      summary: {
        total: wordIds.length,
        allowed,
        denied,
      },
    };
  }

}