/**
 * @fileoverview Stratégie JWT principale pour l'authentification O'Ypunu
 * 
 * Cette stratégie implémente la validation des tokens JWT avec vérification
 * sécurisée du secret, validation des utilisateurs en base de données et
 * extraction des données d'authentification pour les endpoints protégés.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Inject, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { IUserRepository } from "../../repositories/interfaces/user.repository.interface";
import { JwtSecretValidatorService } from "../security/jwt-secret-validator.service";

/**
 * Stratégie JWT pour authentification des requêtes protégées
 * 
 * Cette stratégie Passport valide automatiquement les tokens JWT
 * sur tous les endpoints protégés et injecte les données utilisateur
 * dans le contexte de requête après validation complète.
 * 
 * ## 🔐 Sécurité JWT :
 * - **Validation du secret** : Vérification de la force du JWT_SECRET
 * - **Extraction Bearer** : Headers Authorization: Bearer <token>
 * - **Validation expiration** : Refus des tokens expirés
 * - **Vérification utilisateur** : Contrôle existence en base
 * 
 * ## 📊 Payload validé :
 * - **sub** : Identifiant utilisateur (claim standard)
 * - **Expiration** : Contrôle automatique par passport-jwt
 * - **Signature** : Vérification cryptographique
 * - **Données utilisateur** : Injection dans req.user
 * 
 * ## 🛡️ Contrôles de sécurité :
 * - Secret JWT validé au démarrage
 * - Utilisateur existant en base
 * - Payload JWT structurellement valide
 * - Gestion gracieuse des erreurs
 * 
 * @class JwtStrategy
 * @extends PassportStrategy
 * @version 1.0.0
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * Constructeur de la stratégie JWT
   * 
   * Initialise la stratégie avec validation sécurisée du secret JWT
   * et configuration des options d'extraction et de validation.
   * 
   * @constructor
   * @param {IUserRepository} userRepository - Repository des utilisateurs
   * @param {JwtSecretValidatorService} _jwtSecretValidator - Validateur de secret JWT
   * @param {ConfigService} configService - Service de configuration
   * @throws {Error} Si le JWT_SECRET ne respecte pas les critères de sécurité
   */
  constructor(
    @Inject("IUserRepository")
    private readonly userRepository: IUserRepository,
    private readonly _jwtSecretValidator: JwtSecretValidatorService,
    private readonly configService: ConfigService
  ) {
    const jwtSecret =
      process.env.JWT_SECRET || configService.get<string>("JWT_SECRET");

    // Valider le secret JWT avant de passer à la classe parente
    const validationResult = _jwtSecretValidator.validateJwtSecret(jwtSecret);

    if (!validationResult.isValid) {
      throw new Error(
        `JWT_SECRET validation failed: ${validationResult.errors.join(", ")}`
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Valide le payload JWT et retourne les données utilisateur
   * 
   * Méthode appelée automatiquement par Passport après décodage et validation
   * cryptographique du JWT. Vérifie l'existence de l'utilisateur en base
   * et retourne les données qui seront injectées dans req.user.
   * 
   * @async
   * @method validate
   * @param {any} payload - Payload décodé du JWT
   * @returns {Promise<Object>} Données utilisateur pour req.user
   * @throws {UnauthorizedException} Si payload invalide ou utilisateur inexistant
   */
  async validate(payload: any) {
    if (!payload.sub) {
      throw new UnauthorizedException("Invalid token payload");
    }

    const user = await this.userRepository.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // Retourner l'utilisateur qui sera attaché à req.user
    return {
      _id: user._id || (user as any).id,
      userId: user._id || (user as any).id,
      username: user.username,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    };
  }
}
