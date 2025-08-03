/**
 * @fileoverview Intercepteur de transformation des réponses API O'Ypunu
 *
 * Cet intercepteur normalise et standardise toutes les réponses HTTP de l'API
 * en appliquant un format cohérent avec données, métadonnées, statut et message.
 * Il assure une expérience développeur optimale avec des réponses prévisibles
 * et bien structurées pour le frontend et les intégrations tierces.
 *
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interface pour la structure standardisée des réponses API
 *
 * Cette interface définit le format unifié de toutes les réponses HTTP
 * de l'API O'Ypunu pour garantir la cohérence et la prévisibilité.
 *
 * @interface Response
 * @template T Type des données retournées
 * @version 1.0.0
 */
export interface Response<T> {
  /** Données principales de la réponse */
  data: T;
  
  /** Métadonnées optionnelles (pagination, filtres, etc.) */
  meta?: {
    /** Informations de pagination pour les listes */
    pagination?: {
      /** Page actuelle (base 1) */
      page: number;
      /** Nombre d'éléments par page */
      limit: number;
      /** Nombre total d'éléments */
      total: number;
      /** Nombre total de pages */
      totalPages: number;
    };
    /** Métadonnées additionnelles spécifiques au contexte */
    [key: string]: any;
  };
  
  /** Code de statut HTTP de la réponse */
  statusCode: number;
  
  /** Message de statut descriptif */
  message: string;
}

/**
 * Intercepteur de transformation des réponses pour standardisation API
 *
 * Cet intercepteur applique une structure de réponse unifiée à toutes les
 * routes de l'API O'Ypunu. Il intercepte les réponses avant envoi au client
 * et les encapsule dans un format standardisé avec données, métadonnées,
 * statut HTTP et message descriptif.
 *
 * ## 🌐 Avantages de la standardisation :
 *
 * ### Cohérence développeur
 * - Format prévisible pour toutes les réponses API
 * - Intégration simplifiée pour les clients (frontend, mobile, tiers)
 * - Documentation API automatiquement cohérente
 * - Débogage facilité avec structure uniforme
 *
 * ### Gestion des métadonnées intelligente
 * - Extraction automatique des métadonnées de pagination
 * - Préservation des données contextuelles
 * - Support des filtres et paramètres de requête
 * - Extensibilité pour nouvelles métadonnées
 *
 * ### Robustesse et sécurité
 * - Validation de type des données
 * - Gestion sécurisée des propriétés optionnelles
 * - Codes de statut HTTP préservés
 * - Messages d'erreur standardisés
 *
 * @class TransformInterceptor
 * @implements {NestInterceptor<T, Response<T>>}
 * @template T Type des données à transformer
 * @version 1.0.0
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  /**
   * Méthode principale d'interception et transformation
   *
   * Cette méthode intercepte chaque réponse HTTP avant qu'elle soit
   * envoyée au client et applique la transformation standardisée.
   * Elle préserve les codes de statut originaux et extrait intelligemment
   * les métadonnées quand disponibles.
   *
   * @method intercept
   * @param {ExecutionContext} context - Contexte d'exécution NestJS
   * @param {CallHandler} next - Gestionnaire de la chaîne d'exécution
   * @returns {Observable<Response<T>>} Réponse transformée standardisée
   *
   * @example
   * ```typescript
   * // Réponse d'origine :
   * { id: 1, name: "Test", meta: { pagination: { page: 1, total: 10 } } }
   *
   * // Réponse transformée :
   * {
   *   data: { id: 1, name: "Test" },
   *   meta: { pagination: { page: 1, total: 10 } },
   *   statusCode: 200,
   *   message: "Succès"
   * }
   * ```
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response: import('express').Response = ctx.getResponse();

    return next.handle().pipe(
      map((data: T) => {
        // Extraire les métadonnées si présentes dans les données
        let extractedMeta: any = undefined;
        let cleanData: T = data;

        // Vérification sécurisée de l'existence de métadonnées
        if (typeof data === 'object' && data !== null && 'meta' in data) {
          const dataWithMeta = data as { meta?: any; [key: string]: any };
          extractedMeta = dataWithMeta.meta;
          
          // Nettoyer les données en excluant les métadonnées
          if (extractedMeta !== undefined) {
            const { meta, ...restData } = dataWithMeta;
            cleanData = restData as T;
          }
        }

        // Construire la réponse standardisée
        return {
          data: cleanData,
          meta: extractedMeta,
          statusCode: response.statusCode,
          message: this.getStatusMessage(response.statusCode),
        };
      }),
    );
  }

  /**
   * Générer un message descriptif basé sur le code de statut HTTP
   *
   * @private
   * @method getStatusMessage
   * @param {number} statusCode - Code de statut HTTP
   * @returns {string} Message descriptif localisé
   */
  private getStatusMessage(statusCode: number): string {
    const statusMessages: Record<number, string> = {
      200: 'Succès',
      201: 'Créé avec succès',
      202: 'Accepté pour traitement',
      204: 'Succès, aucun contenu',
      400: 'Requête invalide',
      401: 'Non autorisé',
      403: 'Accès interdit',
      404: 'Ressource non trouvée',
      409: 'Conflit de données',
      422: 'Données non valides',
      500: 'Erreur serveur interne',
    };

    return statusMessages[statusCode] || 'Opération terminée';
  }
}