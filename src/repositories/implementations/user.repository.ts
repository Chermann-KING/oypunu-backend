/**
 * @fileoverview Implémentation repository utilisateur avec Mongoose
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User } from "../../users/schemas/user.schema";
import { RegisterDto } from "../../users/dto/register.dto";
import { IUserRepository } from "../interfaces/user.repository.interface";

/**
 * Implémentation repository pour la gestion des utilisateurs avec Mongoose
 * 
 * Sépare complètement l'accès aux données de la logique métier avec une interface pure.
 * Gère toutes les opérations de persistance utilisateur : CRUD, authentification,
 * social providers, tokens et profils.
 * 
 * @class UserRepository
 * @implements {IUserRepository}
 */
@Injectable()
export class UserRepository implements IUserRepository {
  /**
   * Constructeur du repository utilisateur
   * @param {Model<User>} userModel - Modèle Mongoose pour les utilisateurs
   */
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  // ========== OPÉRATIONS CRUD DE BASE ==========

  /**
   * Crée un nouvel utilisateur
   * @async
   * @param {RegisterDto} userData - Données d'inscription utilisateur
   * @returns {Promise<User>} L'utilisateur créé
   * @example
   * const user = await userRepository.create({
   *   email: 'user@example.com',
   *   username: 'username',
   *   password: 'hashedPassword'
   * });
   */
  async create(userData: RegisterDto): Promise<User> {
    const user = new this.userModel(userData);
    return user.save();
  }

  /**
   * Trouve un utilisateur par son ID
   * @async
   * @param {string} id - ID unique de l'utilisateur
   * @returns {Promise<User | null>} L'utilisateur trouvé ou null
   */
  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  /**
   * Trouve un utilisateur par son email
   * @async
   * @param {string} email - Adresse email de l'utilisateur
   * @returns {Promise<User | null>} L'utilisateur trouvé ou null
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  /**
   * Trouve un utilisateur par son nom d'utilisateur
   * @async
   * @param {string} username - Nom d'utilisateur unique
   * @returns {Promise<User | null>} L'utilisateur trouvé ou null
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }

  /**
   * Met à jour un utilisateur existant
   * @async
   * @param {string} id - ID de l'utilisateur à modifier
   * @param {Partial<User>} updateData - Données partielles de mise à jour
   * @returns {Promise<User | null>} L'utilisateur mis à jour ou null
   */
  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  /**
   * Supprime un utilisateur
   * @async
   * @param {string} id - ID de l'utilisateur à supprimer
   * @returns {Promise<boolean>} True si suppression réussie, false sinon
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  // ========== OPÉRATIONS D'AUTHENTIFICATION ==========

  /**
   * Vérifie si un email existe déjà
   * @async
   * @param {string} email - Email à vérifier
   * @returns {Promise<boolean>} True si l'email existe
   */
  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.userModel.countDocuments({ email }).exec();
    return count > 0;
  }

  /**
   * Vérifie si un nom d'utilisateur existe déjà
   * @async
   * @param {string} username - Nom d'utilisateur à vérifier
   * @returns {Promise<boolean>} True si le nom d'utilisateur existe
   */
  async existsByUsername(username: string): Promise<boolean> {
    const count = await this.userModel.countDocuments({ username }).exec();
    return count > 0;
  }

  async findBySocialProvider(
    provider: string,
    providerId: string
  ): Promise<User | null> {
    return this.userModel
      .findOne({
        [`socialProviders.${provider}.id`]: providerId,
      })
      .exec();
  }

  async updatePassword(id: string, hashedPassword: string): Promise<boolean> {
    const result = await this.userModel
      .updateOne(
        { _id: id },
        { password: hashedPassword, passwordChangedAt: new Date() }
      )
      .exec();
    return result.modifiedCount > 0;
  }

  async markEmailAsVerified(id: string): Promise<boolean> {
    const result = await this.userModel
      .findByIdAndUpdate(id, { isEmailVerified: true })
      .exec();
    return !!result;
  }

  // ========== AUTHENTIFICATION AVANCÉE ==========

  async findByEmailVerificationToken(token: string): Promise<User | null> {
    return this.userModel.findOne({ emailVerificationToken: token }).exec();
  }

  async updateEmailVerificationToken(
    userId: string,
    token: string
  ): Promise<boolean> {
    const result = await this.userModel
      .findByIdAndUpdate(userId, { emailVerificationToken: token })
      .exec();
    return !!result;
  }

  async findByPasswordResetToken(token: string): Promise<User | null> {
    return this.userModel
      .findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
      })
      .exec();
  }

  async updatePasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date
  ): Promise<boolean> {
    const result = await this.userModel
      .findByIdAndUpdate(userId, {
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
      })
      .exec();
    return !!result;
  }

  async updateLastActive(userId: string): Promise<boolean> {
    const result = await this.userModel
      .findByIdAndUpdate(userId, { lastActivity: new Date() })
      .exec();
    return !!result;
  }

  async createSocialUser(userData: {
    email: string;
    username: string;
    fullName?: string;
    profilePicture?: string;
    provider: string;
    providerId: string;
  }): Promise<User> {
    const user = new this.userModel({
      ...userData,
      isEmailVerified: true, // Les comptes sociaux sont pré-vérifiés
      socialAccounts: [
        {
          provider: userData.provider,
          providerId: userData.providerId,
        },
      ],
    });
    return user.save();
  }

  async incrementWordCount(userId: string): Promise<boolean> {
    const result = await this.userModel
      .findByIdAndUpdate(userId, { $inc: { wordsCount: 1 } })
      .exec();
    return !!result;
  }

  // ========== STATISTIQUES ==========

  async countTotal(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  async countByDateRange(startDate: Date, endDate: Date): Promise<number> {
    return this.userModel
      .countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
      })
      .exec();
  }

  async getTopContributors(limit: number): Promise<
    Array<{
      _id: string;
      username: string;
      wordsCount: number;
      contributionScore: number;
    }>
  > {
    return this.userModel
      .aggregate([
        { $match: { isActive: true } },
        {
          $project: {
            username: 1,
            wordsCount: { $ifNull: ["$wordsCount", 0] },
            contributionScore: {
              $multiply: [
                { $ifNull: ["$wordsCount", 0] },
                { $cond: [{ $eq: ["$role", "admin"] }, 1.5, 1] },
              ],
            },
          },
        },
        { $sort: { contributionScore: -1 as const } },
        { $limit: limit },
      ])
      .exec();
  }

  async countActiveUsers(days: number): Promise<number> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    return this.userModel
      .countDocuments({
        lastActivity: { $gte: sinceDate },
        isActive: true,
      })
      .exec();
  }

  async getUserRank(userId: string): Promise<{
    rank: number;
    totalUsers: number;
    score: number;
  }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException("Utilisateur non trouvé");
    }

    const userScore = (user as any).wordsCount || 0;
    const higherRanked = await this.userModel
      .countDocuments({
        wordsCount: { $gt: userScore },
        isActive: true,
      })
      .exec();

    const totalUsers = await this.userModel
      .countDocuments({ isActive: true })
      .exec();

    return {
      rank: higherRanked + 1,
      totalUsers,
      score: userScore,
    };
  }

  async exportData(
    startDate?: Date,
    endDate?: Date
  ): Promise<
    Array<{
      _id: string;
      username: string;
      email: string;
      fullName: string;
      role: string;
      createdAt: Date;
      lastActivity: Date;
      wordsCount: number;
      isEmailVerified: boolean;
    }>
  > {
    const filter: any = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = startDate;
      if (endDate) filter.createdAt.$lte = endDate;
    }

    return this.userModel
      .find(filter)
      .select(
        "username email fullName role createdAt lastActivity wordsCount isEmailVerified"
      )
      .lean()
      .exec() as any;
  }

  // ========== PROFIL ET PRÉFÉRENCES ==========

  async updateLanguagePreferences(
    id: string,
    data: { nativeLanguageId?: string; learningLanguageIds?: string[] }
  ): Promise<User | null> {
    const updateData: any = {};

    if (data.nativeLanguageId !== undefined) {
      updateData.nativeLanguageId = data.nativeLanguageId;
    }

    if (data.learningLanguageIds !== undefined) {
      updateData.learningLanguageIds = data.learningLanguageIds;
    }

    return this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async updateProfilePicture(id: string, pictureUrl: string): Promise<boolean> {
    const result = await this.userModel
      .updateOne({ _id: id }, { profilePicture: pictureUrl })
      .exec();
    return result.modifiedCount > 0;
  }

  async updateNotificationSettings(
    id: string,
    settings: Record<string, boolean>
  ): Promise<boolean> {
    const result = await this.userModel
      .updateOne({ _id: id }, { notificationSettings: settings })
      .exec();
    return result.modifiedCount > 0;
  }

  // ========== STATISTIQUES ==========

  async countByRole(role: string): Promise<number> {
    return this.userModel.countDocuments({ role }).exec();
  }

  async findActiveUsers(days: number = 30): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.userModel
      .find({
        isActive: true,
        lastLoginAt: { $gte: cutoffDate },
      })
      .sort({ lastLoginAt: -1 })
      .exec();
  }

  async findByNativeLanguage(
    languageId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<User[]> {
    let query = this.userModel.find({ nativeLanguageId: languageId });

    if (options?.offset) {
      query = query.skip(options.offset);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query.exec();
  }

  // ========== RECHERCHE ET FILTRAGE ==========

  async search(
    query: string,
    options?: { limit?: number; offset?: number; role?: string }
  ): Promise<User[]> {
    const searchFilter: any = {
      $or: [
        { username: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { firstName: { $regex: query, $options: "i" } },
        { lastName: { $regex: query, $options: "i" } },
      ],
    };

    if (options?.role) {
      searchFilter.role = options.role;
    }

    let mongoQuery = this.userModel.find(searchFilter);

    if (options?.offset) {
      mongoQuery = mongoQuery.skip(options.offset);
    }

    if (options?.limit) {
      mongoQuery = mongoQuery.limit(options.limit);
    }

    return mongoQuery.exec();
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
    role?: string;
    isEmailVerified?: boolean;
  }): Promise<{
    users: User[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (options?.role) {
      filter.role = options.role;
    }

    if (options?.isEmailVerified !== undefined) {
      filter.isEmailVerified = options.isEmailVerified;
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      users,
      total,
      page,
      limit,
    };
  }

  async findAdmins(): Promise<User[]> {
    return this.userModel
      .find({
        role: { $in: ["admin", "superadmin"] },
        isActive: true,
      })
      .sort({ role: -1, createdAt: 1 })
      .exec();
  }

  async getUserStats(userId: string): Promise<{
    wordsCount: number;
    postsCount: number;
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      return { wordsCount: 0, postsCount: 0 };
    }

    const [wordsCount, postsCount] = await Promise.all([
      this.userModel
        .aggregate([
          { $match: { _id: new Types.ObjectId(userId) } },
          {
            $project: { totalWordsAdded: { $ifNull: ["$totalWordsAdded", 0] } },
          },
        ])
        .exec(),
      this.userModel
        .aggregate([
          { $match: { _id: new Types.ObjectId(userId) } },
          {
            $project: {
              totalCommunityPosts: { $ifNull: ["$totalCommunityPosts", 0] },
            },
          },
        ])
        .exec(),
    ]);

    return {
      wordsCount: wordsCount[0]?.totalWordsAdded || 0,
      postsCount: postsCount[0]?.totalCommunityPosts || 0,
    };
  }

  async count(): Promise<number> {
    // Compter seulement les utilisateurs vraiment actifs :
    // - Email vérifié OU connexion sociale
    // - ET compte actif
    return this.userModel
      .countDocuments({
        isActive: true,
        $or: [
          { isEmailVerified: true },
          { socialProviders: { $ne: {}, $exists: true } },
        ],
      })
      .exec();
  }
}
