import { Controller, Post, Get, Delete, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../auth/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DatabaseMigrationService } from '../../database/database-migration.service';

/**
 * 🗄️ CONTRÔLEUR MIGRATION BASE DE DONNÉES
 * 
 * Contrôleur d'administration pour la gestion des migrations de base de données.
 * Réservé aux super-administrateurs pour des raisons de sécurité.
 * 
 * Endpoints disponibles :
 * ✅ POST /admin/database/migrate - Exécuter toutes les migrations
 * ✅ POST /admin/database/migrate/indexes - Exécuter migration des indexes
 * ✅ DELETE /admin/database/migrate/indexes - Rollback migration des indexes
 * ✅ GET /admin/database/migrate/status - Vérifier statut des migrations
 */
@ApiTags('Administration - Database Migration')
@Controller('admin/database')
@UseGuards(JwtAuthGuard, RoleGuard)
@ApiBearerAuth()
export class DatabaseMigrationController {
  constructor(private databaseMigrationService: DatabaseMigrationService) {}

  @Post('migrate')
  @Roles('superadmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exécuter toutes les migrations de base de données' })
  @ApiResponse({
    status: 200,
    description: 'Migrations exécutées avec succès',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        timestamp: { type: 'string' },
        migrationsExecuted: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Erreur lors de l\'exécution des migrations'
  })
  async runAllMigrations() {
    const startTime = new Date();
    
    await this.databaseMigrationService.runAllMigrations();
    
    return {
      message: 'Toutes les migrations ont été exécutées avec succès',
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime.getTime(),
      migrationsExecuted: [
        'critical-indexes-migration'
      ]
    };
  }

  @Post('migrate/indexes')
  @Roles('superadmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exécuter la migration des indexes critiques' })
  @ApiResponse({
    status: 200,
    description: 'Migration des indexes exécutée avec succès'
  })
  async runIndexesMigration() {
    const startTime = new Date();
    
    await this.databaseMigrationService.runCriticalIndexesMigration();
    
    return {
      message: 'Migration des indexes critiques exécutée avec succès',
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime.getTime(),
      indexesCreated: [
        'Users: email, username, role, isEmailVerified',
        'Words: word, status, language, category, compound indexes',
        'Communities: language, name, createdBy, membersCount',
        'Messages: conversation+timestamp, sender, readBy',
        'ActivityFeed: user+timestamp, type, type+timestamp',
        'RefreshTokens: token, user, TTL expiration'
      ]
    };
  }

  @Delete('migrate/indexes')
  @Roles('superadmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rollback de la migration des indexes critiques' })
  @ApiResponse({
    status: 200,
    description: 'Rollback de la migration des indexes exécuté avec succès'
  })
  async rollbackIndexesMigration() {
    const startTime = new Date();
    
    await this.databaseMigrationService.rollbackCriticalIndexesMigration();
    
    return {
      message: 'Rollback de la migration des indexes exécuté avec succès',
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime.getTime(),
      indexesRemoved: [
        'Tous les indexes créés par la migration ont été supprimés'
      ]
    };
  }

  @Get('migrate/status')
  @Roles('admin', 'superadmin')
  @ApiOperation({ summary: 'Vérifier le statut des migrations' })
  @ApiResponse({
    status: 200,
    description: 'Statut des migrations récupéré avec succès'
  })
  async getMigrationStatus() {
    const status = await this.databaseMigrationService.checkMigrationStatus();
    
    return {
      message: 'Statut des migrations récupéré avec succès',
      timestamp: new Date().toISOString(),
      migrations: status
    };
  }

  @Post('migrate/force')
  @Roles('superadmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Forcer l\'exécution des migrations (ignorer les vérifications)',
    description: '⚠️ ATTENTION: Cette opération force l\'exécution même si des erreurs sont détectées'
  })
  @ApiResponse({
    status: 200,
    description: 'Migrations forcées exécutées avec succès'
  })
  async forceMigrations() {
    const startTime = new Date();
    
    await this.databaseMigrationService.forceMigrations();
    
    return {
      message: '⚠️ Migrations forcées exécutées avec succès',
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime.getTime(),
      warning: 'Cette opération a ignoré les vérifications de sécurité'
    };
  }

  @Delete('migrate/all')
  @Roles('superadmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Rollback de toutes les migrations',
    description: '⚠️ ATTENTION: Cette opération supprime tous les indexes créés par les migrations'
  })
  @ApiResponse({
    status: 200,
    description: 'Rollback de toutes les migrations exécuté avec succès'
  })
  async rollbackAllMigrations() {
    const startTime = new Date();
    
    await this.databaseMigrationService.rollbackAllMigrations();
    
    return {
      message: '⚠️ Rollback de toutes les migrations exécuté avec succès',
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime.getTime(),
      warning: 'Tous les indexes créés par les migrations ont été supprimés'
    };
  }
}