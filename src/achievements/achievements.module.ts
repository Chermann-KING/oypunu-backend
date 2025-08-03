/**
 * @fileoverview Module NestJS pour le système d'achievements et gamification
 * 
 * Ce module intègre complètement le système de badges, achievements et gamification
 * dans l'application O'Ypunu. Il fournit une motivation continue aux utilisateurs
 * à travers des récompenses, classements et défis personnalisés.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from '@nestjs/common';
import { AchievementsController } from './controllers/achievements.controller';
import { AchievementsService } from './services/achievements.service';
import { RepositoriesModule } from '../repositories/repositories.module';

/**
 * Module de gamification et achievements pour O'Ypunu
 * 
 * Ce module implémente un système complet d'achievements et de gamification
 * qui motive les utilisateurs à contribuer activement à la plateforme.
 * 
 * ## Fonctionnalités principales :
 * 
 * ### 🏆 Système de badges multi-niveaux
 * - Bronze, Silver, Gold, Platinum, Diamond
 * - Plus de 15 achievements dans 5 catégories différentes
 * - Calcul de rareté basé sur les statistiques communautaires
 * 
 * ### 📊 Suivi et progression temps réel
 * - Calcul automatique des progrès basé sur l'activité utilisateur
 * - Déblocage automatique avec notifications
 * - Système de points et niveaux progressifs (1000 points/niveau)
 * 
 * ### 🏅 Classements et leaderboards
 * - Classements globaux et par catégorie
 * - Filtrage par période (semaine, mois, année)
 * - Affichage des achievements rares et exclusifs
 * 
 * ### 📈 Analytics et statistiques
 * - Métriques d'engagement et rétention
 * - Statistiques globales pour les administrateurs
 * - Tendances et analyse des comportements
 * 
 * ## Catégories d'achievements :
 * - **Contribution** : Création de mots, traductions, contenu
 * - **Social** : Interactions, commentaires, aides communautaires
 * - **Learning** : Consultation, découverte de contenu
 * - **Milestone** : Jalons temporels et fidélité
 * - **Special** : Events exclusifs et achievements rares
 * 
 * @module AchievementsModule
 * @version 1.0.0
 */
@Module({
  imports: [
    RepositoriesModule, // Accès aux repositories pour calcul des métriques
  ],
  controllers: [
    AchievementsController, // API REST complète pour les achievements
  ],
  providers: [
    AchievementsService, // Logique métier et calculs de progression
  ],
  exports: [
    AchievementsService, // Service disponible pour d'autres modules
  ],
})
export class AchievementsModule {}