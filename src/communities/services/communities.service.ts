import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommunityFiltersDto } from '../dto/community-filters.dto';
import { CreateCommunityDto } from '../dto/create-community.dto';
import {
  CommunityMember,
  CommunityMemberDocument,
} from '../schemas/community-member.schema';
import { Community, CommunityDocument } from '../schemas/community.schema';

interface CommunityQuery {
  $or?: Array<{ [key: string]: { $regex: string; $options: string } }>;
  language?: string;
  tags?: string;
  isPrivate?: boolean;
}

interface JwtUser {
  userId?: string;
  _id?: string;
  username: string;
  email: string;
  role: string;
}

@Injectable()
export class CommunitiesService {
  constructor(
    @InjectModel(Community.name)
    private communityModel: Model<CommunityDocument>,
    @InjectModel(CommunityMember.name)
    private memberModel: Model<CommunityMemberDocument>,
  ) {}

  // Fonction utilitaire pour extraire l'ID utilisateur
  private _extractUserId(userOrId: JwtUser | string): string {
    if (typeof userOrId === 'string') {
      return userOrId;
    }

    const userId = userOrId.userId || userOrId._id;
    if (!userId) {
      throw new Error('User ID is required');
    }

    return userId;
  }

  // Créer une communauté
  async create(
    createCommunityDto: CreateCommunityDto,
    user: JwtUser | string,
  ): Promise<Community> {
    console.log('Creating community with user:', user);

    const userId = this._extractUserId(user);
    console.log('Resolved User ID:', userId);

    const newCommunity = new this.communityModel({
      ...createCommunityDto,
      createdBy: userId,
      memberCount: 1,
    });

    const community = await newCommunity.save();

    // Ajouter le créateur comme admin
    await this.memberModel.create({
      communityId: community._id,
      userId: userId,
      role: 'admin',
    });

    return community;
  }

  // Récupérer toutes les communautés (avec filtrage)
  async findAll(filters: CommunityFiltersDto): Promise<{
    communities: Community[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      searchTerm,
      language,
      tag,
      includePrivate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;
    const skip = (page - 1) * limit;

    const query: CommunityQuery = {};

    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    if (language) {
      query.language = language;
    }

    if (tag) {
      query.tags = tag;
    }

    if (!includePrivate) {
      query.isPrivate = false;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [communities, total] = await Promise.all([
      this.communityModel.find(query).sort(sort).skip(skip).limit(limit).exec(),
      this.communityModel.countDocuments(query),
    ]);

    return {
      communities,
      total,
      page,
      limit,
    };
  }

  // Rejoindre une communauté
  async joinCommunity(
    communityId: string,
    userOrId: JwtUser | string,
  ): Promise<{ success: boolean }> {
    const userId = this._extractUserId(userOrId);

    // Vérifier si l'utilisateur est déjà membre
    const existingMember = await this.memberModel.findOne({
      communityId,
      userId,
    });

    if (existingMember) {
      return { success: true }; // Déjà membre
    }

    // Ajouter comme membre
    await this.memberModel.create({
      communityId,
      userId,
      role: 'member',
    });

    // Incrémenter le compteur de membres
    await this.communityModel.findByIdAndUpdate(communityId, {
      $inc: { memberCount: 1 },
    });

    return { success: true };
  }

  // Quitter une communauté
  async leaveCommunity(
    communityId: string,
    userOrId: JwtUser | string,
  ): Promise<{ success: boolean }> {
    const userId = this._extractUserId(userOrId);

    const member = await this.memberModel.findOne({
      communityId: new Types.ObjectId(communityId),
      userId: new Types.ObjectId(userId),
    });

    if (!member) {
      return { success: false };
    }

    await this.memberModel.deleteOne({ _id: member._id });
    await this.communityModel.findByIdAndUpdate(communityId, {
      $inc: { memberCount: -1 },
    });

    return { success: true };
  }

  // Récupérer les membres d'une communauté
  async getCommunityMembers(
    communityId: string,
    page = 1,
    limit = 10,
  ): Promise<{
    members: CommunityMember[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;
    const [members, total] = await Promise.all([
      this.memberModel
        .find({ communityId })
        .populate('userId', 'username profilePicture')
        .skip(skip)
        .limit(limit)
        .exec(),
      this.memberModel.countDocuments({ communityId }),
    ]);

    return { members, total, page, limit };
  }

  async getAllMembersWithRoles(communityId: string): Promise<any[]> {
    return this.memberModel.find({ communityId }).lean();
  }

  // Changer le rôle d'un membre
  async updateMemberRole(
    communityId: string,
    memberUserId: string,
    newRole: 'admin' | 'moderator' | 'member',
    adminUserOrId: JwtUser | string,
  ): Promise<{ success: boolean; message: string }> {
    const adminId = this._extractUserId(adminUserOrId);

    // Vérifier si l'administrateur a les droits
    const adminMember = await this.memberModel.findOne({
      communityId,
      userId: adminId,
      role: 'admin',
    });

    if (!adminMember) {
      return {
        success: false,
        message: "Vous n'avez pas les droits nécessaires",
      };
    }

    // Vérifier si le membre existe
    const member = await this.memberModel.findOne({
      communityId,
      userId: memberUserId,
    });

    if (!member) {
      return { success: false, message: 'Membre non trouvé' };
    }

    // Mettre à jour le rôle
    await this.memberModel.findByIdAndUpdate(member._id, { role: newRole });

    return { success: true, message: 'Rôle mis à jour avec succès' };
  }

  // Récupérer les communautés d'un utilisateur
  async getUserCommunities(
    userOrId: JwtUser | string,
    page = 1,
    limit = 10,
  ): Promise<{
    communities: Community[];
    total: number;
    page: number;
    limit: number;
  }> {
    const userId = this._extractUserId(userOrId);

    const skip = (page - 1) * limit;
    const memberIds = await this.memberModel
      .find({ userId })
      .select('communityId')
      .exec();

    const communityIds = memberIds.map((member) => member.communityId);

    const [communities, total] = await Promise.all([
      this.communityModel
        .find({ _id: { $in: communityIds } })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.communityModel.countDocuments({ _id: { $in: communityIds } }),
    ]);

    return { communities, total, page, limit };
  }

  // Récupérer une communauté par son ID
  async findOne(communityId: string): Promise<Community> {
    const community = await this.communityModel
      .findById(communityId)
      .populate('createdBy', 'username profilePicture')
      .exec();

    if (!community) {
      throw new NotFoundException(
        `Communauté avec l'ID ${communityId} non trouvée`,
      );
    }

    return community;
  }

  // Mettre à jour une communauté
  async update(
    communityId: string,
    updateData: Partial<Community>,
    userOrId: JwtUser | string,
  ): Promise<{ success: boolean; message: string }> {
    const userId = this._extractUserId(userOrId);

    const member = await this.memberModel.findOne({
      communityId,
      userId,
      role: 'admin',
    });

    if (!member) {
      return {
        success: false,
        message: "Vous n'avez pas les droits nécessaires",
      };
    }

    await this.communityModel.findByIdAndUpdate(communityId, updateData);
    return { success: true, message: 'Communauté mise à jour avec succès' };
  }

  // Supprimer une communauté
  async delete(
    communityId: string,
    userOrId: JwtUser | string,
  ): Promise<{ success: boolean; message: string }> {
    const userId = this._extractUserId(userOrId);

    const member = await this.memberModel.findOne({
      communityId,
      userId,
      role: 'admin',
    });

    if (!member) {
      return {
        success: false,
        message: "Vous n'avez pas les droits nécessaires",
      };
    }

    await Promise.all([
      this.communityModel.findByIdAndDelete(communityId),
      this.memberModel.deleteMany({ communityId }),
    ]);

    return { success: true, message: 'Communauté supprimée avec succès' };
  }

  // Vérifier si un utilisateur est membre d'une communauté
  async isMember(
    communityId: string,
    userOrId: JwtUser | string,
  ): Promise<boolean> {
    const userId = this._extractUserId(userOrId);

    const member = await this.memberModel.findOne({
      communityId,
      userId,
    });
    return !!member;
  }

  // Récupérer le rôle d'un membre dans une communauté
  async getMemberRole(
    communityId: string,
    userOrId: JwtUser | string,
  ): Promise<'admin' | 'moderator' | 'member' | null> {
    const userId = this._extractUserId(userOrId);
    console.log(
      `Recherche du rôle pour communityId: ${communityId}, userId: ${userId}`,
    );

    // Essayez d'abord sans conversion à ObjectId
    let member = await this.memberModel.findOne({
      communityId,
      userId,
    });

    // Si aucun résultat, essayez avec la conversion
    if (!member) {
      console.log('Première recherche échouée, essai avec ObjectId');
      member = await this.memberModel.findOne({
        communityId: new Types.ObjectId(communityId),
        userId: new Types.ObjectId(userId),
      });
    }

    console.log('Membre trouvé:', member);

    // Si l'utilisateur est membre mais n'a pas de rôle défini, renvoyer 'member' par défaut
    if (member && !member.role) {
      return 'member';
    }

    return (
      (member?.role as 'admin' | 'moderator' | 'member' | undefined) || null
    );
  }

  // Rechercher des communautés par tag
  async searchByTags(
    tags: string[],
    page = 1,
    limit = 10,
  ): Promise<{
    communities: Community[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;
    const [communities, total] = await Promise.all([
      this.communityModel
        .find({ tags: { $in: tags } })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.communityModel.countDocuments({ tags: { $in: tags } }),
    ]);

    return { communities, total, page, limit };
  }
}
