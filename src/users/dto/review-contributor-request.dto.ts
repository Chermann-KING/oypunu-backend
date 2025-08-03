/**
 * @fileoverview DTOs pour la révision et gestion des demandes de contribution O'Ypunu
 * 
 * Ce fichier définit les structures de données pour la révision administrative
 * des demandes de contribution avec évaluation détaillée, actions en lot et
 * filtres avancés pour une gestion efficace du workflow de modération.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsArray,
  IsBoolean,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ContributorRequestStatus,
  ContributorRequestPriority,
} from '../schemas/contributor-request.schema';

/**
 * DTO pour la révision complète d'une demande de contribution
 * 
 * Structure de données pour l'évaluation administrative détaillée des candidatures
 * avec scoring, critères multiples et feedback constructif pour les candidats.
 * 
 * ## ⚖️ Décision administrative :
 * - **Statut** : Approbation/rejet/révision supplémentaire
 * - **Justification** : Notes détaillées pour traçabilité
 * - **Scoring** : Évaluation quantitative 0-100
 * 
 * ## 📊 Évaluation multicritères :
 * - **Compétences** : Assessment par domaine technique
 * - **Critères qualitatifs** : Points d'évaluation textuels
 * - **Flags spéciaux** : Priorité haute, révision spéciale
 * 
 * @class ReviewContributorRequestDto
 * @version 1.0.0
 */
export class ReviewContributorRequestDto {
  @ApiProperty({
    description: 'Action à effectuer sur la demande',
    enum: ContributorRequestStatus,
    example: ContributorRequestStatus.APPROVED,
  })
  @IsEnum(ContributorRequestStatus)
  status: ContributorRequestStatus;

  @ApiPropertyOptional({
    description: "Notes de révision de l'administrateur",
    example:
      'Candidat très motivé avec une excellente expérience linguistique.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNotes?: string;

  @ApiPropertyOptional({
    description: 'Raison du rejet (requis si status = rejected)',
    example:
      'Expérience linguistique insuffisante pour le rôle de contributeur.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;

  @ApiPropertyOptional({
    description: "Score d'évaluation (0-100)",
    example: 85,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  evaluationScore?: number;

  @ApiPropertyOptional({
    description: "Critères d'évaluation",
    example: [
      'Motivation excellente',
      'Expérience pertinente',
      'Engagement communautaire',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evaluationCriteria?: string[];

  @ApiPropertyOptional({
    description: 'Évaluation des compétences par domaine',
    example: { linguistique: 90, communication: 85, technique: 70 },
  })
  @IsOptional()
  @IsObject()
  skillsAssessment?: Record<string, number>;

  @ApiPropertyOptional({
    description: 'Marquer comme priorité élevée',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isHighPriority?: boolean;

  @ApiPropertyOptional({
    description: 'Nécessite une révision spéciale',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  requiresSpecialReview?: boolean;
}

/**
 * DTO pour la mise à jour de priorité des demandes
 * 
 * Structure simple pour modifier la priorité de traitement d'une demande
 * avec justification obligatoire pour traçabilité des actions administratives.
 * 
 * @class UpdateContributorRequestPriorityDto
 * @version 1.0.0
 */
export class UpdateContributorRequestPriorityDto {
  @ApiProperty({
    description: 'Nouvelle priorité de la demande',
    enum: ContributorRequestPriority,
    example: ContributorRequestPriority.HIGH,
  })
  @IsEnum(ContributorRequestPriority)
  priority: ContributorRequestPriority;

  @ApiPropertyOptional({
    description: 'Raison du changement de priorité',
    example: "Candidat recommandé par un membre de l'équipe",
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

/**
 * DTO pour les actions en lot sur les demandes
 * 
 * Structure pour traiter plusieurs demandes simultanément avec la même action,
 * optimisant l'efficacité administrative et la cohérence des décisions.
 * 
 * @class BulkActionDto  
 * @version 1.0.0
 */
export class BulkActionDto {
  @ApiProperty({
    description: 'IDs des demandes à traiter',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  })
  @IsArray()
  @IsString({ each: true })
  requestIds: string[];

  @ApiProperty({
    description: 'Action à effectuer',
    enum: ContributorRequestStatus,
    example: ContributorRequestStatus.UNDER_REVIEW,
  })
  @IsEnum(ContributorRequestStatus)
  action: ContributorRequestStatus;

  @ApiPropertyOptional({
    description: "Notes pour l'action groupée",
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

/**
 * DTO pour le filtrage avancé des demandes de contribution
 * 
 * Structure complète de filtres pour la recherche et navigation optimisée
 * dans les demandes avec critères multiples et options temporelles.
 * 
 * ## 🔍 Filtres disponibles :
 * - **Statut et priorité** : Filtrage par état et urgence
 * - **Recherche textuelle** : Recherche dans contenu des demandes
 * - **Filtres administratifs** : Par reviewer, flags spéciaux
 * - **Filtres temporels** : Âge des demandes, expiration
 * 
 * @class ContributorRequestFiltersDto
 * @version 1.0.0
 */
export class ContributorRequestFiltersDto {
  @ApiPropertyOptional({
    description: 'Filtrer par statut',
    enum: ContributorRequestStatus,
  })
  @IsOptional()
  @IsEnum(ContributorRequestStatus)
  status?: ContributorRequestStatus;

  @ApiPropertyOptional({
    description: 'Filtrer par priorité',
    enum: ContributorRequestPriority,
  })
  @IsOptional()
  @IsEnum(ContributorRequestPriority)
  priority?: ContributorRequestPriority;

  @ApiPropertyOptional({
    description: 'Recherche textuelle',
    example: 'linguistique',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par reviewer',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  reviewedBy?: string;

  @ApiPropertyOptional({
    description: 'Afficher seulement les priorités élevées',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  highPriorityOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Afficher seulement celles nécessitant une révision spéciale',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  specialReviewOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Nombre de jours depuis la création (max)',
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  maxDaysOld?: number;

  @ApiPropertyOptional({
    description: 'Afficher seulement celles expirant bientôt',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  expiringSoon?: boolean;
}
