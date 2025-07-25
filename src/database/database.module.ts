import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AddCriticalIndexesMigration } from './migrations/add-critical-indexes.migration';
import { DatabaseMigrationService } from './database-migration.service';

/**
 * 🗄️ MODULE DATABASE
 * 
 * Module dédié à la gestion de la base de données et des migrations.
 * Centralise toutes les opérations liées à la structure de la base de données.
 * 
 * Responsabilités :
 * ✅ Gestion des migrations
 * ✅ Configuration de la base de données
 * ✅ Services utilitaires pour la DB
 * ✅ Outils d'administration
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