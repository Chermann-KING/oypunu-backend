import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Language, LanguageDocument } from '../schemas/language.schema';
import { Word, WordDocument } from '../../dictionary/schemas/word.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { AFRICAN_LANGUAGES_SEED } from '../data/african-languages-seed';

@Injectable()
export class LanguageMigrationService {
  private readonly logger = new Logger(LanguageMigrationService.name);

  constructor(
    @InjectModel(Language.name) private languageModel: Model<LanguageDocument>,
    @InjectModel(Word.name) private wordModel: Model<WordDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * 🚀 ÉTAPE 1: Seeder les langues africaines prioritaires
   */
  async seedAfricanLanguages(): Promise<void> {
    this.logger.log('🌍 Début du seeding des langues africaines...');

    for (const languageData of AFRICAN_LANGUAGES_SEED) {
      try {
        // Vérifier si la langue existe déjà
        const existingLanguage = await this.languageModel.findOne({
          $or: [
            { name: languageData.name },
            { nativeName: languageData.nativeName },
            ...(languageData.iso639_1
              ? [{ iso639_1: languageData.iso639_1 }]
              : []),
            ...(languageData.iso639_3
              ? [{ iso639_3: languageData.iso639_3 }]
              : []),
          ],
        });

        if (existingLanguage) {
          this.logger.warn(
            `⚠️ Langue ${languageData.name} existe déjà, ignorée`,
          );
          continue;
        }

        // Créer la langue avec statut actif (pré-approuvée) - utiliser seulement les champs existants
        const language = new this.languageModel({
          name: languageData.name,
          nativeName: languageData.nativeName,
          iso639_1: languageData.iso639_1,
          iso639_2: languageData.iso639_2,
          iso639_3: languageData.iso639_3,
          region: languageData.region,
          countries: languageData.countries,
          speakerCount: languageData.speakerCount,
          description: languageData.description,
          endangermentStatus: languageData.endangermentStatus,
          isAfricanLanguage: true,
          isFeatured: languageData.isFeatured || false,
          sortOrder: languageData.sortOrder,
          systemStatus: 'active',
          isVisible: true,
          proposedBy: null, // Languages seed sont pré-approuvées
          approvedBy: null,
          approvedAt: new Date(),
          scripts: languageData.scripts || [
            {
              name: 'Latin',
              code: 'Latn',
              direction: 'ltr',
              isDefault: true,
            },
          ],
        });

        await language.save();
        this.logger.log(
          `✅ Langue ${languageData.name} (${languageData.nativeName}) créée`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Erreur lors de la création de ${languageData.name}:`,
          error,
        );
      }
    }

    this.logger.log('🎉 Seeding des langues terminé !');
  }

  /**
   * 🔄 ÉTAPE 2: Migrer les mots existants vers les nouveaux IDs de langue
   */
  async migrateWordsToLanguageIds(): Promise<void> {
    this.logger.log('📚 Début de la migration des mots...');

    // Mapping des codes ISO vers les IDs MongoDB
    const languageMapping = await this.createLanguageMapping();

    // Migrer tous les mots
    const words = await this.wordModel.find({}).exec();
    let migratedCount = 0;
    let failedCount = 0;

    for (const word of words) {
      try {
        if (!word.language) {
          failedCount++;
          continue;
        }
        const languageId = languageMapping[word.language];

        if (languageId) {
          // Mettre à jour le mot avec le nouvel ID de langue
          await this.wordModel.findByIdAndUpdate(word._id, {
            languageId: languageId,
            // Garder l'ancien champ pour compatibilité temporaire
            oldLanguageCode: word.language,
          });
          migratedCount++;
        } else {
          this.logger.warn(
            `⚠️ Aucune langue trouvée pour le code: ${word.language} (mot: ${word.word})`,
          );
          failedCount++;
        }
      } catch (error) {
        this.logger.error(`❌ Erreur migration mot ${word.word}:`, error);
        failedCount++;
      }
    }

    this.logger.log(
      `📊 Migration mots terminée: ${migratedCount} réussis, ${failedCount} échoués`,
    );
  }

  /**
   * 👥 ÉTAPE 3: Migrer les utilisateurs vers les nouveaux IDs de langue
   */
  async migrateUsersToLanguageIds(): Promise<void> {
    this.logger.log('👥 Début de la migration des utilisateurs...');

    const languageMapping = await this.createLanguageMapping();
    const users = await this.userModel.find({}).exec();
    let migratedCount = 0;

    for (const user of users) {
      try {
        const updates: any = {};

        // Migrer la langue native
        if (user.nativeLanguage && languageMapping[user.nativeLanguage]) {
          updates.nativeLanguageId = languageMapping[user.nativeLanguage];
          updates.oldNativeLanguage = user.nativeLanguage;
        }

        // Migrer les langues d'apprentissage
        if (user.learningLanguages && user.learningLanguages.length > 0) {
          const learningLanguageIds = user.learningLanguages
            .map((code) => languageMapping[code])
            .filter((id) => id !== undefined);

          if (learningLanguageIds.length > 0) {
            updates.learningLanguageIds = learningLanguageIds;
            updates.oldLearningLanguages = user.learningLanguages;
          }
        }

        if (Object.keys(updates).length > 0) {
          await this.userModel.findByIdAndUpdate(user._id, updates);
          migratedCount++;
        }
      } catch (error) {
        this.logger.error(
          `❌ Erreur migration utilisateur ${user.username}:`,
          error,
        );
      }
    }

    this.logger.log(
      `👥 Migration utilisateurs terminée: ${migratedCount} migrés`,
    );
  }

  /**
   * 🔧 ÉTAPE 4: Mettre à jour les statistiques des langues
   */
  async updateLanguageStatistics(): Promise<void> {
    this.logger.log('📊 Mise à jour des statistiques des langues...');

    const languages = await this.languageModel
      .find({ systemStatus: 'active' })
      .exec();

    for (const language of languages) {
      try {
        // Compter les mots dans cette langue
        const wordCount = await this.wordModel.countDocuments({
          languageId: language._id,
        });

        // Compter les utilisateurs avec cette langue
        const nativeUserCount = await this.userModel.countDocuments({
          nativeLanguageId: language._id,
        });

        const learningUserCount = await this.userModel.countDocuments({
          learningLanguageIds: language._id,
        });

        // Compter les contributeurs actifs (utilisateurs avec des mots dans cette langue)
        const contributorPipeline = [
          { $match: { languageId: language._id } },
          { $group: { _id: '$createdBy' } },
          { $count: 'contributors' },
        ];
        const contributorResult =
          await this.wordModel.aggregate(contributorPipeline);
        const contributorCount =
          contributorResult.length > 0 ? contributorResult[0].contributors : 0;

        // Mettre à jour les statistiques
        await this.languageModel.findByIdAndUpdate(language._id, {
          wordCount,
          userCount: nativeUserCount + learningUserCount,
          contributorCount,
        });

        this.logger.log(
          `📈 ${language.name}: ${wordCount} mots, ${nativeUserCount + learningUserCount} utilisateurs`,
        );
      } catch (error) {
        this.logger.error(`❌ Erreur stats pour ${language.name}:`, error);
      }
    }

    this.logger.log('📊 Mise à jour des statistiques terminée !');
  }

  /**
   * 🗺️ Créer le mapping code ISO → ID MongoDB
   */
  private async createLanguageMapping(): Promise<Record<string, string>> {
    const languages = await this.languageModel
      .find({ systemStatus: 'active' })
      .exec();
    const mapping: Record<string, string> = {};

    for (const language of languages) {
      // Mapper tous les codes ISO disponibles
      const languageId = (language._id as any).toString();
      if (language.iso639_1) {
        mapping[language.iso639_1] = languageId;
      }
      if (language.iso639_2) {
        mapping[language.iso639_2] = languageId;
      }
      if (language.iso639_3) {
        mapping[language.iso639_3] = languageId;
      }

      // Fallback sur le nom de la langue (en lowercase)
      mapping[language.name.toLowerCase()] = languageId;
    }

    return mapping;
  }

  /**
   * 🧹 ÉTAPE 5: Nettoyer les anciens champs (après validation)
   */
  async cleanupOldLanguageFields(): Promise<void> {
    this.logger.log('🧹 Nettoyage des anciens champs de langue...');

    // Supprimer les anciens champs des mots
    await this.wordModel.updateMany(
      {},
      {
        $unset: {
          language: 1,
          oldLanguageCode: 1,
        },
      },
    );

    // Supprimer les anciens champs des utilisateurs
    await this.userModel.updateMany(
      {},
      {
        $unset: {
          nativeLanguage: 1,
          learningLanguages: 1,
          oldNativeLanguage: 1,
          oldLearningLanguages: 1,
        },
      },
    );

    this.logger.log('🧹 Nettoyage terminé !');
  }

  /**
   * 🎯 MIGRATION COMPLÈTE (toutes les étapes)
   */
  async runFullMigration(): Promise<void> {
    this.logger.log('🚀 DÉBUT DE LA MIGRATION COMPLÈTE');

    try {
      await this.seedAfricanLanguages();
      await this.migrateWordsToLanguageIds();
      await this.migrateUsersToLanguageIds();
      await this.updateLanguageStatistics();

      this.logger.log('✅ MIGRATION COMPLÈTE RÉUSSIE !');
      this.logger.warn(
        "⚠️ N'oubliez pas de mettre à jour les schémas et supprimer les anciens champs après validation",
      );
    } catch (error) {
      this.logger.error('❌ ERREUR DURANT LA MIGRATION:', error);
      throw error;
    }
  }

  /**
   * 📊 Rapport de migration
   */
  async getMigrationReport(): Promise<any> {
    const totalLanguages = await this.languageModel.countDocuments({});
    const activeLanguages = await this.languageModel.countDocuments({
      systemStatus: 'active',
    });
    const pendingLanguages = await this.languageModel.countDocuments({
      systemStatus: 'proposed',
    });

    const totalWords = await this.wordModel.countDocuments({});
    const migratedWords = await this.wordModel.countDocuments({
      languageId: { $exists: true },
    });

    const totalUsers = await this.userModel.countDocuments({});
    const migratedUsers = await this.userModel.countDocuments({
      $or: [
        { nativeLanguageId: { $exists: true } },
        { learningLanguageIds: { $exists: true } },
      ],
    });

    return {
      languages: {
        total: totalLanguages,
        active: activeLanguages,
        pending: pendingLanguages,
      },
      words: {
        total: totalWords,
        migrated: migratedWords,
        percentage:
          totalWords > 0 ? Math.round((migratedWords / totalWords) * 100) : 0,
      },
      users: {
        total: totalUsers,
        migrated: migratedUsers,
        percentage:
          totalUsers > 0 ? Math.round((migratedUsers / totalUsers) * 100) : 0,
      },
    };
  }
}
