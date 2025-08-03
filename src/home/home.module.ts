/**
 * @fileoverview Module de la page d'accueil pour O'Ypunu
 * 
 * Ce module gère la page d'accueil de la plateforme O'Ypunu avec affichage
 * des statistiques globales, mots populaires, langues tendances et
 * données d'engagement pour présenter un aperçu dynamique de la plateforme.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { RepositoriesModule } from '../repositories/repositories.module';

/**
 * Module de la page d'accueil O'Ypunu
 * 
 * Ce module centralise la logique de la page d'accueil de la plateforme :
 * 
 * ## 🏠 Fonctionnalités d'accueil :
 * - **Statistiques globales** : Nombre de mots, langues, utilisateurs
 * - **Contenu populaire** : Mots tendances et les plus consultés
 * - **Activité récente** : Dernières contributions et validations
 * - **Langues vedettes** : Mise en avant des langues actives
 * - **Call-to-action** : Incitation à contribuer et explorer
 * 
 * ## 📊 Données affichées :
 * - Métriques temps réel de la plateforme
 * - Top des mots par popularité
 * - Langues avec le plus de contributions
 * - Statistiques d'engagement utilisateur
 * - Aperçu diversité linguistique
 * 
 * ## 🔗 Dépendances :
 * - **RepositoriesModule** : Accès aux données via repositories
 * - **HomeController** : Endpoints API pour la page d'accueil
 * - **HomeService** : Logique métier et agrégation de données
 * 
 * @module HomeModule
 * @version 1.0.0
 */
@Module({
  imports: [
    RepositoriesModule,
  ],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
