#!/usr/bin/env node

/**
 * 🔐 CLI JWT SECURITY TOOL
 * 
 * Outil en ligne de commande pour la gestion de la sécurité des secrets JWT.
 * Permet la validation, génération et audit des secrets JWT en local.
 * 
 * Usage:
 *   npm run jwt:validate [secret]  - Valider un secret JWT
 *   npm run jwt:generate [length]  - Générer un secret sécurisé
 *   npm run jwt:audit              - Auditer le secret actuel
 *   npm run jwt:check              - Vérifier la configuration
 * 
 * Variables d'environnement:
 *   JWT_SECRET - Secret JWT à auditer (optionnel pour génération)
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { JwtSecretValidatorService } from '../auth/security/jwt-secret-validator.service';

async function bootstrap() {
  const logger = new Logger('JWTSecurityCLI');
  
  // Créer l'application NestJS en mode silencieux
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  const jwtValidator = app.get(JwtSecretValidatorService);
  const command = process.argv[2];
  const argument = process.argv[3];

  try {
    switch (command) {
      case 'validate':
      case '--validate':
        await validateSecret(jwtValidator, argument, logger);
        break;

      case 'generate':
      case '--generate':
        await generateSecret(jwtValidator, argument, logger);
        break;

      case 'audit':
      case '--audit':
        await auditCurrentSecret(jwtValidator, logger);
        break;

      case 'check':
      case '--check':
        await checkConfiguration(logger);
        break;

      default:
        showUsage(logger);
        process.exit(1);
    }
  } catch (error) {
    logger.error('❌ Erreur:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await app.close();
  }
}

/**
 * 🔍 Valide un secret JWT fourni
 */
async function validateSecret(
  validator: JwtSecretValidatorService, 
  secret: string, 
  logger: Logger
): Promise<void> {
  if (!secret) {
    logger.error('❌ Secret JWT requis pour validation');
    logger.log('💡 Usage: npm run jwt:validate "votre-secret-jwt"');
    return;
  }

  logger.log('🔍 Validation du secret JWT...');
  const result = validator.validateJwtSecret(secret);

  // Afficher les résultats
  console.log('\n📊 RÉSULTATS DE VALIDATION:');
  console.log('═'.repeat(50));
  
  console.log(`✨ Statut: ${result.isValid ? '✅ VALIDE' : '❌ INVALIDE'}`);
  console.log(`💪 Force: ${getStrengthEmoji(result.strength)} ${result.strength.toUpperCase()}`);
  console.log(`📈 Score: ${result.score}/100`);
  console.log(`🎲 Entropie: ${result.entropy.toFixed(2)} bits/caractère`);

  if (result.errors.length > 0) {
    console.log('\n🚨 ERREURS:');
    result.errors.forEach(error => console.log(`  ❌ ${error}`));
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️  AVERTISSEMENTS:');
    result.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
  }

  if (result.recommendations.length > 0) {
    console.log('\n💡 RECOMMANDATIONS:');
    result.recommendations.forEach(rec => console.log(`  ${rec}`));
  }

  console.log('═'.repeat(50));
}

/**
 * 🎲 Génère un nouveau secret sécurisé
 */
async function generateSecret(
  validator: JwtSecretValidatorService,
  lengthStr: string,
  logger: Logger
): Promise<void> {
  const length = lengthStr ? parseInt(lengthStr, 10) : 64;

  if (isNaN(length) || length < 32 || length > 128) {
    logger.error('❌ Longueur invalide. Doit être entre 32 et 128 caractères.');
    return;
  }

  logger.log(`🎲 Génération d'un secret JWT sécurisé (${length} caractères)...`);
  
  const secret = validator.generateSecureSecret(length);
  const validation = validator.validateJwtSecret(secret);

  console.log('\n🔐 NOUVEAU SECRET JWT GÉNÉRÉ:');
  console.log('═'.repeat(80));
  console.log(`Secret: ${secret}`);
  console.log('═'.repeat(80));

  console.log('\n📊 VALIDATION DU SECRET GÉNÉRÉ:');
  console.log(`✨ Force: ${getStrengthEmoji(validation.strength)} ${validation.strength.toUpperCase()}`);
  console.log(`📈 Score: ${validation.score}/100`);
  console.log(`🎲 Entropie: ${validation.entropy.toFixed(2)} bits/caractère`);

  console.log('\n🛠️  CONFIGURATION:');
  console.log('Environmental variable:');
  console.log(`  JWT_SECRET=${secret}`);
  console.log('\nDocker Compose:');
  console.log(`  environment:`);
  console.log(`    - JWT_SECRET=${secret}`);
  console.log('\nKubernetes Secret:');
  console.log(`  data:`);
  console.log(`    JWT_SECRET: "${secret}"`);

  console.log('\n⚠️  IMPORTANT:');
  console.log('• Stockez ce secret de manière sécurisée');
  console.log('• Ne le partagez jamais dans le code source');
  console.log('• Implémentez une rotation régulière');
  console.log('• Sauvegardez-le dans un gestionnaire de secrets');
}

/**
 * 🔍 Audite le secret JWT actuellement configuré
 */
async function auditCurrentSecret(
  validator: JwtSecretValidatorService,
  logger: Logger
): Promise<void> {
  logger.log('🔍 Audit du secret JWT actuel...');

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.log('\n🚨 CONFIGURATION MANQUANTE:');
    console.log('═'.repeat(50));
    console.log('❌ JWT_SECRET n\'est pas configuré');
    console.log('\n💡 ACTIONS REQUISES:');
    console.log('• Configurer JWT_SECRET dans les variables d\'environnement');
    console.log('• Générer un secret sécurisé: npm run jwt:generate');
    console.log('• Redémarrer l\'application');
    return;
  }

  const validation = validator.validateJwtSecret(jwtSecret);

  console.log('\n🔍 AUDIT DU SECRET JWT ACTUEL:');
  console.log('═'.repeat(50));
  console.log(`✨ Statut: ${validation.isValid ? '✅ VALIDE' : '❌ INVALIDE'}`);
  console.log(`💪 Force: ${getStrengthEmoji(validation.strength)} ${validation.strength.toUpperCase()}`);
  console.log(`📈 Score: ${validation.score}/100`);
  console.log(`🎲 Entropie: ${validation.entropy.toFixed(2)} bits/caractère`);
  console.log(`📏 Longueur: ${jwtSecret.length} caractères`);

  if (validation.errors.length > 0) {
    console.log('\n🚨 PROBLÈMES CRITIQUES:');
    validation.errors.forEach(error => console.log(`  ❌ ${error}`));
  }

  if (validation.warnings.length > 0) {
    console.log('\n⚠️  AVERTISSEMENTS:');
    validation.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
  }

  if (validation.recommendations.length > 0) {
    console.log('\n💡 RECOMMANDATIONS:');
    validation.recommendations.forEach(rec => console.log(`  ${rec}`));
  }

  // Recommandations basées sur le score
  if (validation.score < 60) {
    console.log('\n🔄 ACTION RECOMMANDÉE:');
    console.log('  Générer un nouveau secret: npm run jwt:generate');
  }

  console.log('═'.repeat(50));
}

/**
 * ✅ Vérifie la configuration générale
 */
async function checkConfiguration(logger: Logger): Promise<void> {
  logger.log('🔍 Vérification de la configuration JWT...');

  const jwtSecret = process.env.JWT_SECRET;
  const nodeEnv = process.env.NODE_ENV;

  console.log('\n🛠️  CONFIGURATION ENVIRONMENT:');
  console.log('═'.repeat(50));
  console.log(`🌍 NODE_ENV: ${nodeEnv || 'non défini'}`);
  console.log(`🔐 JWT_SECRET: ${jwtSecret ? '✅ Configuré' : '❌ Manquant'}`);

  if (jwtSecret) {
    console.log(`📏 Longueur: ${jwtSecret.length} caractères`);
    
    // Test rapide sans révéler le secret
    const isWeak = jwtSecret === 'secret' || jwtSecret === 'your-256-bit-secret';
    if (isWeak) {
      console.log('⚠️  WARNING: Secret faible détecté');
    }
  }

  console.log('\n🔧 OUTILS DISPONIBLES:');
  console.log('• npm run jwt:validate "secret" - Valider un secret');
  console.log('• npm run jwt:generate 64      - Générer un secret');
  console.log('• npm run jwt:audit            - Auditer le secret actuel');

  console.log('═'.repeat(50));
}

/**
 * 📖 Affiche l'aide d'utilisation
 */
function showUsage(logger: Logger): void {
  logger.log('📖 JWT Security CLI - Outil de gestion sécurité JWT');
  console.log('\n🛠️  COMMANDES DISPONIBLES:');
  console.log('');
  console.log('  npm run jwt:validate "secret"  - Valider un secret JWT');
  console.log('  npm run jwt:generate [length]  - Générer un secret sécurisé');
  console.log('  npm run jwt:audit              - Auditer le secret actuel');
  console.log('  npm run jwt:check              - Vérifier la configuration');
  console.log('');
  console.log('📋 EXEMPLES:');
  console.log('  npm run jwt:validate "MySecretKey123"');
  console.log('  npm run jwt:generate 64');
  console.log('  npm run jwt:audit');
  console.log('');
  console.log('🔒 SÉCURITÉ:');
  console.log('  • Longueur minimum: 32 caractères');
  console.log('  • Entropie minimum: 3.0 bits/caractère');
  console.log('  • Complexité requise: majuscules, minuscules, chiffres, symboles');
  console.log('  • Éviter les secrets faibles/communs');
}

/**
 * 🎨 Retourne l'emoji correspondant à la force du secret
 */
function getStrengthEmoji(strength: string): string {
  switch (strength) {
    case 'excellent': return '🟢';
    case 'good': return '🟡';
    case 'medium': return '🟠';
    case 'weak': return '🔴';
    default: return '⚪';
  }
}

// Gérer les interruptions proprement
process.on('SIGINT', () => {
  console.log('\n⚠️ Commande interrompue par l\'utilisateur');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Commande interrompue par le système');
  process.exit(1);
});

bootstrap();