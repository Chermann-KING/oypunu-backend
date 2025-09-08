/**
 * @fileoverview Service pour la page d'accueil O'Ypunu
 * 
 * Ce service gère la logique métier de la page d'accueil avec
 * récupération des mots vedettes (cache quotidien), calcul des
 * statistiques globales et optimisations de performance.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Inject } from "@nestjs/common";
import { Word } from "../dictionary/schemas/word.schema";
import { User } from "../users/schemas/user.schema";
import { Language } from "../languages/schemas/language.schema";
import { IWordRepository } from "../repositories/interfaces/word.repository.interface";
import { IUserRepository } from "../repositories/interfaces/user.repository.interface";
import { ILanguageRepository } from "../repositories/interfaces/language.repository.interface";

/**
 * Interface pour les mots vedettes de la page d'accueil
 * 
 * Structure optimisée pour affichage frontend avec données
 * essentielles pour engagement utilisateur maximal.
 * 
 * @interface FeaturedWord
 * @property {string} id - Identifiant unique du mot
 * @property {string} word - Mot en question
 * @property {string} language - Nom complet de la langue
 * @property {string} languageCode - Code ISO de la langue
 * @property {string} partOfSpeech - Nature grammaticale
 * @property {string} definition - Définition principale
 * @property {string} pronunciation - Transcription phonétique
 * @property {boolean} isFavorite - Statut favori (pour UI)
 * @property {string} createdBy - Nom du contributeur
 * @property {Date} updatedAt - Date de dernière modification
 */
export interface FeaturedWord {
  id: string;
  word: string;
  language: string;
  languageCode: string;
  partOfSpeech: string;
  definition: string;
  pronunciation: string;
  isFavorite: boolean;
  createdBy: string;
  updatedAt: Date;
}

/**
 * Service pour la page d'accueil O'Ypunu
 * 
 * Gère la logique métier de la page d'accueil avec système de cache
 * intelligent pour les mots vedettes (mise à jour quotidienne) et
 * calcul des statistiques globales en temps réel via repositories.
 * 
 * ## Fonctionnalités principales :
 * - Sélection aléatoire de mots vedettes avec cache quotidien
 * - Statistiques globales (utilisateurs, mots, langues actives)
 * - Optimisations de performance avec mise en cache
 * - Gestion d'erreurs robuste avec fallbacks
 * - Transformation des données pour interface utilisateur
 * 
 * @class HomeService
 * @version 1.0.0
 */
@Injectable()
export class HomeService {
  private _featuredWordsCache: FeaturedWord[] = [];
  private _lastCacheUpdate: Date | null = null;

  constructor(
    @Inject("IWordRepository") private wordRepository: IWordRepository,
    @Inject("IUserRepository") private userRepository: IUserRepository,
    @Inject("ILanguageRepository")
    private languageRepository: ILanguageRepository
  ) {}

  async getFeaturedWords() {
    // Vérifier si le cache doit être mis à jour (quotidiennement)
    const now = new Date();
    const shouldUpdateCache =
      !this._lastCacheUpdate ||
      now.getDate() !== this._lastCacheUpdate.getDate() ||
      now.getMonth() !== this._lastCacheUpdate.getMonth() ||
      now.getFullYear() !== this._lastCacheUpdate.getFullYear();

    if (shouldUpdateCache || this._featuredWordsCache.length === 0) {
      console.log("Mise à jour du cache des mots en vedette...");
      await this._updateFeaturedWordsCache();
    }

    return this._featuredWordsCache;
  }

  private async _updateFeaturedWordsCache() {
    try {
      // Compter le nombre total de mots approuvés
      const totalApprovedWords =
        await this.wordRepository.countByStatus("approved");

      if (totalApprovedWords === 0) {
        console.log("Aucun mot approuvé trouvé");
        this._featuredWordsCache = [];
        return;
      }

      // Sélectionner 3 mots vedettes (ou moins s'il y en a moins de 3)
      const limit = Math.min(3, totalApprovedWords);

      // Utiliser la méthode findRandomWithCreatedBy du repository
      const randomWords =
        await this.wordRepository.findRandomWithCreatedBy(limit);

      console.log(`${randomWords.length} mots aléatoires sélectionnés`);

      this._featuredWordsCache = randomWords.map((word) => {
        // Extraire les informations nécessaires pour le format FeaturedWord
        const partOfSpeech =
          word.meanings && word.meanings.length > 0
            ? word.meanings[0].partOfSpeech
            : "";

        const definition =
          word.meanings &&
          word.meanings.length > 0 &&
          word.meanings[0].definitions &&
          word.meanings[0].definitions.length > 0
            ? word.meanings[0].definitions[0].definition
            : "";

        // Extraire le username de manière sûre
        let createdByUsername = "anonymous";
        if (
          word.createdBy &&
          typeof word.createdBy === "object" &&
          "username" in word.createdBy
        ) {
          createdByUsername = (word.createdBy as any).username || "anonymous";
        }

        return {
          id: word._id.toString(),
          word: word.word,
          language: this._getLanguageName(word.language || "fr"),
          languageCode: word.language || "fr", // Fallback vers français si undefined
          partOfSpeech,
          definition,
          pronunciation:
            word.meanings?.[0]?.phonetics?.[0]?.text ||
            word.pronunciation ||
            `/${word.word}/`,
          isFavorite: false,
          createdBy: createdByUsername,
          updatedAt: new Date(word.updatedAt),
        };
      });

      this._lastCacheUpdate = new Date();
      console.log("Cache des mots en vedette mis à jour avec succès");
    } catch (error) {
      console.error(
        "Erreur lors de la mise à jour du cache des mots en vedette:",
        error
      );
      this._featuredWordsCache = [];
    }
  }

  async getStatistics() {
    try {
      // Récupère les statistiques réelles via les repositories
      const activeUsers = await this.userRepository.count();

      const definedWords = await this.wordRepository.countByStatus("approved");

      // Compter uniquement les langues approuvées
      const activeLanguagesCount =
        await this.languageRepository.countApproved();      return {
        activeUsers,
        definedWords,
        languages: activeLanguagesCount,
      };
    } catch (error) {
      console.error("Erreur lors de la récupération des statistiques:", error);
      return {
        activeUsers: 0,
        definedWords: 0,
        languages: 0,
      };
    }
  }

  // Fonction d'aide pour convertir les codes de langue en noms complets
  private _getLanguageName(code: string): string {
    const languageMap: Record<string, string> = {
      fr: "Français",
      en: "Anglais",
      es: "Espagnol",
      de: "Allemand",
      it: "Italien",
      pt: "Portugais",
      ru: "Russe",
      ja: "Japonais",
      zh: "Chinois",
      da: "Danois",
    };

    return languageMap[code] || code;
  }
}
