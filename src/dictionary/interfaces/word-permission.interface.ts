import { User } from '../../users/schemas/user.schema';
import { CreateWordDto } from '../dto/create-word.dto';
import { UpdateWordDto } from '../dto/update-word.dto';
import { Word } from '../schemas/word.schema';

/**
 * Interface pour la gestion centralisée des permissions sur les mots
 * PHASE 1 - ÉTAPE 1 : Extraction responsabilités permissions
 */
export interface IWordPermissionService {
  /**
   * Valide qu'un utilisateur peut créer un mot
   */
  validateWordCreation(dto: CreateWordDto, user: User): Promise<void>;

  /**
   * Valide qu'un utilisateur peut modifier un mot existant
   */
  validateWordEdit(wordId: string, dto: UpdateWordDto, user: User): Promise<void>;

  /**
   * Vérifie si un utilisateur peut éditer un mot spécifique
   */
  canUserEditWord(word: Word, user: User): Promise<boolean>;

  /**
   * Vérifie si un utilisateur peut supprimer un mot
   */
  canUserDeleteWord(word: Word, user: User): Promise<boolean>;

  /**
   * Vérifie si un utilisateur peut approuver des révisions
   */
  canUserApproveRevisions(user: User): boolean;

  /**
   * Vérifie si un utilisateur peut ajouter des fichiers audio
   */
  canUserAddAudio(word: Word, user: User): Promise<boolean>;

  /**
   * Vérifie si un utilisateur peut voir un mot (status, visibilité)
   */
  canUserViewWord(word: Word, user: User): Promise<boolean>;

  /**
   * Valide les permissions pour les opérations de traduction
   */
  validateTranslationPermissions(word: Word, user: User): Promise<void>;

  /**
   * Vérifie si un utilisateur peut ajouter aux favoris
   */
  canUserAddToFavorites(word: Word, user: User): Promise<boolean>;
}