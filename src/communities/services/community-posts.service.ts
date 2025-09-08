/**
 * @fileoverview Service de gestion des publications et commentaires communautaires
 * 
 * Ce service gère l'écosystème complet des publications dans les communautés
 * O'Ypunu, incluant création, modération, votes, commentaires et statistiques.
 * Il fournit un système sophistiqué de contenu généré par les utilisateurs
 * avec validation des permissions et anti-spam.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Community, CommunityDocument } from '../schemas/community.schema';
import {
  CommunityPost,
  CommunityPostDocument,
} from '../schemas/community-post.schema';
import {
  PostComment,
  PostCommentDocument,
} from '../schemas/post-comment.schema';
import {
  CommunityMember,
  CommunityMemberDocument,
} from '../schemas/community-member.schema';
import { Vote, VoteDocument } from '../schemas/vote.schema';
import { VotingService, VoteResult } from './voting.service';

/**
 * Interface pour les données d'auteur populées
 * 
 * @interface Author
 * @property {string} _id - ID de l'utilisateur auteur
 * @property {string} username - Nom d'utilisateur affiché
 * @property {string} [profilePicture] - URL optionnelle de la photo de profil
 */
interface Author {
  _id: string;
  username: string;
  profilePicture?: string;
}

/**
 * Interface pour les filtres de recherche de publications
 * 
 * @interface PostFilters
 * @property {string} [sortBy] - Critère de tri (score, newest, oldest, activity, controversial)
 * @property {string} [postType] - Type de publication (question, explanation, etc.)
 * @property {string[]} [languages] - Langues des publications
 * @property {string} [difficulty] - Niveau de difficulté
 * @property {string[]} [tags] - Tags à inclure
 * @property {string} [timeRange] - Période de temps (day, week, month, year, all)
 */
interface PostFilters {
  sortBy?: 'score' | 'newest' | 'oldest' | 'activity' | 'controversial';
  postType?: string;
  languages?: string[];
  difficulty?: string;
  tags?: string[];
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
}

/**
 * Service de gestion des publications et commentaires communautaires
 * 
 * Ce service sophistiqué gère l'écosystème complet des publications
 * dans les communautés O'Ypunu avec des fonctionnalités avancées :
 * 
 * ## Fonctionnalités principales :
 * 
 * ### 📝 Gestion de publications
 * - Création avec validation des permissions et contenus
 * - Types multiples (question, explication, étymologie, usage, etc.)
 * - Support multilingue et tags thématiques
 * - Système anti-spam et validation de longueur
 * 
 * ### 💬 Système de commentaires
 * - Commentaires hiérarchiques (threads imbriqués)
 * - Types de commentaires spécialisés (correction, explication, exemple)
 * - Réponses acceptées pour les questions
 * - Modération collaborative
 * 
 * ### 🗳️ Système de votes sophistiqué
 * - Upvotes/downvotes avec raisons optionnelles
 * - Calcul de score avec algorithmes anti-manipulation
 * - Votes sur publications et commentaires
 * - Historique et analytics de votes
 * 
 * ### 🔍 Recherche et tri avancés
 * - Tri par score, activité, date, controverse
 * - Filtres multicritères (langue, type, difficulté, tags)
 * - Recherche dans plages temporelles
 * - Posts tendances avec méthiques de popularité
 * 
 * ### 📊 Analytics et statistiques
 * - Compteurs de vues anti-triche
 * - Statistiques par communauté et contributeur
 * - Métriques d'engagement et qualité
 * - Rapports de modération
 * 
 * ### 🛡️ Modération et sécurité
 * - Vérification des permissions (membre, modérateur, admin)
 * - Soft delete avec archivage
 * - Épinglage de contenu important
 * - Protection contre abus et spam
 * 
 * @class CommunityPostsService
 * @version 1.0.0
 */
@Injectable()
export class CommunityPostsService {
  /**
   * Constructeur avec injection des modèles Mongoose et services
   * 
   * @constructor
   * @param {Model<CommunityDocument>} communityModel - Modèle des communautés
   * @param {Model<CommunityPostDocument>} postModel - Modèle des publications
   * @param {Model<PostCommentDocument>} commentModel - Modèle des commentaires
   * @param {Model<CommunityMemberDocument>} memberModel - Modèle des membres
   * @param {Model<VoteDocument>} voteModel - Modèle des votes
   * @param {VotingService} votingService - Service de gestion des votes
   */
  constructor(
    @InjectModel(Community.name)
    private communityModel: Model<CommunityDocument>,
    @InjectModel(CommunityPost.name)
    private postModel: Model<CommunityPostDocument>,
    @InjectModel(PostComment.name)
    private commentModel: Model<PostCommentDocument>,
    @InjectModel(CommunityMember.name)
    private memberModel: Model<CommunityMemberDocument>,
    @InjectModel(Vote.name)
    private voteModel: Model<VoteDocument>,
    private votingService: VotingService,
  ) {}

  private async _isCommunityMember(
    communityId: string,
    userId: string,
  ): Promise<boolean> {
    // Essayer d'abord sans conversion ObjectId
    let member = await this.memberModel.findOne({
      communityId: communityId,
      userId: userId,
    });

    // Si pas trouvé, essayer avec conversion ObjectId
    if (!member) {
      member = await this.memberModel.findOne({
        communityId: new Types.ObjectId(communityId),
        userId: new Types.ObjectId(userId),
      });
    }

    return !!member;
  }

  private async _getMemberRole(
    communityId: string,
    userId: string,
  ): Promise<string | null> {
    const member = await this.memberModel.findOne({
      communityId: new Types.ObjectId(communityId),
      userId: new Types.ObjectId(userId),
    });
    return member ? member.role : null;
  }

  private _buildSortQuery(sortBy: string, timeRange?: string) {
    let sort: any = {};
    const timeFilter: any = {};

    // Filtre temporel si spécifié
    if (timeRange && timeRange !== 'all') {
      const now = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      timeFilter.createdAt = { $gte: startDate };
    }

    // Logique de tri
    switch (sortBy) {
      case 'score':
        sort = { isPinned: -1, score: -1, createdAt: -1 };
        break;
      case 'newest':
        sort = { isPinned: -1, createdAt: -1 };
        break;
      case 'oldest':
        sort = { isPinned: -1, createdAt: 1 };
        break;
      case 'activity':
        sort = { isPinned: -1, lastActivityAt: -1 };
        break;
      case 'controversial':
        // Les posts controversés ont beaucoup d'upvotes ET downvotes
        sort = { isPinned: -1, downvotes: -1, upvotes: -1 };
        break;
      default:
        sort = { isPinned: -1, score: -1, createdAt: -1 };
    }

    return { sort, timeFilter };
  }

  /**
   * Crée une nouvelle publication dans une communauté
   * 
   * Cette méthode centrale gère la création de publications avec validation
   * complète des permissions, données et appartenance à la communauté.
   * Elle applique des règles anti-spam et valide le contenu selon les
   * standards de qualité de la plateforme.
   * 
   * @async
   * @method createPost
   * @param {string} communityId - ID de la communauté cible
   * @param {string} userId - ID de l'utilisateur créateur
   * @param {Object} postData - Données de la publication
   * @param {string} postData.title - Titre (max 200 caractères)
   * @param {string} postData.content - Contenu (max 5000 caractères)
   * @param {string} postData.postType - Type (question, explanation, etymology, usage, translation, discussion)
   * @param {string[]} [postData.languages] - Langues concernées
   * @param {string[]} [postData.tags] - Tags thématiques (max 5)
   * @param {string} [postData.targetWord] - Mot cible pour étymologies/explications
   * @param {string} [postData.difficulty] - Niveau de difficulté
   * @returns {Promise<CommunityPost>} Publication créée
   * @throws {NotFoundException} Si la communauté n'existe pas
   * @throws {ForbiddenException} Si l'utilisateur n'est pas membre
   * @throws {BadRequestException} Si les données sont invalides
   * 
   * @example
   * ```typescript
   * const newPost = await this.communityPostsService.createPost(
   *   communityId,
   *   userId,
   *   {
   *     title: 'Comment dit-on "bonjour" en Yipunu ?',
   *     content: 'Je cherche la traduction exacte avec la prononciation.',
   *     postType: 'question',
   *     languages: ['yipunu', 'français'],
   *     tags: ['salutations', 'débutant'],
   *     difficulty: 'beginner'
   *   }
   * );
   * ```
   */
  async createPost(
    communityId: string,
    userId: string,
    postData: {
      title: string;
      content: string;
      postType: string;
      languages?: string[];
      tags?: string[];
      targetWord?: string;
      difficulty?: string;
    },
  ): Promise<CommunityPost> {
    // Vérifier si la communauté existe
    const community = await this.communityModel.findById(communityId);
    if (!community) {
      throw new NotFoundException(
        `Communauté non trouvée avec l'ID ${communityId}`,
      );
    }

    // Vérifier si l'utilisateur est membre de la communauté
    const isMember = await this._isCommunityMember(communityId, userId);

    if (!isMember) {
      throw new ForbiddenException(
        `Vous devez être membre de la communauté pour créer une publication`,
      );
    }

    // Validation des données
    if (!postData.title?.trim() || !postData.content?.trim()) {
      throw new BadRequestException('Le titre et le contenu sont requis');
    }

    if (postData.title.length > 200) {
      throw new BadRequestException(
        'Le titre ne peut pas dépasser 200 caractères',
      );
    }

    if (postData.content.length > 5000) {
      throw new BadRequestException(
        'Le contenu ne peut pas dépasser 5000 caractères',
      );
    }

    if (postData.tags && postData.tags.length > 5) {
      throw new BadRequestException('Maximum 5 tags autorisés');
    }

    const validPostTypes = [
      'question',
      'explanation',
      'etymology',
      'usage',
      'translation',
      'discussion',
    ];
    if (!validPostTypes.includes(postData.postType)) {
      throw new BadRequestException('Type de publication invalide');
    }

    const newPost = new this.postModel({
      communityId: new Types.ObjectId(communityId),
      authorId: new Types.ObjectId(userId),
      title: postData.title.trim(),
      content: postData.content.trim(),
      postType: postData.postType,
      languages: postData.languages || [],
      tags: postData.tags || [],
      targetWord: postData.targetWord?.trim(),
      difficulty: postData.difficulty || 'beginner',
      status: 'active',
      lastActivityAt: new Date(),
    });

    const savedPost = await newPost.save();
    return savedPost;
  }

  /**
   * Récupère les publications d'une communauté avec filtrage avancé
   * 
   * Cette méthode complexe gère la récupération paginée des publications
   * avec support complet pour les filtres multicritères, tri sophistiqué
   * et optimisations de performance. Elle enrichit chaque publication
   * avec les données de l'auteur et métadonnées.
   * 
   * @async
   * @method getPostsByCommunity
   * @param {string} communityId - ID de la communauté
   * @param {number} [page=1] - Numéro de page pour pagination
   * @param {number} [limit=10] - Nombre de publications par page
   * @param {PostFilters} [filters={}] - Filtres de recherche et tri
   * @returns {Promise<Object>} Résultat paginé avec publications enrichies
   * @property {any[]} posts - Publications avec données auteur
   * @property {number} total - Nombre total de publications
   * @property {number} page - Page actuelle
   * @property {number} limit - Limite par page
   * @property {number} totalPages - Nombre total de pages
   * @throws {NotFoundException} Si la communauté n'existe pas
   * 
   * @example
   * ```typescript
   * const result = await this.communityPostsService.getPostsByCommunity(
   *   communityId,
   *   1,
   *   20,
   *   {
   *     sortBy: 'score',
   *     postType: 'question',
   *     languages: ['yipunu'],
   *     timeRange: 'week'
   *   }
   * );
   * ```
   */
  async getPostsByCommunity(
    communityId: string,
    page = 1,
    limit = 10,
    filters: PostFilters = {},
  ): Promise<{
    posts: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Vérifier si la communauté existe
    const community = await this.communityModel.findById(communityId);
    if (!community) {
      throw new NotFoundException(
        `Communauté non trouvée avec l'ID ${communityId}`,
      );
    }

    const skip = (page - 1) * limit;

    // Construction de la requête
    let query: any = {
      communityId: new Types.ObjectId(communityId),
      status: 'active',
    };

    // Filtres
    if (filters.postType) {
      query.postType = filters.postType;
    }

    if (filters.languages?.length) {
      query.languages = { $in: filters.languages };
    }

    if (filters.difficulty) {
      query.difficulty = filters.difficulty;
    }

    if (filters.tags?.length) {
      query.tags = { $in: filters.tags };
    }

    // Tri et filtre temporel
    const { sort, timeFilter } = this._buildSortQuery(
      filters.sortBy || 'score',
      filters.timeRange,
    );
    query = { ...query, ...timeFilter };

    const count = await this.postModel.countDocuments(query);

    const posts = await this.postModel
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('authorId', 'username profilePicture')
      .lean()
      .exec();

    // Ajouter les informations de vote pour chaque post
    const postsWithVoteInfo = posts.map((post) => ({
      ...post,
      _id: post._id.toString(),
      communityId: post.communityId.toString(),
      authorId: {
        _id: post.authorId._id.toString(),
        username: post.authorId.username,
        profilePicture: post.authorId.profilePicture,
      },
    }));

    return {
      posts: postsWithVoteInfo,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  // Récupérer une publication spécifique avec ses votes
  async getPostById(postId: string, userId?: string): Promise<any> {
    const post = await this.postModel
      .findById(postId)
      .populate('authorId', 'username profilePicture')
      .lean()
      .exec();

    if (!post) {
      throw new NotFoundException(
        `Publication non trouvée avec l'ID ${postId}`,
      );
    }

    // Système anti-triche pour les vues : une seule vue par utilisateur par session/jour
    let shouldIncrementViews = true;

    if (userId) {
      // Vérifier si l'utilisateur a déjà vu ce post aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Chercher dans les métadonnées du post si cet utilisateur a déjà vu le post aujourd'hui
      const existingPost = await this.postModel.findById(postId);
      const viewedToday = existingPost?.viewersToday?.includes(userId);

      if (!viewedToday) {
        // Ajouter l'utilisateur à la liste des viewers d'aujourd'hui et incrémenter les vues
        await this.postModel.findByIdAndUpdate(postId, {
          $inc: { views: 1 },
          $addToSet: { viewersToday: userId },
        });

        // Nettoyer la liste des viewers d'aujourd'hui à minuit (via un job CRON ou lors de la prochaine vue)
        // Pour l'instant, on peut implémenter une logique simple de nettoyage
        const lastResetDate = existingPost?.lastViewersReset || new Date(0);
        if (lastResetDate < today) {
          await this.postModel.findByIdAndUpdate(postId, {
            $set: {
              viewersToday: [userId],
              lastViewersReset: today,
            },
          });
        }
      }
      shouldIncrementViews = false; // Déjà géré ci-dessus
    } else {
      // Utilisateur anonyme : on incrémente toujours (mais on pourrait ajouter une logique IP-based)
      await this.postModel.findByIdAndUpdate(postId, { $inc: { views: 1 } });
      shouldIncrementViews = false;
    }

    let userVote: 'up' | 'down' | null = null;
    if (userId) {
      const vote = await this.voteModel.findOne({
        userId: new Types.ObjectId(userId),
        targetType: 'community_post',
        targetId: new Types.ObjectId(postId),
      });
      userVote = vote ? vote.voteType : null;
    }

    return {
      ...post,
      _id: post._id.toString(),
      communityId: post.communityId.toString(),
      authorId: {
        _id: post.authorId._id.toString(),
        username: post.authorId.username,
        profilePicture: post.authorId.profilePicture,
      },
      userVote,
    };
  }

  // Voter pour une publication
  async votePost(
    postId: string,
    userId: string,
    voteType: 'up' | 'down',
    reason?: string,
  ): Promise<VoteResult> {
    return await this.votingService.castVote(
      userId,
      'community_post',
      postId,
      voteType,
      reason,
    );
  }

  // Voter pour un commentaire
  async voteComment(
    commentId: string,
    userId: string,
    voteType: 'up' | 'down',
    reason?: string,
  ): Promise<VoteResult> {
    return await this.votingService.castVote(
      userId,
      'post_comment',
      commentId,
      voteType,
      reason,
    );
  }

  // Obtenir les votes d'un utilisateur pour plusieurs posts/commentaires
  async getUserVotesForContent(
    userId: string,
    postIds: string[] = [],
    commentIds: string[] = [],
  ): Promise<{
    posts: Map<string, string | null>;
    comments: Map<string, string | null>;
  }> {
    const targets = [
      ...postIds.map((id) => ({ type: 'community_post' as const, id })),
      ...commentIds.map((id) => ({ type: 'post_comment' as const, id })),
    ];

    const allVotes = await this.votingService.getUserVotes(userId, targets);

    const posts = new Map<string, string | null>();
    const comments = new Map<string, string | null>();

    postIds.forEach((id) => {
      posts.set(id, allVotes.get(id) || null);
    });

    commentIds.forEach((id) => {
      comments.set(id, allVotes.get(id) || null);
    });

    return { posts, comments };
  }

  /**
   * Ajoute un commentaire à une publication avec validation complète
   * 
   * Cette méthode gère l'ajout de commentaires avec support pour les threads
   * imbriqués, types de commentaires spécialisés et validation des permissions.
   * Elle vérifie l'appartenance à la communauté et applique les règles
   * de longueur et de contenu.
   * 
   * @async
   * @method addComment
   * @param {string} postId - ID de la publication à commenter
   * @param {string} userId - ID de l'utilisateur commentateur
   * @param {string} content - Contenu du commentaire (max 2000 caractères)
   * @param {string} [commentType='general'] - Type (correction, explanation, example, translation, general)
   * @param {string} [parentCommentId] - ID du commentaire parent pour threads imbriqués
   * @returns {Promise<PostComment>} Commentaire créé
   * @throws {NotFoundException} Si la publication ou le parent n'existe pas
   * @throws {ForbiddenException} Si l'utilisateur n'est pas membre
   * @throws {BadRequestException} Si les données sont invalides
   * 
   * @example
   * ```typescript
   * const comment = await this.communityPostsService.addComment(
   *   postId,
   *   userId,
   *   'En Yipunu, on dit "mbolo" pour dire bonjour.',
   *   'explanation'
   * );
   * 
   * // Réponse à un commentaire
   * const reply = await this.communityPostsService.addComment(
   *   postId,
   *   userId,
   *   'Merci pour cette explication !',
   *   'general',
   *   comment._id
   * );
   * ```
   */
  async addComment(
    postId: string,
    userId: string,
    content: string,
    commentType: string = 'general',
    parentCommentId?: string,
  ): Promise<PostComment> {
    // Vérifier si la publication existe
    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException(
        `Publication non trouvée avec l'ID ${postId}`,
      );
    }

    // Vérifier si l'utilisateur est membre de la communauté
    const communityId = post.communityId.toString();
    const isMember = await this._isCommunityMember(communityId, userId);
    if (!isMember) {
      throw new ForbiddenException(
        `Vous devez être membre de la communauté pour commenter`,
      );
    }

    // Validation
    if (!content?.trim()) {
      throw new BadRequestException('Le contenu du commentaire est requis');
    }

    if (content.length > 2000) {
      throw new BadRequestException(
        'Le commentaire ne peut pas dépasser 2000 caractères',
      );
    }

    const validCommentTypes = [
      'correction',
      'explanation',
      'example',
      'translation',
      'general',
    ];
    if (!validCommentTypes.includes(commentType)) {
      throw new BadRequestException('Type de commentaire invalide');
    }

    // Vérifier si le commentaire parent existe (si spécifié)
    if (parentCommentId) {
      const parentComment = await this.commentModel.findById(parentCommentId);
      if (!parentComment || parentComment.postId.toString() !== postId) {
        throw new BadRequestException('Commentaire parent invalide');
      }
    }

    const newComment = new this.commentModel({
      postId: new Types.ObjectId(postId),
      authorId: new Types.ObjectId(userId),
      content: content.trim(),
      commentType,
      parentCommentId: parentCommentId
        ? new Types.ObjectId(parentCommentId)
        : undefined,
      status: 'active',
    });

    return await newComment.save();
  }

  // Récupérer les commentaires d'une publication
  async getCommentsByPost(
    postId: string,
    page = 1,
    limit = 20,
    sortBy: 'score' | 'newest' | 'oldest' = 'score',
  ): Promise<{
    comments: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    let sort: any = {};
    switch (sortBy) {
      case 'score':
        sort = { isAccepted: -1, isPinned: -1, score: -1, createdAt: -1 };
        break;
      case 'newest':
        sort = { isAccepted: -1, isPinned: -1, createdAt: -1 };
        break;
      case 'oldest':
        sort = { isAccepted: -1, isPinned: -1, createdAt: 1 };
        break;
    }

    const query = {
      postId: new Types.ObjectId(postId),
      parentCommentId: { $exists: false }, // Commentaires principaux seulement
      status: 'active',
    };

    const count = await this.commentModel.countDocuments(query);

    const comments = await this.commentModel
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('authorId', 'username profilePicture')
      .lean()
      .exec();

    // Pour chaque commentaire, récupérer ses réponses
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await this.commentModel
          .find({
            parentCommentId: comment._id,
            status: 'active',
          })
          .sort({ createdAt: 1 })
          .populate('authorId', 'username profilePicture')
          .lean()
          .exec();

        return {
          ...comment,
          _id: comment._id.toString(),
          postId: comment.postId.toString(),
          authorId: {
            _id: comment.authorId._id.toString(),
            username: comment.authorId.username,
            profilePicture: comment.authorId.profilePicture,
          },
          replies: replies.map((reply) => ({
            ...reply,
            _id: reply._id.toString(),
            postId: reply.postId.toString(),
            authorId: {
              _id: reply.authorId._id.toString(),
              username: reply.authorId.username,
              profilePicture: reply.authorId.profilePicture,
            },
          })),
        };
      }),
    );

    return {
      comments: commentsWithReplies,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  // Marquer un commentaire comme réponse acceptée (pour les questions)
  async acceptAnswer(
    postId: string,
    commentId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException('Publication introuvable');
    }

    const comment = await this.commentModel.findById(commentId);
    if (!comment || comment.postId.toString() !== postId) {
      throw new NotFoundException('Commentaire introuvable');
    }

    // Seul l'auteur du post peut accepter une réponse
    if (post.authorId.toString() !== userId) {
      throw new ForbiddenException(
        "Seul l'auteur de la question peut accepter une réponse",
      );
    }

    // Seuls les posts de type "question" peuvent avoir des réponses acceptées
    if (post.postType !== 'question') {
      throw new BadRequestException(
        'Seules les questions peuvent avoir des réponses acceptées',
      );
    }

    // Retirer l'acceptation des autres commentaires
    await this.commentModel.updateMany(
      { postId: new Types.ObjectId(postId) },
      { isAccepted: false },
    );

    // Marquer ce commentaire comme accepté
    await this.commentModel.findByIdAndUpdate(commentId, { isAccepted: true });

    return { success: true, message: 'Réponse acceptée avec succès' };
  }

  // Épingler/dépingler un post (modérateurs et admins seulement)
  async togglePinPost(
    postId: string,
    userId: string,
  ): Promise<{ success: boolean; isPinned: boolean; message: string }> {
    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException('Publication introuvable');
    }

    // Vérifier les permissions (modérateur ou admin de la communauté)
    const memberRole = await this._getMemberRole(
      post.communityId.toString(),
      userId,
    );
    if (!memberRole || !['moderator', 'admin'].includes(memberRole)) {
      throw new ForbiddenException('Permissions insuffisantes');
    }

    const newPinnedStatus = !post.isPinned;
    await this.postModel.findByIdAndUpdate(postId, {
      isPinned: newPinnedStatus,
    });

    return {
      success: true,
      isPinned: newPinnedStatus,
      message: newPinnedStatus ? 'Publication épinglée' : 'Épinglage retiré',
    };
  }

  // Supprimer une publication (auteur, modérateur ou admin)
  async deletePost(
    postId: string,
    userId: string,
    userRole: string,
  ): Promise<{ success: boolean }> {
    const post = await this.postModel.findById(postId);

    if (!post) {
      throw new NotFoundException(
        `Publication non trouvée avec l'ID ${postId}`,
      );
    }

    // Vérifier les permissions
    const isAuthor = post.authorId.toString() === userId;
    const isAdmin = userRole === 'admin';

    let isModerator = false;
    if (!isAuthor && !isAdmin) {
      const member = await this.memberModel.findOne({
        communityId: post.communityId,
        userId: new Types.ObjectId(userId),
        role: { $in: ['moderator', 'admin'] },
      });
      isModerator = !!member;
    }

    if (!isAuthor && !isAdmin && !isModerator) {
      throw new ForbiddenException(
        `Vous n'avez pas les droits pour supprimer cette publication`,
      );
    }

    // Marquer comme supprimé plutôt que supprimer complètement
    await this.postModel.findByIdAndUpdate(postId, { status: 'deleted' });

    // Marquer les commentaires comme supprimés aussi
    await this.commentModel.updateMany(
      { postId: new Types.ObjectId(postId) },
      { status: 'deleted' },
    );

    return { success: true };
  }

  // Supprimer un commentaire (auteur, modérateur ou admin)
  async deleteComment(
    commentId: string,
    userId: string,
    userRole: string,
  ): Promise<{ success: boolean }> {
    const comment = await this.commentModel.findById(commentId);

    if (!comment) {
      throw new NotFoundException(
        `Commentaire non trouvé avec l'ID ${commentId}`,
      );
    }

    // Vérifier les permissions
    const isAuthor = comment.authorId.toString() === userId;
    const isAdmin = userRole === 'admin';

    let isModerator = false;
    if (!isAuthor && !isAdmin) {
      const post = await this.postModel.findById(comment.postId);
      if (post) {
        const member = await this.memberModel.findOne({
          communityId: post.communityId,
          userId: new Types.ObjectId(userId),
          role: { $in: ['moderator', 'admin'] },
        });
        isModerator = !!member;
      }
    }

    if (!isAuthor && !isAdmin && !isModerator) {
      throw new ForbiddenException(
        `Vous n'avez pas les droits pour supprimer ce commentaire`,
      );
    }

    // Marquer comme supprimé
    await this.commentModel.findByIdAndUpdate(commentId, { status: 'deleted' });

    // Marquer les réponses comme supprimées aussi
    await this.commentModel.updateMany(
      { parentCommentId: new Types.ObjectId(commentId) },
      { status: 'deleted' },
    );

    // Décrémenter le compteur de commentaires de la publication
    await this.postModel.findByIdAndUpdate(comment.postId, {
      $inc: { commentsCount: -1 },
    });

    return { success: true };
  }

  // Obtenir les posts tendances (score élevé récemment)
  async getTrendingPosts(
    communityId: string,
    limit = 10,
    timeRange: 'day' | 'week' | 'month' = 'week',
  ): Promise<any[]> {
    const { timeFilter } = this._buildSortQuery('score', timeRange);

    const query = {
      communityId: new Types.ObjectId(communityId),
      status: 'active',
      score: { $gte: 1 }, // Au moins un score positif
      ...timeFilter,
    };

    return await this.postModel
      .find(query)
      .sort({ score: -1, upvotes: -1 })
      .limit(limit)
      .populate('authorId', 'username profilePicture')
      .lean()
      .exec();
  }

  // Obtenir les statistiques d'une communauté
  async getCommunityStats(communityId: string): Promise<{
    totalPosts: number;
    totalComments: number;
    totalScore: number;
    averageScore: number;
    topContributors: any[];
    postsByType: any[];
  }> {
    const communityObjectId = new Types.ObjectId(communityId);

    // Statistiques des posts
    const postStats = await this.postModel.aggregate([
      { $match: { communityId: communityObjectId, status: 'active' } },
      {
        $group: {
          _id: null,
          totalPosts: { $sum: 1 },
          totalScore: { $sum: '$score' },
          averageScore: { $avg: '$score' },
        },
      },
    ]);

    // Statistiques par type de post
    const postsByType = await this.postModel.aggregate([
      { $match: { communityId: communityObjectId, status: 'active' } },
      {
        $group: {
          _id: '$postType',
          count: { $sum: 1 },
          averageScore: { $avg: '$score' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Nombre total de commentaires
    const commentStats = await this.commentModel.aggregate([
      {
        $lookup: {
          from: 'communityposts',
          localField: 'postId',
          foreignField: '_id',
          as: 'post',
        },
      },
      { $unwind: '$post' },
      { $match: { 'post.communityId': communityObjectId, status: 'active' } },
      { $count: 'totalComments' },
    ]);

    // Top contributeurs
    const topContributors = await this.postModel.aggregate([
      { $match: { communityId: communityObjectId, status: 'active' } },
      {
        $group: {
          _id: '$authorId',
          totalPosts: { $sum: 1 },
          totalScore: { $sum: '$score' },
          averageScore: { $avg: '$score' },
        },
      },
      { $sort: { totalScore: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          username: '$user.username',
          profilePicture: '$user.profilePicture',
          totalPosts: 1,
          totalScore: 1,
          averageScore: { $round: ['$averageScore', 1] },
        },
      },
    ]);

    return {
      totalPosts: postStats[0]?.totalPosts || 0,
      totalComments: commentStats[0]?.totalComments || 0,
      totalScore: postStats[0]?.totalScore || 0,
      averageScore: Math.round((postStats[0]?.averageScore || 0) * 10) / 10,
      topContributors,
      postsByType,
    };
  }
}
