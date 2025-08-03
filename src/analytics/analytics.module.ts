/**
 * @fileoverview Module NestJS d'analytics et métriques avancées pour O'Ypunu
 * 
 * Ce module fournit un système complet d'analytics et de métriques en temps réel
 * pour la plateforme O'Ypunu. Il centralise toutes les fonctionnalités de collecte,
 * traitement et présentation de données analytiques avec support d'export et
 * de tableaux de bord personnalisés.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from '@nestjs/common';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { RepositoriesModule } from '../repositories/repositories.module';

/**
 * Module d'analytics et métriques avancées pour O'Ypunu
 * 
 * Ce module centralise tous les outils d'analyse de données et de génération
 * de métriques pour la plateforme. Il fournit des tableaux de bord interactifs,
 * des analyses d'engagement utilisateur, et des outils d'export de données.
 * 
 * ## Fonctionnalités principales :
 * 
 * ### 📊 Tableaux de bord analytiques
 * - Dashboard administrateur avec métriques temps réel
 * - Vue d'ensemble des KPIs de la plateforme
 * - Métriques d'engagement et d'activité
 * - Analyses de performance système
 * 
 * ### 👤 Analytics utilisateur
 * - Statistiques détaillées par utilisateur
 * - Analyse des préférences linguistiques
 * - Suivi des contributions et activités
 * - Calcul de rankings et achievements
 * 
 * ### 🌍 Analyses linguistiques
 * - Tendances d'usage par langue
 * - Évolution temporelle du contenu
 * - Statistiques de recherche par langue
 * - Métriques de croissance linguistique
 * 
 * ### 📈 Métriques avancées
 * - Mots les plus recherchés
 * - Analyses d'engagement par fonctionnalité
 * - Métriques de performance technique
 * - Tendances d'utilisation temporelles
 * 
 * ### 💾 Export et reporting
 * - Export de données (JSON/CSV)
 * - Génération de rapports personnalisés
 * - Analyse sur périodes configurables
 * - Intégration avec outils externes
 * 
 * @module AnalyticsModule
 * @version 1.0.0
 */
@Module({
  imports: [
    RepositoriesModule, // Accès aux repositories pour données (Word, User, WordView, ActivityFeed)
  ],
  controllers: [
    AnalyticsController, // API REST complète pour analytics et métriques
  ],
  providers: [
    AnalyticsService, // Service principal pour calculs statistiques et agrégations
  ],
  exports: [
    AnalyticsService, // Service exporté pour utilisation par AdminModule et autres
  ],
})
export class AnalyticsModule {}