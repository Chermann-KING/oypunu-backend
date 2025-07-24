import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Vote } from '../schemas/vote.schema';
import { CommunityPost, CommunityPostDocument } from '../schemas/community-post.schema';
import { PostComment, PostCommentDocument } from '../schemas/post-comment.schema';
import { IVoteRepository } from '../../repositories/interfaces/vote.repository.interface';
import { ICommunityMemberRepository } from '../../repositories/interfaces/community-member.repository.interface';

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
    @Inject('IVoteRepository') private voteRepository: IVoteRepository,
    @Inject('ICommunityMemberRepository') private communityMemberRepository: ICommunityMemberRepository,
    @InjectModel(CommunityPost.name) private postModel: Model<CommunityPostDocument>,
    @InjectModel(PostComment.name) private commentModel: Model<PostCommentDocument>,
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
    const isMember = await this.communityMemberRepository.isMember(communityId, userId);

    if (!isMember) {
      return {
        canVote: false,
        reason: 'Vous devez être membre de la communauté pour voter',
      };
    }

    // Vérifier le cooldown entre votes
    const userVotesResult = await this.voteRepository.findByUser(userId, {
      limit: 1,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    
    const recentVote = userVotesResult.votes.length > 0 ? userVotesResult.votes[0] : null;
    const recentVoteTime = recentVote ? (recentVote as any).createdAt : null;

    if (recentVoteTime && recentVoteTime.getTime() + this.VOTE_COOLDOWN_MINUTES * 60 * 1000 > Date.now()) {
      const cooldownRemaining = Math.ceil(
        (recentVoteTime.getTime() +
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

    // Vérifier la limite quotidienne (utilisation simplifiée)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Note: pour une implémentation complète, il faudrait ajouter un filtre par date dans le repository
    const dailyVotesResult = await this.voteRepository.findByUser(userId, {
      limit: this.MAX_DAILY_VOTES + 1,
    });
    const dailyVoteCount = dailyVotesResult.total;

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
    const existingVote = await this.voteRepository.findUserVote(userId, targetType, targetId);

    let scoreChange = 0;
    let upvoteChange = 0;
    let downvoteChange = 0;

    // Utiliser la logique de vote intelligent du repository
    const voteResult = await this.voteRepository.vote(userId, targetType, targetId, voteType, reason);
    
    // Calculer les changements basés sur l'action
    switch (voteResult.action) {
      case 'created':
        scoreChange = voteType === 'up' ? 1 : -1;
        upvoteChange = voteType === 'up' ? 1 : 0;
        downvoteChange = voteType === 'down' ? 1 : 0;
        break;
      case 'updated':
        scoreChange = voteType === 'up' ? 2 : -2; // Double changement (remove + add)
        upvoteChange = voteType === 'up' ? 1 : -1;
        downvoteChange = voteType === 'down' ? 1 : -1;
        break;
      case 'removed':
        scoreChange = voteResult.previousVoteType === 'up' ? -1 : 1;
        upvoteChange = voteResult.previousVoteType === 'up' ? -1 : 0;
        downvoteChange = voteResult.previousVoteType === 'down' ? -1 : 0;
        break;
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

    // Le vote actuel est déjà retourné par le repository
    const currentVote = voteResult.action === 'removed' ? null : voteResult.vote;

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
    const voteMap = new Map<string, 'up' | 'down' | null>();

    // Initialiser tous les targets avec null
    targets.forEach((target) => {
      voteMap.set(target.id, null);
    });

    // Récupérer les votes existants pour chaque target
    for (const target of targets) {
      const vote = await this.voteRepository.findUserVote(userId, target.type, target.id);
      if (vote) {
        voteMap.set(target.id, vote.voteType);
      }
    }

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
    // Utiliser la méthode du repository qui valide l'intégrité et nettoie
    const deletedCount = await this.voteRepository.cleanupOrphaned();
    
    return { deletedCount };
  }

  /**
   * Obtenir les votes controversés (beaucoup d'upvotes ET downvotes)
   */
  async getControversialContent(
    communityId: string,
    limit = 10,
  ): Promise<ControversialItem[]> {
    // Utiliser la méthode du repository pour obtenir le contenu controversé
    const controversialPosts = await this.voteRepository.getControversial('community_post', {
      limit,
      minVotes: 5,
    });

    const controversialComments = await this.voteRepository.getControversial('post_comment', {
      limit,
      minVotes: 3,
    });

    const results: ControversialItem[] = [];

    // Ajouter les posts controversés
    controversialPosts.forEach((post) => {
      results.push({
        type: 'post',
        id: post.targetId,
        score: post.upVotes - post.downVotes,
        controversy: post.controversyScore,
      });
    });

    // Ajouter les commentaires controversés (avec filtrage par communauté à faire côté application)
    controversialComments.forEach((comment) => {
      results.push({
        type: 'comment',
        id: comment.targetId,
        score: comment.upVotes - comment.downVotes,
        controversy: comment.controversyScore,
      });
    });

    return results
      .sort((a, b) => b.controversy - a.controversy)
      .slice(0, limit);
  }
}
