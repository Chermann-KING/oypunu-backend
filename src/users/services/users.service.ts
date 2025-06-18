import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async updateUser(
    id: string,
    updateData: Partial<User>,
  ): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(
        id,
        updateData,
        { new: true }, // Retourne le document mis à jour
      )
      .exec();
  }

  async searchUsers(query: string, excludeUserId?: string): Promise<User[]> {
    console.log("[UsersService] Recherche d'utilisateurs");
    console.log('[UsersService] Requête:', query);
    console.log('[UsersService] Utilisateur à exclure:', excludeUserId);

    const searchRegex = new RegExp(query, 'i'); // Recherche insensible à la casse
    console.log('[UsersService] Regex de recherche:', searchRegex);

    const filter: any = {
      $or: [
        { username: { $regex: searchRegex } },
        { email: { $regex: searchRegex } },
      ],
    };

    // Exclure l'utilisateur connecté des résultats
    if (excludeUserId) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      filter._id = { $ne: excludeUserId };
    }

    console.log(
      '[UsersService] Filtre de recherche:',
      JSON.stringify(filter, null, 2),
    );

    const users = await this.userModel
      .find(filter)
      .select(
        '_id username email nativeLanguage learningLanguages profilePicture',
      )
      .limit(10) // Limiter les résultats
      .exec();

    console.log('[UsersService] Utilisateurs trouvés en base:', users.length);
    console.log(
      '[UsersService] Premier utilisateur (si existe):',
      users[0]
        ? {
            id: users[0]._id,
            username: users[0].username,
            email: users[0].email,
          }
        : 'Aucun',
    );

    return users;
  }

  async getUserStats(userId: string): Promise<{
    totalWordsAdded: number;
    totalCommunityPosts: number;
    favoriteWordsCount: number;
    joinDate: Date;
  }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    return {
      totalWordsAdded: user.totalWordsAdded || 0,
      totalCommunityPosts: user.totalCommunityPosts || 0,
      favoriteWordsCount: user.favoriteWords?.length || 0,
      joinDate:
        (user as unknown as { createdAt?: Date }).createdAt || new Date(),
    };
  }

  async incrementWordCount(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { $inc: { totalWordsAdded: 1 } })
      .exec();
  }

  async incrementPostCount(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { $inc: { totalCommunityPosts: 1 } })
      .exec();
  }

  async updateLastActive(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { lastActive: new Date() })
      .exec();
  }
}
