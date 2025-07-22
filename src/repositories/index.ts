/**
 * 📦 INDEX PRINCIPAL DES REPOSITORIES
 * 
 * Export centralisé de tous les éléments du système de repositories :
 * - Interfaces abstraites (contrats)
 * - Implémentations concrètes (Mongoose)
 * - Module NestJS avec providers configurés
 */

// Interfaces (contrats abstraits)
export * from './interfaces';

// Implémentations concrètes
export * from './implementations';

// Module NestJS
export { RepositoriesModule } from './repositories.module';