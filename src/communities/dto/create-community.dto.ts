/**
 * @fileoverview DTO pour la création de communautés linguistiques O'Ypunu
 *
 * Ce DTO gère la validation et documentation des données nécessaires
 * pour créer une nouvelle communauté linguistique sur la plateforme.
 * Il inclut validation stricte des champs requis et gestion des
 * métadonnées optionnelles pour une configuration flexible.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO pour la création d'une communauté linguistique
 *
 * Cette classe définit la structure et validation des données nécessaires
 * pour créer une nouvelle communauté sur O'Ypunu. Les communautés permettent
 * aux utilisateurs de se regrouper par langue et de collaborer sur le
 * développement du dictionnaire multilingue.
 *
 * ## 🌍 Concept des communautés :
 * - **Collaboration linguistique** : Regroupement par langue native
 * - **Gouvernance décentralisée** : Chaque communauté a ses modérateurs
 * - **Contenu ciblé** : Discussions et contributions dans la langue
 * - **Visibilité contrôlée** : Communautés publiques ou privées
 *
 * @class CreateCommunityDto
 * @version 1.0.0
 */
export class CreateCommunityDto {
  /**
   * Nom unique de la communauté linguistique
   * 
   * @property {string} name - Nom identifiant de la communauté
   * @example "Communauté Française"
   */
  @ApiProperty({ 
    description: 'Nom unique de la communauté linguistique',
    example: 'Communauté Française',
    minLength: 3,
    maxLength: 100
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Code ISO de la langue principale de la communauté
   * 
   * @property {string} language - Code langue ISO 639-1
   * @example "fr"
   */
  @ApiProperty({ 
    description: 'Code ISO de la langue principale (ISO 639-1)',
    example: 'fr',
    pattern: '^[a-z]{2}$',
    minLength: 2,
    maxLength: 2
  })
  @IsString()
  @IsNotEmpty()
  language: string;

  /**
   * Description optionnelle détaillée de la communauté
   * 
   * @property {string} [description] - Texte descriptif de présentation
   * @example "Communauté dédiée à l'enrichissement du dictionnaire français avec des expressions régionales et du vocabulaire moderne."
   */
  @ApiPropertyOptional({ 
    description: 'Description détaillée de la communauté et ses objectifs',
    example: 'Communauté dédiée à l\'enrichissement du dictionnaire français avec des expressions régionales et du vocabulaire moderne.',
    maxLength: 1000
  })
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Mots-clés et tags d'identification de la communauté
   * 
   * @property {string[]} [tags] - Tableau de mots-clés descriptifs
   * @example ["français", "france", "francophonie", "dictionnaire"]
   */
  @ApiPropertyOptional({ 
    description: 'Mots-clés et tags pour faciliter la découverte de la communauté',
    example: ['français', 'france', 'francophonie', 'dictionnaire'],
    type: [String],
    maxItems: 10
  })
  @IsArray()
  @IsOptional()
  tags?: string[];

  /**
   * Mode de visibilité de la communauté
   * 
   * @property {boolean} [isPrivate=false] - True pour communauté privée
   * @default false
   */
  @ApiPropertyOptional({ 
    description: 'Détermine si la communauté est privée (sur invitation) ou publique',
    example: false,
    default: false
  })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  /**
   * URL de l'image de couverture de la communauté
   * 
   * @property {string} [coverImage] - URL d'image de présentation
   * @example "https://images.oypunu.com/communities/french-cover.jpg"
   */
  @ApiPropertyOptional({ 
    description: 'URL de l\'image de couverture pour personnaliser l\'apparence de la communauté',
    example: 'https://images.oypunu.com/communities/french-cover.jpg',
    format: 'uri'
  })
  @IsString()
  @IsOptional()
  coverImage?: string;
}
