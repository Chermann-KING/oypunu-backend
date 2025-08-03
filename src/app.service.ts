/**
 * @fileoverview Service principal de l'application O'Ypunu
 * 
 * Ce service centralise la logique métier globale de l'application,
 * les utilitaires partagés et les opérations communes à tous les modules
 * pour maintenir une architecture cohérente et extensible.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable } from '@nestjs/common';

/**
 * Service principal de l'application O'Ypunu
 * 
 * Service central fournissant les fonctionnalités de base partagées
 * par tous les modules de l'application, les utilitaires globaux
 * et la logique métier transversale pour une architecture cohérente.
 * 
 * ## 🎯 Responsabilités principales :
 * 
 * ### 🏠 Messages d'accueil et information
 * - **Messages système** : Textes d'accueil et information générale
 * - **Branding** : Messages cohérents avec l'identité O'Ypunu
 * - **Localisation** : Support pour messages multilingues
 * 
 * ### 🔧 Utilitaires globaux
 * - **Configuration partagée** : Paramètres communs à tous les modules
 * - **Helpers transversaux** : Fonctions utilitaires réutilisables
 * - **Constants globales** : Valeurs partagées dans l'application
 * 
 * ### 📊 Métriques et monitoring
 * - **Statistiques globales** : Métriques de performance applicative
 * - **Health checks avancés** : Vérifications système étendues
 * - **Logging centralisé** : Gestion des logs transversaux
 * 
 * ## 🔄 Architecture modulaire
 * - **Injection de dépendances** : Service injectable par tous les modules
 * - **Extensibilité** : Base pour fonctionnalités futures
 * - **Maintenance** : Point central pour modifications globales
 * 
 * @class AppService
 * @version 1.0.0
 */
@Injectable()
export class AppService {
  /**
   * Retourne le message d'accueil de l'application O'Ypunu
   * 
   * Fournit un message de bienvenue personnalisé pour l'API,
   * utilisé dans les endpoints d'information et les réponses système.
   * 
   * @method getHello
   * @returns {string} Message de bienvenue localisé
   * 
   * @example
   * const message = appService.getHello();
   * console.log(message); // "Bienvenu sur le serveur de l'application O'Ypunu!"
   */
  getHello(): string {
    return "Bienvenu sur le serveur de l'application O'Ypunu!";
  }
}
