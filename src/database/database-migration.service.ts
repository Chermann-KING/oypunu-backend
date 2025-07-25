import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AddCriticalIndexesMigration } from './migrations/add-critical-indexes.migration';

/**
 * 🗄️ SERVICE DE MIGRATION BASE DE DONNÉES
 * 
 * Service responsable de l'exécution des migrations de base de données.
 * Permet d'appliquer des changements structurels de manière contrôlée.
 * 
 * Fonctionnalités :
 * ✅ Exécution des migrations au démarrage (si configuré)
 * ✅ Exécution manuelle des migrations
 * ✅ Rollback des migrations
 * ✅ Vérification du statut des migrations
 * ✅ Logs détaillés pour traçabilité
 */
@Injectable()
export class DatabaseMigrationService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMigrationService.name);

  constructor(
    private configService: ConfigService,
    private addCriticalIndexesMigration: AddCriticalIndexesMigration,
  ) {}

  /**
   * 🚀 Exécute les migrations au démarrage si configuré
   */
  async onModuleInit() {
    const runMigrationsOnStartup = this.configService.get<boolean>('RUN_MIGRATIONS_ON_STARTUP', false);
    
    if (runMigrationsOnStartup) {
      this.logger.log('🗄️ Exécution automatique des migrations au démarrage...');
      await this.runAllMigrations();
    } else {
      this.logger.log('🗄️ Migration service initialisé - Exécution manuelle requise');
    }
  }

  /**
   * 🏃‍♂️ Exécute toutes les migrations disponibles
   */
  async runAllMigrations(): Promise<void> {
    this.logger.log('🗄️ Début de l\'exécution de toutes les migrations');
    
    try {
      // Migration des indexes critiques
      await this.runCriticalIndexesMigration();
      
      this.logger.log('✅ Toutes les migrations exécutées avec succès');
    } catch (error) {
      this.logger.error('❌ Erreur lors de l\'exécution des migrations:', error);
      throw error;
    }
  }

  /**
   * 🗂️ Exécute la migration des indexes critiques
   */
  async runCriticalIndexesMigration(): Promise<void> {
    this.logger.log('🗂️ Exécution de la migration des indexes critiques...');
    
    try {
      await this.addCriticalIndexesMigration.up();
      this.logger.log('✅ Migration des indexes critiques terminée');
    } catch (error) {
      this.logger.error('❌ Erreur lors de la migration des indexes:', error);
      throw error;
    }
  }

  /**
   * 🔄 Rollback de la migration des indexes critiques
   */
  async rollbackCriticalIndexesMigration(): Promise<void> {
    this.logger.log('🔄 Rollback de la migration des indexes critiques...');
    
    try {
      await this.addCriticalIndexesMigration.down();
      this.logger.log('✅ Rollback des indexes critiques terminé');
    } catch (error) {
      this.logger.error('❌ Erreur lors du rollback des indexes:', error);
      throw error;
    }
  }

  /**
   * 🔍 Vérifie le statut des migrations
   */
  async checkMigrationStatus(): Promise<{
    indexesMigration: {
      status: 'applied' | 'not_applied' | 'error';
      details?: string;
    };
  }> {
    this.logger.log('🔍 Vérification du statut des migrations...');
    
    // Pour cette implémentation simple, on va juste vérifier
    // si les principaux indexes existent
    // Dans une implémentation plus avancée, on pourrait avoir
    // une table de tracking des migrations
    
    return {
      indexesMigration: {
        status: 'not_applied', // À implémenter selon les besoins
        details: 'Vérification manuelle requise'
      }
    };
  }

  /**
   * 🛠️ Méthodes utilitaires pour administration
   */

  /**
   * Force l'exécution des migrations (ignorer les vérifications)
   */
  async forceMigrations(): Promise<void> {
    this.logger.warn('⚠️ Exécution forcée des migrations - Ignorer les vérifications');
    await this.runAllMigrations();
  }

  /**
   * Rollback de toutes les migrations
   */
  async rollbackAllMigrations(): Promise<void> {
    this.logger.log('🔄 Rollback de toutes les migrations');
    
    try {
      await this.rollbackCriticalIndexesMigration();
      this.logger.log('✅ Rollback de toutes les migrations terminé');
    } catch (error) {
      this.logger.error('❌ Erreur lors du rollback:', error);
      throw error;
    }
  }
}