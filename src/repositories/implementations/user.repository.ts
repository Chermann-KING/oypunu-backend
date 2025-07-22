import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { RegisterDto } from '../../users/dto/register.dto';
import { IUserRepository } from '../interfaces/user.repository.interface';

/**
 * 👤 REPOSITORY USER - IMPLÉMENTATION MONGOOSE
 * 
 * Implémentation concrète du repository User utilisant Mongoose.
 * Sépare complètement l'accès aux données de la logique métier.
 * 
 * Avantages :
 * ✅ Tests unitaires faciles (mockage de l'interface)
 * ✅ Migration DB simplifiée (changer l'implémentation)
 * ✅ Logique métier découplée des détails techniques
 * ✅ Réutilisabilité des interfaces dans différents contextes
 */
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  // ========== CRUD DE BASE ==========

  async create(userData: RegisterDto): Promise<User> {
    const user = new this.userModel(userData);
    return user.save();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    return !!result;
  }

  // ========== AUTHENTIFICATION ==========

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.userModel.countDocuments({ email }).exec();
    return count > 0;
  }

  async existsByUsername(username: string): Promise<boolean> {
    const count = await this.userModel.countDocuments({ username }).exec();
    return count > 0;
  }

  async findBySocialProvider(provider: string, providerId: string): Promise<User | null> {
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
      .updateOne(
        { _id: id },
        { 
          isEmailVerified: true, 
          emailVerifiedAt: new Date(),
          emailVerificationToken: null 
        }
      )
      .exec();
    return result.modifiedCount > 0;
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

  async count(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  async countByRole(role: string): Promise<number> {
    return this.userModel.countDocuments({ role }).exec();
  }

  async findActiveUsers(days: number = 30): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.userModel
      .find({
        isActive: true,
        lastLoginAt: { $gte: cutoffDate }
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
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
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
        role: { $in: ['admin', 'superadmin'] },
        isActive: true 
      })
      .sort({ role: -1, createdAt: 1 })
      .exec();
  }
}