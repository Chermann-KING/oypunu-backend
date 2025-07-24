import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommunityMember, CommunityMemberDocument } from '../../communities/schemas/community-member.schema';
import { ICommunityMemberRepository } from '../interfaces/community-member.repository.interface';
import { DatabaseErrorHandler } from '../../common/utils/database-error-handler.util';

/**
 * 👥 REPOSITORY COMMUNITY MEMBER - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository CommunityMember utilisant Mongoose.
 * Gère toutes les opérations de base de données pour les membres de communautés.
 * 
 * Fonctionnalités :
 * - CRUD complet des membres
 * - Gestion des rôles et permissions
 * - Recherche et filtrage
 * - Statistiques d'adhésion
 * - Validation et nettoyage
 */
@Injectable()
export class CommunityMemberRepository implements ICommunityMemberRepository {
  constructor(
    @InjectModel(CommunityMember.name) private communityMemberModel: Model<CommunityMemberDocument>,
  ) {}

  // ========== CRUD DE BASE ==========

  async create(memberData: {
    communityId: string;
    userId: string;
    role?: 'member' | 'moderator' | 'admin';
  }): Promise<CommunityMember> {
    return DatabaseErrorHandler.handleCreateOperation(
      async () => {
        if (!Types.ObjectId.isValid(memberData.communityId) || !Types.ObjectId.isValid(memberData.userId)) {
          throw new Error('Invalid ObjectId format');
        }

        const newMember = new this.communityMemberModel({
          ...memberData,
          role: memberData.role || 'member',
        });
        return newMember.save();
      },
      'CommunityMember'
    );
  }

  async findById(id: string): Promise<CommunityMember | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.communityMemberModel
          .findById(id)
          .populate('communityId', 'name language')
          .populate('userId', 'username email')
          .exec();
      },
      'CommunityMember',
      id
    );
  }

  async update(id: string, updateData: Partial<CommunityMember>): Promise<CommunityMember | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }
        return this.communityMemberModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .populate('communityId', 'name language')
          .populate('userId', 'username email')
          .exec();
      },
      'CommunityMember',
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return false;
        }
        const result = await this.communityMemberModel.findByIdAndDelete(id).exec();
        return result !== null;
      },
      'CommunityMember',
      id
    );
  }

  // ========== GESTION DES MEMBRES ==========

  async findMember(communityId: string, userId: string): Promise<CommunityMember | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId) || !Types.ObjectId.isValid(userId)) {
          return null;
        }
        return this.communityMemberModel
          .findOne({ communityId, userId })
          .populate('communityId', 'name language')
          .populate('userId', 'username email')
          .exec();
      },
      'CommunityMember',
      `${communityId}-${userId}`
    );
  }

  async isMember(communityId: string, userId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId) || !Types.ObjectId.isValid(userId)) {
          return false;
        }
        const member = await this.communityMemberModel
          .findOne({ communityId, userId })
          .select('_id')
          .exec();
        return member !== null;
      },
      'CommunityMember'
    );
  }

  async findByCommunity(communityId: string, options: {
    page?: number;
    limit?: number;
    role?: 'member' | 'moderator' | 'admin';
    sortBy?: 'joinedAt' | 'role';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    members: CommunityMember[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId)) {
          return { members: [], total: 0, page: 1, limit: 20 };
        }

        const {
          page = 1,
          limit = 20,
          role,
          sortBy = 'joinedAt',
          sortOrder = 'desc'
        } = options;

        const filter: any = { communityId };
        if (role) {
          filter.role = role;
        }

        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        const [members, total] = await Promise.all([
          this.communityMemberModel
            .find(filter)
            .populate('communityId', 'name language')
            .populate('userId', 'username email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .exec(),
          this.communityMemberModel.countDocuments(filter).exec(),
        ]);

        return { members, total, page, limit };
      },
      'CommunityMember'
    );
  }

  async findByUser(userId: string, options: {
    page?: number;
    limit?: number;
    role?: 'member' | 'moderator' | 'admin';
    sortBy?: 'joinedAt' | 'role';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{
    memberships: CommunityMember[];
    total: number;
    page: number;
    limit: number;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId)) {
          return { memberships: [], total: 0, page: 1, limit: 20 };
        }

        const {
          page = 1,
          limit = 20,
          role,
          sortBy = 'joinedAt',
          sortOrder = 'desc'
        } = options;

        const filter: any = { userId };
        if (role) {
          filter.role = role;
        }

        const sort: any = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        const [memberships, total] = await Promise.all([
          this.communityMemberModel
            .find(filter)
            .populate('communityId', 'name language')
            .populate('userId', 'username email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .exec(),
          this.communityMemberModel.countDocuments(filter).exec(),
        ]);

        return { memberships, total, page, limit };
      },
      'CommunityMember'
    );
  }

  async removeMember(communityId: string, userId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId) || !Types.ObjectId.isValid(userId)) {
          return false;
        }
        const result = await this.communityMemberModel
          .findOneAndDelete({ communityId, userId })
          .exec();
        return result !== null;
      },
      'CommunityMember',
      `${communityId}-${userId}`
    );
  }

  // ========== GESTION DES RÔLES ==========

  async updateRole(communityId: string, userId: string, newRole: 'member' | 'moderator' | 'admin'): Promise<CommunityMember | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId) || !Types.ObjectId.isValid(userId)) {
          return null;
        }
        return this.communityMemberModel
          .findOneAndUpdate(
            { communityId, userId },
            { role: newRole },
            { new: true }
          )
          .populate('communityId', 'name language')
          .populate('userId', 'username email')
          .exec();
      },
      'CommunityMember',
      `${communityId}-${userId}`
    );
  }

  async findByRole(communityId: string, role: 'member' | 'moderator' | 'admin'): Promise<CommunityMember[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId)) {
          return [];
        }
        return this.communityMemberModel
          .find({ communityId, role })
          .populate('communityId', 'name language')
          .populate('userId', 'username email')
          .sort({ joinedAt: -1 })
          .exec();
      },
      'CommunityMember'
    );
  }

  async hasRole(communityId: string, userId: string, role: 'member' | 'moderator' | 'admin'): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId) || !Types.ObjectId.isValid(userId)) {
          return false;
        }
        const member = await this.communityMemberModel
          .findOne({ communityId, userId, role })
          .select('_id')
          .exec();
        return member !== null;
      },
      'CommunityMember'
    );
  }

  async canModerate(communityId: string, userId: string): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId) || !Types.ObjectId.isValid(userId)) {
          return false;
        }
        const member = await this.communityMemberModel
          .findOne({
            communityId,
            userId,
            role: { $in: ['moderator', 'admin'] }
          })
          .select('_id')
          .exec();
        return member !== null;
      },
      'CommunityMember'
    );
  }

  async getUserRole(communityId: string, userId: string): Promise<'member' | 'moderator' | 'admin' | null> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId) || !Types.ObjectId.isValid(userId)) {
          return null;
        }
        const member = await this.communityMemberModel
          .findOne({ communityId, userId })
          .select('role')
          .exec();
        return member ? member.role as 'member' | 'moderator' | 'admin' : null;
      },
      'CommunityMember'
    );
  }

  async promote(communityId: string, userId: string): Promise<CommunityMember | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId) || !Types.ObjectId.isValid(userId)) {
          return null;
        }

        const member = await this.communityMemberModel.findOne({ communityId, userId }).exec();
        if (!member) {
          return null;
        }

        let newRole: 'member' | 'moderator' | 'admin';
        switch (member.role) {
          case 'member':
            newRole = 'moderator';
            break;
          case 'moderator':
            newRole = 'admin';
            break;
          case 'admin':
            return member; // Déjà au niveau maximum
          default:
            return null;
        }

        return this.updateRole(communityId, userId, newRole);
      },
      'CommunityMember',
      `${communityId}-${userId}`
    );
  }

  async demote(communityId: string, userId: string): Promise<CommunityMember | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId) || !Types.ObjectId.isValid(userId)) {
          return null;
        }

        const member = await this.communityMemberModel.findOne({ communityId, userId }).exec();
        if (!member) {
          return null;
        }

        let newRole: 'member' | 'moderator' | 'admin';
        switch (member.role) {
          case 'admin':
            newRole = 'moderator';
            break;
          case 'moderator':
            newRole = 'member';
            break;
          case 'member':
            return member; // Déjà au niveau minimum
          default:
            return null;
        }

        return this.updateRole(communityId, userId, newRole);
      },
      'CommunityMember',
      `${communityId}-${userId}`
    );
  }

  // ========== RECHERCHE ET FILTRAGE ==========

  async searchMembers(communityId: string, query: string, options: {
    limit?: number;
    role?: 'member' | 'moderator' | 'admin';
  } = {}): Promise<CommunityMember[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId)) {
          return [];
        }

        const { limit = 20, role } = options;

        const filter: any = { communityId };
        if (role) {
          filter.role = role;
        }

        // Note: Pour une recherche texte sur les usernames, il faudrait une jointure
        // ou un index texte. Pour l'instant, on retourne tous les membres filtrés par rôle
        return this.communityMemberModel
          .find(filter)
          .populate({
            path: 'userId',
            match: {
              $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
              ]
            },
            select: 'username email'
          })
          .populate('communityId', 'name language')
          .limit(limit)
          .exec()
          .then(members => members.filter(member => member.userId)); // Filtrer les membres sans userId match
      },
      'CommunityMember'
    );
  }

  async findRecentlyActive(communityId: string, days: number = 30, limit: number = 20): Promise<CommunityMember[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId)) {
          return [];
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return this.communityMemberModel
          .find({
            communityId,
            joinedAt: { $gte: cutoffDate }
          })
          .populate('communityId', 'name language')
          .populate('userId', 'username email')
          .sort({ joinedAt: -1 })
          .limit(limit)
          .exec();
      },
      'CommunityMember'
    );
  }

  async findInactive(communityId: string, days: number = 90): Promise<CommunityMember[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId)) {
          return [];
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return this.communityMemberModel
          .find({
            communityId,
            joinedAt: { $lt: cutoffDate }
          })
          .populate('communityId', 'name language')
          .populate('userId', 'username email')
          .sort({ joinedAt: 1 })
          .exec();
      },
      'CommunityMember'
    );
  }

  // ========== STATISTIQUES ==========

  async countByCommunity(communityId: string, role?: 'member' | 'moderator' | 'admin'): Promise<number> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId)) {
          return 0;
        }

        const filter: any = { communityId };
        if (role) {
          filter.role = role;
        }

        return this.communityMemberModel.countDocuments(filter).exec();
      },
      'CommunityMember'
    );
  }

  async countByUser(userId: string, role?: 'member' | 'moderator' | 'admin'): Promise<number> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId)) {
          return 0;
        }

        const filter: any = { userId };
        if (role) {
          filter.role = role;
        }

        return this.communityMemberModel.countDocuments(filter).exec();
      },
      'CommunityMember'
    );
  }

  async getCommunityMemberStats(communityId: string): Promise<{
    totalMembers: number;
    memberCount: number;
    moderatorCount: number;
    adminCount: number;
    recentJoins: number;
    averageJoinDate: Date;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId)) {
          return {
            totalMembers: 0,
            memberCount: 0,
            moderatorCount: 0,
            adminCount: 0,
            recentJoins: 0,
            averageJoinDate: new Date(0),
          };
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [roleStats, recentJoins, avgJoinDate] = await Promise.all([
          this.communityMemberModel
            .aggregate([
              { $match: { communityId: new Types.ObjectId(communityId) } },
              { $group: { _id: '$role', count: { $sum: 1 } } }
            ])
            .exec(),
          this.communityMemberModel
            .countDocuments({
              communityId,
              joinedAt: { $gte: sevenDaysAgo }
            })
            .exec(),
          this.communityMemberModel
            .aggregate([
              { $match: { communityId: new Types.ObjectId(communityId) } },
              { $group: { _id: null, avgDate: { $avg: '$joinedAt' } } }
            ])
            .exec(),
        ]);

        const stats = {
          totalMembers: 0,
          memberCount: 0,
          moderatorCount: 0,
          adminCount: 0,
          recentJoins,
          averageJoinDate: avgJoinDate[0]?.avgDate ? new Date(avgJoinDate[0].avgDate) : new Date(0),
        };

        roleStats.forEach(stat => {
          stats.totalMembers += stat.count;
          switch (stat._id) {
            case 'member':
              stats.memberCount = stat.count;
              break;
            case 'moderator':
              stats.moderatorCount = stat.count;
              break;
            case 'admin':
              stats.adminCount = stat.count;
              break;
          }
        });

        return stats;
      },
      'CommunityMember'
    );
  }

  async getUserMembershipStats(userId: string): Promise<{
    totalCommunities: number;
    asMembers: number;
    asModerator: number;
    asAdmin: number;
    oldestMembership: Date;
    newestMembership: Date;
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId)) {
          return {
            totalCommunities: 0,
            asMembers: 0,
            asModerator: 0,
            asAdmin: 0,
            oldestMembership: new Date(0),
            newestMembership: new Date(0),
          };
        }

        const [roleStats, dateStats] = await Promise.all([
          this.communityMemberModel
            .aggregate([
              { $match: { userId: new Types.ObjectId(userId) } },
              { $group: { _id: '$role', count: { $sum: 1 } } }
            ])
            .exec(),
          this.communityMemberModel
            .aggregate([
              { $match: { userId: new Types.ObjectId(userId) } },
              {
                $group: {
                  _id: null,
                  oldest: { $min: '$joinedAt' },
                  newest: { $max: '$joinedAt' }
                }
              }
            ])
            .exec(),
        ]);

        const stats = {
          totalCommunities: 0,
          asMembers: 0,
          asModerator: 0,
          asAdmin: 0,
          oldestMembership: dateStats[0]?.oldest || new Date(0),
          newestMembership: dateStats[0]?.newest || new Date(0),
        };

        roleStats.forEach(stat => {
          stats.totalCommunities += stat.count;
          switch (stat._id) {
            case 'member':
              stats.asMembers = stat.count;
              break;
            case 'moderator':
              stats.asModerator = stat.count;
              break;
            case 'admin':
              stats.asAdmin = stat.count;
              break;
          }
        });

        return stats;
      },
      'CommunityMember'
    );
  }

  async getMostActiveCommunities(userId: string, limit: number = 10): Promise<CommunityMember[]> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId)) {
          return [];
        }

        // Note: "activité" nécessiterait une jointure avec les posts/commentaires
        // Pour l'instant, on trie par date d'adhésion la plus récente
        return this.communityMemberModel
          .find({ userId })
          .populate('communityId', 'name language memberCount')
          .populate('userId', 'username email')
          .sort({ joinedAt: -1 })
          .limit(limit)
          .exec();
      },
      'CommunityMember'
    );
  }

  // ========== VALIDATION ET NETTOYAGE ==========

  async validateIntegrity(): Promise<{
    invalidCommunities: string[];
    invalidUsers: string[];
    orphanedMemberships: string[];
  }> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        // Cette méthode nécessiterait des jointures avec Community et User repositories
        // Pour l'instant, retourner des arrays vides
        return {
          invalidCommunities: [],
          invalidUsers: [],
          orphanedMemberships: [],
        };
      },
      'CommunityMember'
    );
  }

  async cleanupOrphaned(): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        // Cette méthode nécessiterait une validation avec Community et User repositories
        // Pour l'instant, retourner 0
        return 0;
      },
      'CommunityMember',
      'orphaned-memberships'
    );
  }

  async findDuplicates(): Promise<Array<{
    communityId: string;
    userId: string;
    count: number;
  }>> {
    return DatabaseErrorHandler.handleSearchOperation(
      async () => {
        const duplicates = await this.communityMemberModel
          .aggregate([
            {
              $group: {
                _id: { communityId: '$communityId', userId: '$userId' },
                count: { $sum: 1 }
              }
            },
            { $match: { count: { $gt: 1 } } }
          ])
          .exec();

        return duplicates.map(dup => ({
          communityId: dup._id.communityId.toString(),
          userId: dup._id.userId.toString(),
          count: dup.count
        }));
      },
      'CommunityMember'
    );
  }

  // ========== OPÉRATIONS EN MASSE ==========

  async removeAllFromCommunity(communityId: string): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(communityId)) {
          return 0;
        }
        const result = await this.communityMemberModel
          .deleteMany({ communityId })
          .exec();
        return result.deletedCount || 0;
      },
      'CommunityMember',
      communityId
    );
  }

  async removeUserFromAll(userId: string): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId)) {
          return 0;
        }
        const result = await this.communityMemberModel
          .deleteMany({ userId })
          .exec();
        return result.deletedCount || 0;
      },
      'CommunityMember',
      userId
    );
  }

  async bulkUpdateRoles(updates: Array<{
    communityId: string;
    userId: string;
    newRole: 'member' | 'moderator' | 'admin';
  }>): Promise<number> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        let updatedCount = 0;

        for (const update of updates) {
          if (Types.ObjectId.isValid(update.communityId) && Types.ObjectId.isValid(update.userId)) {
            const result = await this.communityMemberModel
              .updateOne(
                { communityId: update.communityId, userId: update.userId },
                { role: update.newRole }
              )
              .exec();
            if (result.modifiedCount > 0) {
              updatedCount++;
            }
          }
        }

        return updatedCount;
      },
      'CommunityMember',
      'bulk-update'
    );
  }
}