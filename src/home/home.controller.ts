/**
 * @fileoverview Contrôleur pour la page d'accueil O'Ypunu
 * 
 * Ce contrôleur gère les endpoints pour la page d'accueil avec
 * mots vedettes, statistiques du dictionnaire et données
 * de présentation pour l'interface utilisateur principale.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HomeService, FeaturedWord } from './home.service';

/**
 * Contrôleur pour la page d'accueil O'Ypunu
 * 
 * Fournit les endpoints pour alimenter la page d'accueil avec
 * contenu dynamique, mots vedettes et statistiques globales
 * du dictionnaire pour engagement utilisateur optimal.
 * 
 * @class HomeController
 * @version 1.0.0
 */
@ApiTags('home')
@Controller('home')
export class HomeController {
  /**
   * Constructeur avec injection du service
   * 
   * @constructor
   * @param {HomeService} _homeService - Service de la page d'accueil
   */
  constructor(private readonly _homeService: HomeService) {}

  /**
   * Récupère les mots vedettes pour la page d'accueil
   * 
   * @async
   * @method getFeaturedWords
   * @returns {Promise<FeaturedWord[]>} Liste des mots vedettes
   * 
   * @example
   * ```bash
   * GET /home/featured-words
   * ```
   */
  @Get('featured-words')
  @ApiOperation({ summary: 'Récupérer les mots vedettes' })
  @ApiResponse({ status: 200, description: 'Mots vedettes récupérés avec succès' })
  async getFeaturedWords(): Promise<FeaturedWord[]> {
    return this._homeService.getFeaturedWords();
  }

  /**
   * Récupère les statistiques globales du dictionnaire
   * 
   * @async
   * @method getStatistics
   * @returns {Promise<Object>} Statistiques globales
   * 
   * @example
   * ```bash
   * GET /home/statistics
   * ```
   */
  @Get('statistics')
  @ApiOperation({ summary: 'Récupérer les statistiques globales' })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
  async getStatistics() {
    return this._homeService.getStatistics();
  }
}
