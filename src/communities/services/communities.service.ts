import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { CommunityFiltersDto } from "../dto/community-filters.dto";
import { CreateCommunityDto } from "../dto/create-community.dto";
import { CommunityMember } from "../schemas/community-member.schema";
import { Community } from "../schemas/community.schema";
import { ICommunityRepository } from "../../repositories/interfaces/community.repository.interface";
import { ICommunityMemberRepository } from "../../repositories/interfaces/community-member.repository.interface";

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
    @Inject("ICommunityRepository")
    private communityRepository: ICommunityRepository,
    @Inject("ICommunityMemberRepository")
    private communityMemberRepository: ICommunityMemberRepository
  ) {}

  // Fonction utilitaire pour extraire l'ID utilisateur
  private _extractUserId(userOrId: JwtUser | string): string {
    if (typeof userOrId === "string") {
      return userOrId;
    }

    const userId = userOrId.userId || userOrId._id;
    if (!userId) {
      throw new Error("User ID is required");
    }

    return userId;
  }

  // Créer une communauté
  async create(
    createCommunityDto: CreateCommunityDto,
    user: JwtUser | string
  ): Promise<Community> {
    console.log("Creating community with user:", user);

    const userId = this._extractUserId(user);
    console.log("Resolved User ID:", userId);

    const community = await this.communityRepository.create({
      ...createCommunityDto,
      createdBy: userId,
    });

    // Ajouter le créateur comme admin
    await this.communityMemberRepository.create({
      communityId: (community as any)._id,
      userId: userId,
      role: "admin",
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
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;
    const skip = (page - 1) * limit;

    const query: CommunityQuery = {};

    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
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
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Convertir les filtres pour le repository
    const repositoryOptions = {
      page,
      limit,
      includePrivate,
      sortBy: sortBy as "memberCount" | "createdAt" | "name",
      sortOrder: sortOrder as "asc" | "desc",
    };

    let result;
    if (searchTerm) {
      result = await this.communityRepository.search(searchTerm, {
        language,
        includePrivate,
        limit,
        skip,
      });
      return {
        communities: result.communities,
        total: result.total,
        page,
        limit,
      };
    } else if (language) {
      result = await this.communityRepository.findByLanguage(
        language,
        repositoryOptions
      );
      return result;
    } else if (tag) {
      const communities = await this.communityRepository.findByTags([tag], {
        includePrivate,
        limit,
      });
      const total = communities.length;
      return { communities, total, page, limit };
    } else {
      result = await this.communityRepository.findAll(repositoryOptions);
      return {
        communities: result.communities,
        total: result.total,
        page: result.page,
        limit: result.limit,
      };
    }
  }

  // Rejoindre une communauté
  async joinCommunity(
    communityId: string,
    userOrId: JwtUser | string
  ): Promise<{ success: boolean }> {
    const userId = this._extractUserId(userOrId);

    // Vérifier si l'utilisateur est déjà membre
    const isMember = await this.communityMemberRepository.isMember(
      communityId,
      userId
    );

    if (isMember) {
      return { success: true }; // Déjà membre
    }

    // Ajouter comme membre
    await this.communityMemberRepository.create({
      communityId,
      userId,
      role: "member",
    });

    // Incrémenter le compteur de membres
    await this.communityRepository.incrementMemberCount(communityId);

    return { success: true };
  }

  // Quitter une communauté
  async leaveCommunity(
    communityId: string,
    userOrId: JwtUser | string
  ): Promise<{ success: boolean }> {
    const userId = this._extractUserId(userOrId);

    const isMember = await this.communityMemberRepository.isMember(
      communityId,
      userId
    );

    if (!isMember) {
      return { success: false };
    }

    const removed = await this.communityMemberRepository.removeMember(
      communityId,
      userId
    );
    if (removed) {
      await this.communityRepository.decrementMemberCount(communityId);
    }

    return { success: true };
  }

  // Récupérer les membres d'une communauté
  async getCommunityMembers(
    communityId: string,
    page = 1,
    limit = 10
  ): Promise<{
    members: CommunityMember[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await this.communityMemberRepository.findByCommunity(
      communityId,
      {
        page,
        limit,
        sortBy: "joinedAt",
        sortOrder: "desc",
      }
    );

    const { members, total } = result;

    return { members, total, page, limit };
  }

  async getAllMembersWithRoles(communityId: string): Promise<any[]> {
    const result = await this.communityMemberRepository.findByCommunity(
      communityId,
      {
        limit: 1000, // Limite élevée pour récupérer tous les membres
      }
    );
    return result.members;
  }

  // Changer le rôle d'un membre
  async updateMemberRole(
    communityId: string,
    memberUserId: string,
    newRole: "admin" | "moderator" | "member",
    adminUserOrId: JwtUser | string
  ): Promise<{ success: boolean; message: string }> {
    const adminId = this._extractUserId(adminUserOrId);

    // Vérifier si l'administrateur a les droits
    const isAdmin = await this.communityMemberRepository.hasRole(
      communityId,
      adminId,
      "admin"
    );

    if (!isAdmin) {
      return {
        success: false,
        message: "Vous n'avez pas les droits nécessaires",
      };
    }

    // Vérifier si le membre existe
    const isMember = await this.communityMemberRepository.isMember(
      communityId,
      memberUserId
    );

    if (!isMember) {
      return { success: false, message: "Membre non trouvé" };
    }

    // Mettre à jour le rôle
    await this.communityMemberRepository.updateRole(
      communityId,
      memberUserId,
      newRole
    );

    return { success: true, message: "Rôle mis à jour avec succès" };
  }

  // Récupérer les communautés d'un utilisateur
  async getUserCommunities(
    userOrId: JwtUser | string,
    page = 1,
    limit = 10
  ): Promise<{
    communities: Community[];
    total: number;
    page: number;
    limit: number;
  }> {
    const userId = this._extractUserId(userOrId);

    const membershipResult = await this.communityMemberRepository.findByUser(
      userId,
      {
        page,
        limit,
        sortBy: "joinedAt",
        sortOrder: "desc",
      }
    );

    const communityIds = membershipResult.memberships.map(
      (member) => (member as any).communityId
    );

    // Récupérer les communautés correspondantes
    const communities = [];
    for (const communityId of communityIds) {
      const community = await this.communityRepository.findById(communityId);
      if (community) {
        communities.push(community);
      }
    }

    const total = membershipResult.total;

    return { communities, total, page, limit };
  }

  // Récupérer une communauté par son ID
  async findOne(communityId: string): Promise<Community> {
    const community = await this.communityRepository.findById(communityId);

    if (!community) {
      throw new NotFoundException(
        `Communauté avec l'ID ${communityId} non trouvée`
      );
    }

    return community;
  }

  // Mettre à jour une communauté
  async update(
    communityId: string,
    updateData: Partial<Community>,
    userOrId: JwtUser | string
  ): Promise<{ success: boolean; message: string }> {
    const userId = this._extractUserId(userOrId);

    const isAdmin = await this.communityMemberRepository.hasRole(
      communityId,
      userId,
      "admin"
    );

    if (!isAdmin) {
      return {
        success: false,
        message: "Vous n'avez pas les droits nécessaires",
      };
    }

    await this.communityRepository.update(communityId, updateData);
    return { success: true, message: "Communauté mise à jour avec succès" };
  }

  // Supprimer une communauté
  async delete(
    communityId: string,
    userOrId: JwtUser | string
  ): Promise<{ success: boolean; message: string }> {
    const userId = this._extractUserId(userOrId);

    const isAdmin = await this.communityMemberRepository.hasRole(
      communityId,
      userId,
      "admin"
    );

    if (!isAdmin) {
      return {
        success: false,
        message: "Vous n'avez pas les droits nécessaires",
      };
    }

    await Promise.all([
      this.communityRepository.delete(communityId),
      this.communityMemberRepository.removeAllFromCommunity(communityId),
    ]);

    return { success: true, message: "Communauté supprimée avec succès" };
  }

  // Vérifier si un utilisateur est membre d'une communauté
  async isMember(
    communityId: string,
    userOrId: JwtUser | string
  ): Promise<boolean> {
    const userId = this._extractUserId(userOrId);

    return this.communityMemberRepository.isMember(communityId, userId);
  }

  // Récupérer le rôle d'un membre dans une communauté
  async getMemberRole(
    communityId: string,
    userOrId: JwtUser | string
  ): Promise<"admin" | "moderator" | "member" | null> {
    const userId = this._extractUserId(userOrId);
    console.log(
      `Recherche du rôle pour communityId: ${communityId}, userId: ${userId}`
    );

    const role = await this.communityMemberRepository.getUserRole(
      communityId,
      userId
    );

    console.log("Rôle trouvé:", role);

    return role;
  }

  // Rechercher des communautés par tag
  async searchByTags(
    tags: string[],
    page = 1,
    limit = 10
  ): Promise<{
    communities: Community[];
    total: number;
    page: number;
    limit: number;
  }> {
    const communities = await this.communityRepository.findByTags(tags, {
      includePrivate: false,
      limit,
    });

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCommunities = communities.slice(startIndex, endIndex);
    const total = communities.length;

    return { communities: paginatedCommunities, total, page, limit };
  }
}
