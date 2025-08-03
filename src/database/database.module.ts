/**
 * @fileoverview Module de gestion de base de données et migrations O'Ypunu
 * 
 * Ce module centralise toute la logique de base de données incluant
 * la configuration Mongoose, les migrations de schéma et les services
 * utilitaires pour la maintenance et l'administration de la base.
 * Il fournit une infrastructure robuste pour évolution de schéma.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AddCriticalIndexesMigration } from './migrations/add-critical-indexes.migration';
import { DatabaseMigrationService } from './database-migration.service';

/**
 * Module de base de données et migrations pour O'Ypunu
 * 
 * Ce module essentiel gère toute l'infrastructure de base de données
 * avec des capacités avancées de migration et maintenance :
 * 
 * ## Fonctionnalités principales :
 * 
 * ### 🔧 Gestion des migrations
 * - Système de migration versionné et transactionnel
 * - Migrations forward et rollback automatiques
 * - Validation d'intégrité pré/post migration
 * - Support des migrations de données et schéma
 * 
 * ### 📊 Configuration de base de données
 * - Connexion MongoDB avec pool optimisé
 * - Configuration adaptative dev/prod
 * - Gestion des erreurs de connexion
 * - Monitoring de performance
 * 
 * ### 🛠️ Services utilitaires
 * - Outils d'administration et maintenance
 * - Backup et restauration automatisés
 * - Nettoyage et optimisation
 * - Statistiques et métriques DB
 * 
 * ### 🔍 Index et performance
 * - Création d'index critiques automatisée
 * - Optimisation des requêtes fréquentes
 * - Monitoring des performances
 * - Analyse et recommandations
 * 
 * @module DatabaseModule
 * @version 1.0.0
 */
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/oypunu'),
  ],
  providers: [
    AddCriticalIndexesMigration,
    DatabaseMigrationService,
  ],
  exports: [
    DatabaseMigrationService,
    AddCriticalIndexesMigration,
  ],
})
export class DatabaseModule {}