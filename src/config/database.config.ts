/**
 * @fileoverview Configuration de la base de données MongoDB pour O'Ypunu
 * 
 * Ce fichier centralise la configuration de connexion MongoDB avec
 * support des variables d'environnement et valeurs par défaut pour
 * le développement local. Il utilise le système de configuration
 * modulaire de NestJS pour une gestion propre et type-safe.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { registerAs } from '@nestjs/config';

/**
 * Configuration de base de données MongoDB
 * 
 * Enregistre la configuration sous la clé 'database' pour injection
 * dans les modules NestJS. Récupère l'URI depuis les variables
 * d'environnement avec fallback sur MongoDB local pour développement.
 * 
 * Variables d'environnement supportées :
 * - MONGODB_URI : URI complète de connexion MongoDB (production)
 * 
 * @function databaseConfig
 * @returns {Object} Configuration base de données
 * @property {string} uri - URI de connexion MongoDB
 * 
 * @example
 * ```typescript
 * // Dans un module NestJS
 * @Injectable()
 * export class DatabaseService {
 *   constructor(
 *     @Inject(databaseConfig.KEY) 
 *     private dbConfig: ConfigType<typeof databaseConfig>
 *   ) {
 *     console.log('MongoDB URI:', this.dbConfig.uri);
 *   }
 * }
 * ```
 * 
 * @example
 * ```bash
 * # Variables d'environnement
 * MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/oypunu?retryWrites=true&w=majority
 * ```
 */
export default registerAs('database', () => ({
  /** URI de connexion MongoDB avec fallback développement */
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/oypunu',
}));
