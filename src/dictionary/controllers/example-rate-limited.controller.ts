import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  UseGuards, 
  UseInterceptors,
  Request
} from '@nestjs/common';
import { 
  RateLimitGuard, 
  RateLimit, 
  EnforceQuota,
  QuotaIncrementInterceptor 
} from '../../common/guards/rate-limit.guard';
import { CreateWordDto } from '../dto/create-word.dto';
import { WordsService } from '../services/words.service';

/**
 * 📋 EXEMPLE D'UTILISATION DU SYSTÈME DE RATE LIMITING ET QUOTAS
 * 
 * Ce contrôleur démontre comment utiliser les nouvelles fonctionnalités :
 * - Rate limiting basé sur l'IP
 * - Quotas utilisateur
 * - Incrémentation automatique des compteurs
 * 
 * Ce fichier est un exemple et peut être supprimé en production.
 */
@Controller('example')
@UseGuards(RateLimitGuard)
@UseInterceptors(QuotaIncrementInterceptor)
export class ExampleRateLimitedController {
  constructor(private wordsService: WordsService) {}

  /**
   * 📝 Création de mot avec rate limiting et quota
   * 
   * Combine :
   * - Rate limiting pour les uploads (5 par minute par IP)
   * - Quota utilisateur pour création de mots (10/jour pour users normaux)
   * - Incrémentation automatique après succès
   */
  @Post('words')
  @RateLimit({ category: 'upload' })
  @EnforceQuota({ 
    action: 'dailyWordCreations', 
    increment: true,
    skipForRoles: ['admin'] // Les admins n'ont pas de limite
  })
  async createWord(
    @Body() createWordDto: CreateWordDto,
    @Request() req: any
  ) {
    // La vérification du rate limiting et quota est automatique
    // L'incrémentation se fait automatiquement après succès
    return await this.wordsService.create(createWordDto, req.user);
  }

  /**
   * 🔍 Recherche avec rate limiting API standard
   */
  @Get('search')
  @RateLimit({ category: 'api' }) // 100 requêtes/minute par IP
  async search() {
    // Endpoint de recherche avec protection contre le spam
    return { message: 'Résultats de recherche...' };
  }

  /**
   * 🚨 Endpoint sensible avec rate limiting strict
   */
  @Post('report')
  @RateLimit({ category: 'sensitive' }) // 10 requêtes/minute par IP
  @EnforceQuota({ 
    action: 'dailyReports', 
    increment: true 
  })
  async reportContent(@Request() req: any) {
    // Signalement avec limites strictes
    return { message: 'Signalement enregistré' };
  }

  /**
   * 🔐 Endpoint d'authentification avec protection forte
   */
  @Post('auth/login')
  @RateLimit({ category: 'auth' }) // 5 tentatives/15min par IP
  async login() {
    // Protection contre les attaques par force brute
    return { message: 'Connexion réussie' };
  }

  /**
   * 📊 Consultation des quotas utilisateur
   */
  @Get('quota-status')
  @RateLimit({ category: 'api' })
  async getQuotaStatus(@Request() req: any) {
    // Cet endpoint pourrait retourner les quotas de l'utilisateur
    // En utilisant quotaService.getUserQuotaStats()
    return { 
      message: 'Statut des quotas', 
      userId: req.user?._id 
    };
  }
}

/**
 * 💡 NOTES D'UTILISATION :
 * 
 * 1. **Rate Limiting par IP** :
 *    - 'auth': 5 requêtes/15min (protection brute force)
 *    - 'sensitive': 10 requêtes/min (modération, signalements)  
 *    - 'upload': 5 requêtes/min (uploads de fichiers)
 *    - 'api': 100 requêtes/min (endpoints généraux)
 * 
 * 2. **Quotas utilisateur** :
 *    - 'dailyWordCreations': 10/jour (user), 25/jour (contributor)
 *    - 'dailyWordUpdates': 20/jour (user), 50/jour (contributor) 
 *    - 'dailyReports': 5/jour (user), 10/jour (contributor)
 *    - 'hourlyUploads': 5/heure (user), 10/heure (contributor)
 * 
 * 3. **Gestion automatique** :
 *    - Les quotas sont vérifiés avant l'exécution
 *    - Les compteurs sont incrémentés après succès
 *    - Les erreurs retournent des détails précis
 * 
 * 4. **Personnalisation** :
 *    - skipForRoles: ignore certains rôles
 *    - keyGenerator: clé custom pour rate limiting
 *    - increment: false pour vérification sans incrémentation
 */