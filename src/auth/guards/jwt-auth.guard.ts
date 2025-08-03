/**
 * @fileoverview Guard d'authentification JWT pour O'Ypunu
 * 
 * Ce guard utilise la stratégie JWT Passport pour valider les tokens
 * d'accès sur les endpoints protégés. Il vérifie automatiquement
 * la signature, l'expiration et l'intégrité des tokens JWT.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard d'authentification JWT pour la protection des endpoints
 * 
 * Ce guard étend AuthGuard de Passport avec la stratégie 'jwt' pour
 * fournir une authentification automatique basée sur les tokens JWT.
 * Il vérifie la validité, l'intégrité et l'expiration des tokens
 * dans l'en-tête Authorization des requêtes HTTP.
 * 
 * ## Utilisation :
 * 
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Get('protected')
 * async getProtectedResource(@Request() req) {
 *   // req.user contient les données extraites du JWT
 *   return { userId: req.user.id, role: req.user.role };
 * }
 * ```
 * 
 * ## Fonctionnement :
 * 1. Extrait le token de l'en-tête Authorization: Bearer <token>
 * 2. Valide la signature avec la clé secrète JWT_SECRET
 * 3. Vérifie l'expiration du token
 * 4. Décode les données utilisateur et les inject dans req.user
 * 5. Autorise ou refuse l'accès selon la validité
 * 
 * @class JwtAuthGuard
 * @extends AuthGuard
 * @version 1.0.0
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
