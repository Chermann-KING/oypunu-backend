#!/usr/bin/env node

/**
 * @fileoverview CLI de migration de base de données pour O'Ypunu
 * 
 * Script en ligne de commande professionnel pour la gestion complète
 * des migrations de base de données MongoDB. Inclut la création d'index,
 * les rollbacks sécurisés, le suivi des statuts et l'exécution forcée
 * avec gestion d'erreurs robuste et logging détaillé.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 * 
 * ## Usage:
 * ```bash
 * npm run migrate:up         # Exécuter toutes les migrations
 * npm run migrate:indexes    # Exécuter seulement la migration des indexes
 * npm run migrate:down       # Rollback toutes les migrations
 * npm run migrate:status     # Vérifier le statut des migrations
 * npm run migrate:force      # Forcer l'exécution des migrations
 * ```
 * 
 * ## Variables d'environnement requises:
 * - `MONGODB_URI` - URI de connexion MongoDB
 * - `NODE_ENV` - Environnement d'exécution (development/production)
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { DatabaseMigrationService } from '../database/database-migration.service';

/**
 * Fonction principale d'initialisation et d'exécution du CLI
 * 
 * Cette fonction initialise l'application NestJS en mode silencieux,
 * analyse les arguments de ligne de commande et exécute la migration
 * appropriée avec gestion d'erreurs complète.
 * 
 * @async
 * @function bootstrap
 * @throws {Error} En cas d'échec de migration ou configuration invalide
 */
async function bootstrap() {
  const logger = new Logger('MigrationCLI');
  
  // Supprimer les logs de démarrage de NestJS pour garder une sortie propre
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  const migrationService = app.get(DatabaseMigrationService);
  const command = process.argv[2];

  try {
    switch (command) {
      case 'up':
      case '--up':
        logger.log('🚀 Exécution de toutes les migrations...');
        await migrationService.runAllMigrations();
        logger.log('✅ Toutes les migrations exécutées avec succès');
        break;

      case 'indexes':
      case '--indexes':
        logger.log('🗂️ Exécution de la migration des indexes...');
        await migrationService.runCriticalIndexesMigration();
        logger.log('✅ Migration des indexes exécutée avec succès');
        break;

      case 'down':
      case '--down':
        logger.log('🔄 Rollback de toutes les migrations...');
        await migrationService.rollbackAllMigrations();
        logger.log('✅ Rollback terminé avec succès');
        break;

      case 'status':
      case '--status':
        logger.log('🔍 Vérification du statut des migrations...');
        const status = await migrationService.checkMigrationStatus();
        console.log('📊 Statut des migrations:');
        console.log(JSON.stringify(status, null, 2));
        break;

      case 'force':
      case '--force':
        logger.warn('⚠️ Exécution forcée des migrations...');
        await migrationService.forceMigrations();
        logger.log('✅ Migrations forcées exécutées avec succès');
        break;

      default:
        logger.log('📖 Usage du CLI de migration:');
        logger.log('');
        logger.log('  npm run migrate:up      - Exécuter toutes les migrations');
        logger.log('  npm run migrate:indexes - Exécuter la migration des indexes');
        logger.log('  npm run migrate:down    - Rollback toutes les migrations');
        logger.log('  npm run migrate:status  - Vérifier le statut des migrations');
        logger.log('  npm run migrate:force   - Forcer l\'exécution des migrations');
        logger.log('');
        logger.log('💡 Assurez-vous que MONGODB_URI est configuré dans vos variables d\'environnement');
        process.exit(1);
    }
  } catch (error) {
    logger.error('❌ Erreur lors de l\'exécution de la migration:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Gérer les signaux d'interruption proprement
process.on('SIGINT', () => {
  console.log('\n⚠️ Migration interrompue par l\'utilisateur');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Migration interrompue par le système');
  process.exit(1);
});

bootstrap();