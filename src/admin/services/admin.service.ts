import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from '../../users/schemas/user.schema';
import { Word, WordDocument } from '../../dictionary/schemas/word.schema';
import {
  Community,
  CommunityDocument,
} from '../../communities/schemas/community.schema';
import {
  CommunityMember,
  CommunityMemberDocument,
} from '../../communities/schemas/community-member.schema';
import {
  CommunityPost,
  CommunityPostDocument,
} from '../../communities/schemas/community-post.schema';
import {
  Message,
  MessageDocument,
} from '../../messaging/schemas/message.schema';

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalWords: number;
  pendingWords: number;
  approvedWords: number;
  rejectedWords: number;
  totalCommunities: number;
  activeCommunities: number;
  totalPosts: number;
  totalMessages: number;
  newUsersThisMonth: number;
  newWordsThisWeek: number;
}

export interface UserManagementData {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Interfaces pour les filtres MongoDB
interface UserFilter {
  role?: UserRole;
  isSuspended?: boolean;
  $or?: Array<{
    username?: { $regex: string; $options: string };
    email?: { $regex: string; $options: string };
  }>;
}

interface WordFilter {
  status: string;
  language?: string;
}

interface CommunityFilter {
  memberCount?: { $gt?: number; $lte?: number };
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    @InjectModel(Community.name)
    private communityModel: Model<CommunityDocument>,
    @InjectModel(CommunityMember.name)
    private memberModel: Model<CommunityMemberDocument>,
    @InjectModel(CommunityPost.name)
    private postModel: Model<CommunityPostDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  // Vérifier les permissions d'accès
  private checkPermission(userRole: UserRole, requiredRole: UserRole): void {
    const roleHierarchy = {
      [UserRole.USER]: 0,
      [UserRole.CONTRIBUTOR]: 1,
      [UserRole.ADMIN]: 2,
      [UserRole.SUPERADMIN]: 3,
    };

    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      throw new ForbiddenException('Permissions insuffisantes');
    }
  }

  // Dashboard - Statistiques générales
  async getDashboardStats(userRole: UserRole): Promise<AdminStats> {
    this.checkPermission(userRole, UserRole.CONTRIBUTOR);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalWords,
      pendingWords,
      approvedWords,
      rejectedWords,
      totalCommunities,
      activeCommunities,
      totalPosts,
      totalMessages,
      newUsersThisMonth,
      newWordsThisWeek,
    ] = await Promise.all([
      this.userModel.countDocuments({}),
      this.userModel.countDocuments({ isActive: true }),
      this.userModel.countDocuments({ isSuspended: true }),
      this.wordModel.countDocuments({}),
      this.wordModel.countDocuments({ status: 'pending' }),
      this.wordModel.countDocuments({ status: 'approved' }),
      this.wordModel.countDocuments({ status: 'rejected' }),
      this.communityModel.countDocuments({}),
      this.communityModel.countDocuments({ memberCount: { $gt: 1 } }),
      this.postModel.countDocuments({}),
      this.messageModel.countDocuments({}),
      this.userModel.countDocuments({ createdAt: { $gte: monthStart } }),
      this.wordModel.countDocuments({ createdAt: { $gte: weekStart } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalWords,
      pendingWords,
      approvedWords,
      rejectedWords,
      totalCommunities,
      activeCommunities,
      totalPosts,
      totalMessages,
      newUsersThisMonth,
      newWordsThisWeek,
    };
  }

  // Gestion des utilisateurs
  async getUsers(
    page = 1,
    limit = 20,
    role?: UserRole,
    status?: 'active' | 'suspended' | 'all',
    search?: string,
    userRole?: UserRole,
  ): Promise<UserManagementData> {
    this.checkPermission(userRole || UserRole.USER, UserRole.ADMIN);

    const filter: UserFilter = {};

    if (role) filter.role = role;

    if (status === 'active') filter.isSuspended = false;
    else if (status === 'suspended') filter.isSuspended = true;

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const total = await this.userModel.countDocuments(filter);

    const users = await this.userModel
      .find(filter, { password: 0 }) // Exclure le mot de passe
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Suspendre/Activer un utilisateur
  async toggleUserSuspension(
    userId: string,
    suspend: boolean,
    reason?: string,
    suspendUntil?: Date,
    userRole?: UserRole,
  ): Promise<{ success: boolean; message: string }> {
    this.checkPermission(userRole || UserRole.USER, UserRole.ADMIN);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Ne pas permettre de suspendre un superadmin
    if (user.role === UserRole.SUPERADMIN && userRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Impossible de suspendre un superadmin');
    }

    const updateData: any = {
      isSuspended: suspend,
      suspensionReason: suspend ? reason : undefined,
      suspendedUntil: suspend ? suspendUntil : undefined,
    };

    await this.userModel.findByIdAndUpdate(userId, updateData);

    return {
      success: true,
      message: suspend ? 'Utilisateur suspendu' : 'Suspension levée',
    };
  }

  // Changer le rôle d'un utilisateur
  async changeUserRole(
    userId: string,
    newRole: UserRole,
    userRole?: UserRole,
  ): Promise<{ success: boolean; message: string }> {
    this.checkPermission(userRole || UserRole.USER, UserRole.SUPERADMIN);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    await this.userModel.findByIdAndUpdate(userId, { role: newRole });

    return {
      success: true,
      message: `Rôle changé vers ${newRole}`,
    };
  }

  // Gestion des mots en attente
  async getPendingWords(
    page = 1,
    limit = 20,
    language?: string,
    userRole?: UserRole,
  ) {
    this.checkPermission(userRole || UserRole.USER, UserRole.CONTRIBUTOR);

    const filter: WordFilter = { status: 'pending' };
    if (language) filter.language = language;

    const skip = (page - 1) * limit;
    const total = await this.wordModel.countDocuments(filter);

    const words = await this.wordModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 })
      .exec();

    return {
      words,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Approuver/Rejeter un mot
  async moderateWord(
    wordId: string,
    action: 'approve' | 'reject',
    reason?: string,
    userRole?: UserRole,
  ): Promise<{ success: boolean; message: string }> {
    this.checkPermission(userRole || UserRole.USER, UserRole.CONTRIBUTOR);

    const word = await this.wordModel.findById(wordId);
    if (!word) {
      throw new NotFoundException('Mot non trouvé');
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    await this.wordModel.findByIdAndUpdate(wordId, {
      status,
      moderationReason: reason,
      moderatedAt: new Date(),
    });

    return {
      success: true,
      message: action === 'approve' ? 'Mot approuvé' : 'Mot rejeté',
    };
  }

  // Modération des communautés
  async getCommunities(
    page = 1,
    limit = 20,
    status?: 'active' | 'inactive',
    userRole?: UserRole,
  ) {
    this.checkPermission(userRole || UserRole.USER, UserRole.ADMIN);

    const filter: CommunityFilter = {};
    if (status === 'active') filter.memberCount = { $gt: 1 };
    else if (status === 'inactive') filter.memberCount = { $lte: 1 };

    const skip = (page - 1) * limit;
    const total = await this.communityModel.countDocuments(filter);

    const communities = await this.communityModel
      .find(filter)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 })
      .exec();

    return {
      communities,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Supprimer une communauté
  async deleteCommunity(
    communityId: string,
    userRole?: UserRole,
  ): Promise<{ success: boolean; message: string }> {
    this.checkPermission(userRole || UserRole.USER, UserRole.ADMIN);

    const community = await this.communityModel.findById(communityId);
    if (!community) {
      throw new NotFoundException('Communauté non trouvée');
    }

    // Supprimer tous les membres, posts, etc.
    await Promise.all([
      this.memberModel.deleteMany({ communityId }),
      this.postModel.deleteMany({ communityId }),
      this.communityModel.findByIdAndDelete(communityId),
    ]);

    return {
      success: true,
      message: 'Communauté supprimée',
    };
  }

  // Logs d'activité récents
  async getRecentActivity(limit = 50, userRole?: UserRole) {
    this.checkPermission(userRole || UserRole.USER, UserRole.ADMIN);

    const [recentUsers, recentWords, recentCommunities] = await Promise.all([
      this.userModel
        .find({}, { username: 1, email: 1, createdAt: 1, role: 1 })
        .sort({ createdAt: -1 })
        .limit(limit / 3)
        .exec(),
      this.wordModel
        .find({}, { word: 1, language: 1, status: 1, createdAt: 1 })
        .populate('createdBy', 'username')
        .sort({ createdAt: -1 })
        .limit(limit / 3)
        .exec(),
      this.communityModel
        .find({}, { name: 1, language: 1, memberCount: 1, createdAt: 1 })
        .populate('createdBy', 'username')
        .sort({ createdAt: -1 })
        .limit(limit / 3)
        .exec(),
    ]);

    return {
      recentUsers,
      recentWords,
      recentCommunities,
    };
  }
}
