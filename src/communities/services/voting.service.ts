import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Vote, VoteDocument } from '../schemas/vote.schema';
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

export interface VoteResult {
  success: boolean;
  newScore: number;
  upvotes: number;
  downvotes: number;
  userVote: 'up' | 'down' | null;
  message: string;
}

interface VoteValidation {
  canVote: boolean;
  reason?: string;
  cooldownRemaining?: number;
}

interface ControversialItem {
  type: string;
  id: string;
  score: number;
  controversy: number;
}

@Injectable()
export class VotingService {
  private readonly VOTE_COOLDOWN_MINUTES = 1; // Cooldown entre votes du même utilisateur
  private readonly MAX_DAILY_VOTES = 100; // Limite quotidienne de votes par utilisateur
  private readonly MIN_ACCOUNT_AGE_HOURS = 24; // Âge minimum du compte pour voter

  constructor(
    @InjectModel(Vote.name)
    private voteModel: Model<VoteDocument>,
    @InjectModel(CommunityPost.name)
    private postModel: Model<CommunityPostDocument>,
    @InjectModel(PostComment.name)
    private commentModel: Model<PostCommentDocument>,
    @InjectModel(CommunityMember.name)
    private memberModel: Model<CommunityMemberDocument>,
  ) {}

  /**
   * Valide si un utilisateur peut voter
   */
  private async _validateVotePermissions(
    userId: string,
    targetType: 'community_post' | 'post_comment',
    targetId: string,
  ): Promise<VoteValidation> {
    // Vérifier si l'utilisateur est membre de la communauté
    let communityId: string;

    if (targetType === 'community_post') {
      const post = await this.postModel.findById(targetId);
      if (!post) {
        return { canVote: false, reason: 'Post introuvable' };
      }
      communityId = post.communityId.toString();

      // L'auteur ne peut pas voter pour son propre post
      if (post.authorId.toString() === userId) {
        return {
          canVote: false,
          reason: 'Vous ne pouvez pas voter pour votre propre publication',
        };
      }

      // Vérifier si le post est actif
      if (post.status !== 'active') {
        return {
          canVote: false,
          reason: "Cette publication n'est plus active",
        };
      }
    } else {
      const comment = await this.commentModel
        .findById(targetId)
        .populate('postId');
      if (!comment || !comment.postId) {
        return { canVote: false, reason: 'Commentaire introuvable' };
      }

      const post = comment.postId as any;
      communityId = post.communityId.toString();

      // L'auteur ne peut pas voter pour son propre commentaire
      if (comment.authorId.toString() === userId) {
        return {
          canVote: false,
          reason: 'Vous ne pouvez pas voter pour votre propre commentaire',
        };
      }

      // Vérifier si le commentaire est actif
      if (comment.status !== 'active') {
        return { canVote: false, reason: "Ce commentaire n'est plus actif" };
      }
    }

    // Vérifier l'appartenance à la communauté
    const membership = await this.memberModel.findOne({
      communityId: new Types.ObjectId(communityId),
      userId: new Types.ObjectId(userId),
    });

    if (!membership) {
      return {
        canVote: false,
        reason: 'Vous devez être membre de la communauté pour voter',
      };
    }

    // Vérifier le cooldown entre votes
    const recentVote = await this.voteModel
      .findOne({
        userId: new Types.ObjectId(userId),
        createdAt: {
          $gte: new Date(Date.now() - this.VOTE_COOLDOWN_MINUTES * 60 * 1000),
        },
      })
      .sort({ createdAt: -1 });

    if (recentVote) {
      const voteDoc = recentVote as any; // Cast pour accéder à createdAt
      const cooldownRemaining = Math.ceil(
        (voteDoc.createdAt.getTime() +
          this.VOTE_COOLDOWN_MINUTES * 60 * 1000 -
          Date.now()) /
          1000,
      );
      return {
        canVote: false,
        reason: 'Veuillez attendre avant de voter à nouveau',
        cooldownRemaining,
      };
    }

    // Vérifier la limite quotidienne
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyVoteCount = await this.voteModel.countDocuments({
      userId: new Types.ObjectId(userId),
      createdAt: { $gte: today },
    });

    if (dailyVoteCount >= this.MAX_DAILY_VOTES) {
      return { canVote: false, reason: 'Limite quotidienne de votes atteinte' };
    }

    return { canVote: true };
  }

  /**
   * Voter pour un post ou commentaire
   */
  async castVote(
    userId: string,
    targetType: 'community_post' | 'post_comment',
    targetId: string,
    voteType: 'up' | 'down',
    reason?: string,
  ): Promise<VoteResult> {
    // Validation des paramètres
    if (!['up', 'down'].includes(voteType)) {
      throw new BadRequestException('Type de vote invalide');
    }

    if (!Types.ObjectId.isValid(targetId)) {
      throw new BadRequestException('ID de cible invalide');
    }

    // Valider les permissions
    const validation = await this._validateVotePermissions(
      userId,
      targetType,
      targetId,
    );
    if (!validation.canVote) {
      throw new ForbiddenException(validation.reason);
    }

    // Vérifier si l'utilisateur a déjà voté
    const existingVote = await this.voteModel.findOne({
      userId: new Types.ObjectId(userId),
      targetType,
      targetId: new Types.ObjectId(targetId),
    });

    let scoreChange = 0;
    let upvoteChange = 0;
    let downvoteChange = 0;

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // Retirer le vote existant (toggle)
        await this.voteModel.deleteOne({ _id: existingVote._id });
        scoreChange = voteType === 'up' ? -1 : 1;
        upvoteChange = voteType === 'up' ? -1 : 0;
        downvoteChange = voteType === 'down' ? -1 : 0;
      } else {
        // Changer le type de vote
        existingVote.voteType = voteType;
        existingVote.reason = reason;
        await existingVote.save();
        scoreChange = voteType === 'up' ? 2 : -2; // Double changement (remove + add)
        upvoteChange = voteType === 'up' ? 1 : -1;
        downvoteChange = voteType === 'down' ? 1 : -1;
      }
    } else {
      // Nouveau vote
      await this.voteModel.create({
        userId: new Types.ObjectId(userId),
        targetType,
        targetId: new Types.ObjectId(targetId),
        voteType,
        reason,
      });
      scoreChange = voteType === 'up' ? 1 : -1;
      upvoteChange = voteType === 'up' ? 1 : 0;
      downvoteChange = voteType === 'down' ? 1 : 0;
    }

    // Mettre à jour les scores dans le document cible
    const updateQuery = {
      $inc: {
        score: scoreChange,
        upvotes: upvoteChange,
        downvotes: downvoteChange,
      },
    };

    let updatedDocument;
    if (targetType === 'community_post') {
      updatedDocument = await this.postModel.findByIdAndUpdate(
        targetId,
        updateQuery,
        { new: true },
      );
    } else {
      updatedDocument = await this.commentModel.findByIdAndUpdate(
        targetId,
        updateQuery,
        { new: true },
      );
    }

    if (!updatedDocument) {
      throw new NotFoundException('Cible introuvable');
    }

    // Retourner le vote actuel de l'utilisateur
    const currentVote = await this.voteModel.findOne({
      userId: new Types.ObjectId(userId),
      targetType,
      targetId: new Types.ObjectId(targetId),
    });

    return {
      success: true,
      newScore: updatedDocument.score,
      upvotes: updatedDocument.upvotes,
      downvotes: updatedDocument.downvotes,
      userVote: currentVote ? currentVote.voteType : null,
      message: 'Vote enregistré avec succès',
    };
  }

  /**
   * Obtenir les votes d'un utilisateur pour plusieurs contenus
   */
  async getUserVotes(
    userId: string,
    targets: Array<{ type: 'community_post' | 'post_comment'; id: string }>,
  ): Promise<Map<string, 'up' | 'down' | null>> {
    const votes = await this.voteModel.find({
      userId: new Types.ObjectId(userId),
      $or: targets.map((target) => ({
        targetType: target.type,
        targetId: new Types.ObjectId(target.id),
      })),
    });

    const voteMap = new Map<string, 'up' | 'down' | null>();

    // Initialiser tous les targets avec null
    targets.forEach((target) => {
      voteMap.set(target.id, null);
    });

    // Remplir avec les votes existants
    votes.forEach((vote) => {
      voteMap.set(vote.targetId.toString(), vote.voteType);
    });

    return voteMap;
  }

  /**
   * Obtenir les statistiques de vote pour un contenu
   */
  async getVoteStats(
    targetType: 'community_post' | 'post_comment',
    targetId: string,
  ): Promise<{
    score: number;
    upvotes: number;
    downvotes: number;
    totalVotes: number;
    upvotePercentage: number;
  }> {
    let document;
    if (targetType === 'community_post') {
      document = await this.postModel.findById(targetId);
    } else {
      document = await this.commentModel.findById(targetId);
    }

    if (!document) {
      throw new NotFoundException('Contenu introuvable');
    }

    const totalVotes = document.upvotes + document.downvotes;
    const upvotePercentage =
      totalVotes > 0 ? (document.upvotes / totalVotes) * 100 : 0;

    return {
      score: document.score,
      upvotes: document.upvotes,
      downvotes: document.downvotes,
      totalVotes,
      upvotePercentage: Math.round(upvotePercentage),
    };
  }

  /**
   * Nettoyer les votes orphelins (dont les cibles ont été supprimées)
   */
  async cleanupOrphanedVotes(): Promise<{ deletedCount: number }> {
    // Supprimer les votes pour des posts inexistants
    const postIds = await this.postModel.distinct('_id');
    const orphanedPostVotes = await this.voteModel.deleteMany({
      targetType: 'community_post',
      targetId: { $nin: postIds },
    });

    // Supprimer les votes pour des commentaires inexistants
    const commentIds = await this.commentModel.distinct('_id');
    const orphanedCommentVotes = await this.voteModel.deleteMany({
      targetType: 'post_comment',
      targetId: { $nin: commentIds },
    });

    return {
      deletedCount:
        orphanedPostVotes.deletedCount + orphanedCommentVotes.deletedCount,
    };
  }

  /**
   * Obtenir les votes controversés (beaucoup d'upvotes ET downvotes)
   */
  async getControversialContent(
    communityId: string,
    limit = 10,
  ): Promise<ControversialItem[]> {
    // Récupérer les posts controversés
    const controversialPosts = await this.postModel
      .find({
        communityId: new Types.ObjectId(communityId),
        upvotes: { $gte: 5 },
        downvotes: { $gte: 5 },
      })
      .select('_id score upvotes downvotes')
      .limit(limit)
      .sort({ upvotes: -1, downvotes: -1 });

    // Récupérer les commentaires controversés
    const controversialComments = await this.commentModel
      .find({
        upvotes: { $gte: 3 },
        downvotes: { $gte: 3 },
      })
      .populate({
        path: 'postId',
        match: { communityId: new Types.ObjectId(communityId) },
        select: '_id',
      })
      .select('_id score upvotes downvotes')
      .limit(limit)
      .sort({ upvotes: -1, downvotes: -1 });

    const results: ControversialItem[] = [];

    // Calculer le score de controverse (plus le ratio est proche de 1, plus c'est controversé)
    controversialPosts.forEach((post) => {
      const controversy =
        Math.min(post.upvotes, post.downvotes) /
        Math.max(post.upvotes, post.downvotes);
      results.push({
        type: 'post',
        id: (post._id as any).toString(),
        score: post.score,
        controversy,
      });
    });

    controversialComments
      .filter((comment) => comment.postId) // Filtrer les commentaires avec posts valides
      .forEach((comment) => {
        const controversy =
          Math.min(comment.upvotes, comment.downvotes) /
          Math.max(comment.upvotes, comment.downvotes);
        results.push({
          type: 'comment',
          id: (comment._id as any).toString(),
          score: comment.score,
          controversy,
        });
      });

    return results
      .sort((a, b) => b.controversy - a.controversy)
      .slice(0, limit);
  }
}
