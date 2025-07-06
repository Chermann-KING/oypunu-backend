import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { ActivityFeed, ActivityFeedDocument } from '../../common/schemas/activity-feed.schema';
import { Word, WordDocument } from '../../dictionary/schemas/word.schema';
import { WordView, WordViewDocument } from '../schemas/word-view.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ActivityFeed.name) private activityFeedModel: Model<ActivityFeedDocument>,
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    @InjectModel(WordView.name) private wordViewModel: Model<WordViewDocument>
  ) {}

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
    streak: number;
    languagesContributed: number;
    languagesExplored: number;
    contributionScore: number;
    activitiesThisWeek: number;
    lastActivityDate?: Date;
  }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    // Utiliser notre nouvelle méthode intelligente
    const personalStats = await this.getUserPersonalStats(userId);

    return {
      totalWordsAdded: personalStats.wordsAdded, // Utiliser le comptage réel
      totalCommunityPosts: user.totalCommunityPosts || 0,
      favoriteWordsCount: user.favoriteWords?.length || 0,
      joinDate: (user as unknown as { createdAt?: Date }).createdAt || new Date(),
      // Nouvelles stats intelligentes
      streak: personalStats.streak,
      languagesContributed: personalStats.languagesContributed, // NOUVELLE MÉTRIQUE
      languagesExplored: personalStats.languagesExplored,
      contributionScore: personalStats.contributionScore,
      activitiesThisWeek: personalStats.activitiesThisWeek,
      lastActivityDate: personalStats.lastActivityDate
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

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async activateSuperAdmins(): Promise<number> {
    const result = await this.userModel.updateMany(
      { role: { $in: ['superadmin', 'admin', 'contributor'] } },
      { isActive: true }
    ).exec();
    
    console.log('🔧 Activation des utilisateurs avec rôles élevés:', result.modifiedCount);
    return result.modifiedCount;
  }

  async getActiveUsersCount(): Promise<number> {
    // Utilisateurs actifs dans les 5 dernières minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    return this.userModel
      .countDocuments({
        lastActive: { $gte: fiveMinutesAgo },
        isActive: true
      })
      .exec();
  }

  async getOnlineContributorsCount(): Promise<number> {
    // Contributeurs en ligne = utilisateurs actifs qui SOIT :
    // 1. Ont ajouté au moins un mot OU
    // 2. Ont un rôle contributor, admin ou superadmin
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    console.log('🔍 Recherche des contributeurs en ligne...');
    console.log('⏰ Seuil de temps (5 min ago):', fiveMinutesAgo.toISOString());
    
    const count = await this.userModel
      .countDocuments({
        lastActive: { $gte: fiveMinutesAgo },
        isActive: true,
        $or: [
          { totalWordsAdded: { $gt: 0 } },
          { role: { $in: ['contributor', 'admin', 'superadmin'] } }
        ]
      })
      .exec();
    
    console.log('📊 Contributeurs en ligne trouvés:', count);
    
    // Debug: afficher les utilisateurs qui matchent
    const users = await this.userModel
      .find({
        lastActive: { $gte: fiveMinutesAgo },
        isActive: true,
        $or: [
          { totalWordsAdded: { $gt: 0 } },
          { role: { $in: ['contributor', 'admin', 'superadmin'] } }
        ]
      })
      .select('username role totalWordsAdded lastActive isActive')
      .exec();
    
    console.log('👥 Utilisateurs actifs détaillés:', users.map(u => ({
      username: u.username,
      role: u.role,
      totalWords: u.totalWordsAdded,
      lastActive: u.lastActive,
      isActive: u.isActive
    })));
    
    return count;
  }

  /**
   * Calcule le nombre de jours consécutifs d'activité pour un utilisateur
   * Basé sur les activités réelles enregistrées dans la base de données
   */
  async getUserActivityStreak(userId: string): Promise<number> {
    try {
      // Récupérer toutes les activités de l'utilisateur triées par date décroissante
      const activities = await this.activityFeedModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .lean()
        .exec();

      if (activities.length === 0) {
        return 0;
      }

      // Organiser les activités par jour
      const activitiesByDay = new Map<string, boolean>();
      
      activities.forEach(activity => {
        const date = new Date(activity.createdAt);
        const dayKey = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
        activitiesByDay.set(dayKey, true);
      });

      // Calculer la séquence consécutive à partir d'aujourd'hui
      let streakCount = 0;
      const today = new Date();
      let currentDate = new Date(today);

      // Commencer par aujourd'hui et remonter dans le temps
      while (true) {
        const dayKey = currentDate.toISOString().split('T')[0];
        
        if (activitiesByDay.has(dayKey)) {
          streakCount++;
          // Passer au jour précédent
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          // La séquence est rompue
          break;
        }
      }

      console.log(`📊 Streak calculé pour ${userId}: ${streakCount} jours consécutifs`);
      return streakCount;

    } catch (error) {
      console.error('❌ Erreur lors du calcul du streak:', error);
      return 0;
    }
  }

  /**
   * Obtient les statistiques personnelles complètes d'un utilisateur
   */
  async getUserPersonalStats(userId: string): Promise<{
    wordsAdded: number;
    favoritesCount: number;
    languagesContributed: number;
    languagesExplored: number;
    contributionScore: number;
    streak: number;
    lastActivityDate?: Date;
    activitiesThisWeek: number;
  }> {
    try {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      // Calculer le streak de manière intelligente
      const streak = await this.getUserActivityStreak(userId);

      // Compter les mots RÉELLEMENT présents en base de données créés par cet utilisateur et approuvés
      const actualWordsAdded = await this.wordModel
        .countDocuments({
          createdBy: userId,
          status: 'approved'
        })
        .exec();

      console.log(`📊 Mots réels pour ${userId}: ${actualWordsAdded} (vs compteur: ${user.totalWordsAdded})`);

      // Compter les activités de cette semaine
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const activitiesThisWeek = await this.activityFeedModel
        .countDocuments({
          userId,
          createdAt: { $gte: oneWeekAgo }
        })
        .exec();

      // Obtenir la dernière activité
      const lastActivity = await this.activityFeedModel
        .findOne({ userId })
        .sort({ createdAt: -1 })
        .select('createdAt')
        .exec();

      // === LANGUES CONTRIBUÉES (Option A) ===
      // Langues où l'utilisateur a activement contribué (créé des mots, ajouté des traductions)
      const contributionActivities = await this.activityFeedModel
        .find({ 
          userId,
          activityType: { $in: ['word_created', 'translation_added', 'synonym_added'] },
          'metadata.languageCode': { $exists: true, $ne: null }
        })
        .distinct('metadata.languageCode')
        .exec();

      // === LANGUES EXPLORÉES (Option B) ===
      // Toutes les langues avec lesquelles l'utilisateur a interagi
      const [allActivityLanguages, wordsLanguages, communityLanguages] = await Promise.all([
        // 1. Langues des activités de l'utilisateur
        this.activityFeedModel
          .find({ 
            userId,
            'metadata.languageCode': { $exists: true, $ne: null }
          })
          .distinct('metadata.languageCode')
          .exec(),

        // 2. Langues des mots créés par l'utilisateur
        this.wordModel
          .find({ 
            createdBy: userId,
            status: 'approved'
          })
          .distinct('language')
          .exec(),

        // 3. TODO: Langues des communautés rejointes (à implémenter avec CommunityMember)
        Promise.resolve([])
      ]);

      // Combiner toutes les langues uniques
      const allExploredLanguages = new Set([
        ...allActivityLanguages,
        ...wordsLanguages,
        ...communityLanguages
      ]);

      const stats = {
        wordsAdded: actualWordsAdded,
        favoritesCount: 0, // À implémenter avec le modèle FavoriteWord
        languagesContributed: contributionActivities.length, // NOUVELLE MÉTRIQUE
        languagesExplored: allExploredLanguages.size, // MÉTRIQUE ÉLARGIE
        contributionScore: actualWordsAdded * 10 + activitiesThisWeek * 5,
        streak,
        lastActivityDate: lastActivity?.createdAt,
        activitiesThisWeek
      };

      console.log(`📈 Stats personnelles pour ${user.username}:`, stats);
      return stats;

    } catch (error) {
      console.error('❌ Erreur lors du calcul des stats personnelles:', error);
      return {
        wordsAdded: 0,
        favoritesCount: 0,
        languagesContributed: 0,
        languagesExplored: 0,
        contributionScore: 0,
        streak: 0,
        activitiesThisWeek: 0
      };
    }
  }

  /**
   * Récupère les mots récemment créés par l'utilisateur
   */
  async getUserRecentContributions(userId: string, limit: number = 5): Promise<any[]> {
    try {
      const recentWords = await this.wordModel
        .find({ 
          createdBy: userId,
          status: 'approved'
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('word language meanings.definitions createdAt')
        .lean()
        .exec();

      return recentWords.map(word => ({
        id: word._id,
        word: word.word,
        language: word.language,
        definition: word.meanings?.[0]?.definitions?.[0]?.definition || 'Définition non disponible',
        createdAt: word.createdAt,
        isOwner: true // Toujours true puisque c'est ses mots
      }));

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des contributions récentes:', error);
      return [];
    }
  }

  /**
   * Récupère les mots récemment consultés par l'utilisateur
   */
  async getUserRecentConsultations(userId: string, limit: number = 5): Promise<any[]> {
    try {
      console.log('🔍 Recherche consultations pour utilisateur:', userId);
      
      const recentConsultations = await this.wordViewModel
        .find({ userId })
        .sort({ lastViewedAt: -1 })
        .limit(limit)
        .populate('wordId', 'word language meanings.definitions status')
        .lean()
        .exec();

      console.log('📊 Consultations trouvées:', recentConsultations.length);
      console.log('📋 Détails consultations:', recentConsultations.map(c => ({
        wordId: c.wordId ? (c.wordId as any)._id : 'null',
        word: c.wordId ? (c.wordId as any).word : 'null',
        status: c.wordId ? (c.wordId as any).status : 'null',
        lastViewedAt: c.lastViewedAt
      })));

      const filteredConsultations = recentConsultations
        .filter(consultation => consultation.wordId && consultation.wordId.status === 'approved');
      
      console.log('✅ Consultations après filtrage (approved seulement):', filteredConsultations.length);

      return filteredConsultations
        .map(consultation => {
          const wordData = consultation.wordId as any;
          return {
            id: wordData._id?.toString() || wordData.id?.toString() || '',
            word: wordData.word,
            language: wordData.language,
            definition: wordData.meanings?.[0]?.definitions?.[0]?.definition || 'Définition non disponible',
            lastViewedAt: consultation.lastViewedAt,
            viewCount: consultation.viewCount,
            viewType: consultation.viewType,
            isOwner: false // Ce ne sont pas ses mots, mais des consultations
          };
        });

    } catch (error) {
      console.error('❌ Erreur lors de la récupération des consultations récentes:', error);
      return [];
    }
  }
}
