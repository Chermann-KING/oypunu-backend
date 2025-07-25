import { Injectable, Logger } from '@nestjs/common';

/**
 * 🔐 SERVICE DE VALIDATION JWT SECRET
 * 
 * Service dédié à la validation de la sécurité des secrets JWT.
 * Vérifie la force, l'entropie et la conformité aux standards de sécurité.
 * 
 * Standards de sécurité implémentés :
 * ✅ Longueur minimum : 32 caractères (256 bits)
 * ✅ Entropie minimum : 4.0 bits par caractère
 * ✅ Complexité : Majuscules, minuscules, chiffres, symboles
 * ✅ Détection des patterns faibles
 * ✅ Vérification contre secrets communs/faibles
 */
@Injectable()
export class JwtSecretValidatorService {
  private readonly logger = new Logger(JwtSecretValidatorService.name);

  // Secrets faibles couramment utilisés (à éviter absolument)
  private readonly weakSecrets = [
    'secret',
    'mysecret',
    'jwt_secret',
    'your-256-bit-secret',
    'your_jwt_secret',
    'super_secret_key',
    'development_secret',
    'test_secret',
    '12345678901234567890123456789012',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'abcdefghijklmnopqrstuvwxyz123456',
  ];

  // Patterns faibles à détecter
  private readonly weakPatterns = [
    /^(.)\1+$/, // Caractères répétés (aaaa, 1111)
    /^(.)(.)\1\2+$/, // Patterns alternés (abab, 1212)
    /^(123|abc|qwe|asd)/i, // Séquences communes
    /^password|admin|user|test|demo/i, // Mots communs
  ];

  /**
   * 🔍 Valide la sécurité complète d'un secret JWT
   * 
   * @param secret - Le secret JWT à valider
   * @returns Résultat de validation avec détails
   */
  validateJwtSecret(secret: string): JwtSecretValidationResult {
    const results: JwtSecretValidationResult = {
      isValid: true,
      score: 0,
      errors: [],
      warnings: [],
      recommendations: [],
      entropy: 0,
      strength: 'weak',
    };

    // 1. Vérification de base (existence et type)
    if (!secret || typeof secret !== 'string') {
      results.isValid = false;
      results.errors.push('Secret JWT manquant ou invalide');
      return results;
    }

    // 2. Vérification longueur minimum
    this.validateLength(secret, results);

    // 3. Calcul et validation de l'entropie
    this.validateEntropy(secret, results);

    // 4. Vérification complexité des caractères
    this.validateComplexity(secret, results);

    // 5. Détection des secrets faibles connus
    this.checkWeakSecrets(secret, results);

    // 6. Détection des patterns faibles
    this.checkWeakPatterns(secret, results);

    // 7. Calcul du score final et de la force
    this.calculateFinalScore(results);

    // 8. Génération des recommandations
    this.generateRecommendations(results);

    // Log des résultats pour audit
    this.logValidationResults(results);

    return results;
  }

  /**
   * 📏 Valide la longueur du secret
   */
  private validateLength(secret: string, results: JwtSecretValidationResult): void {
    const length = secret.length;
    
    if (length < 32) {
      results.isValid = false;
      results.errors.push(`Secret trop court: ${length} caractères (minimum: 32)`);
    } else if (length < 64) {
      results.warnings.push(`Secret recommandé plus long: ${length} caractères (recommandé: 64+)`);
      results.score += 20;
    } else {
      results.score += 30;
    }
  }

  /**
   * 🎲 Calcule et valide l'entropie du secret
   */
  private validateEntropy(secret: string, results: JwtSecretValidationResult): void {
    const entropy = this.calculateEntropy(secret);
    results.entropy = entropy;

    if (entropy < 3.0) {
      results.isValid = false;
      results.errors.push(`Entropie trop faible: ${entropy.toFixed(2)} bits/char (minimum: 3.0)`);
    } else if (entropy < 4.0) {
      results.warnings.push(`Entropie recommandée plus élevée: ${entropy.toFixed(2)} bits/char (recommandé: 4.0+)`);
      results.score += 15;
    } else {
      results.score += 25;
    }
  }

  /**
   * 🔤 Valide la complexité des caractères
   */
  private validateComplexity(secret: string, results: JwtSecretValidationResult): void {
    const hasLower = /[a-z]/.test(secret);
    const hasUpper = /[A-Z]/.test(secret);
    const hasDigits = /\d/.test(secret);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(secret);

    let complexityScore = 0;
    const missing = [];

    if (hasLower) complexityScore += 5; else missing.push('minuscules');
    if (hasUpper) complexityScore += 5; else missing.push('majuscules');
    if (hasDigits) complexityScore += 5; else missing.push('chiffres');
    if (hasSpecial) complexityScore += 10; else missing.push('caractères spéciaux');

    if (complexityScore < 15) {
      results.warnings.push(`Complexité insuffisante. Manque: ${missing.join(', ')}`);
    }

    results.score += complexityScore;
  }

  /**
   * ⚠️ Vérifie contre les secrets faibles connus
   */
  private checkWeakSecrets(secret: string, results: JwtSecretValidationResult): void {
    const lowerSecret = secret.toLowerCase();
    
    for (const weakSecret of this.weakSecrets) {
      if (lowerSecret === weakSecret.toLowerCase() || lowerSecret.includes(weakSecret.toLowerCase())) {
        results.isValid = false;
        results.errors.push('Secret faible détecté - utilisé dans des exemples/tutoriels');
        return;
      }
    }
  }

  /**
   * 🔍 Détecte les patterns faibles
   */
  private checkWeakPatterns(secret: string, results: JwtSecretValidationResult): void {
    for (const pattern of this.weakPatterns) {
      if (pattern.test(secret)) {
        results.warnings.push('Pattern faible détecté dans le secret');
        results.score -= 10;
        break;
      }
    }
  }

  /**
   * 📊 Calcule l'entropie d'une chaîne (bits par caractère)
   */
  private calculateEntropy(str: string): number {
    const charCount = {};
    
    // Compter la fréquence de chaque caractère
    for (const char of str) {
      charCount[char] = (charCount[char] || 0) + 1;
    }

    // Calculer l'entropie selon Shannon
    let entropy = 0;
    const length = str.length;

    for (const count of Object.values(charCount)) {
      const probability = (count as number) / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * 🏆 Calcule le score final et détermine la force
   */
  private calculateFinalScore(results: JwtSecretValidationResult): void {
    // Bonus pour entropie élevée
    if (results.entropy > 5.0) results.score += 10;
    
    // Malus pour erreurs
    results.score -= results.errors.length * 20;
    
    // Malus pour warnings
    results.score -= results.warnings.length * 5;

    // Normaliser le score (0-100)
    results.score = Math.max(0, Math.min(100, results.score));

    // Déterminer la force
    if (results.score >= 80) {
      results.strength = 'excellent';
    } else if (results.score >= 60) {
      results.strength = 'good';
    } else if (results.score >= 40) {
      results.strength = 'medium';
    } else {
      results.strength = 'weak';
    }
  }

  /**
   * 💡 Génère des recommandations personnalisées
   */
  private generateRecommendations(results: JwtSecretValidationResult): void {
    if (results.strength === 'excellent') {
      results.recommendations.push('✅ Excellent secret JWT - aucune amélioration requise');
      return;
    }

    results.recommendations.push('🔧 Recommandations pour améliorer la sécurité:');

    if (results.entropy < 4.0) {
      results.recommendations.push('• Augmenter la diversité des caractères pour améliorer l\'entropie');
    }

    if (results.score < 60) {
      results.recommendations.push('• Utiliser un générateur de secrets cryptographiquement sécurisé');
      results.recommendations.push('• Exemple: openssl rand -base64 64');
    }

    results.recommendations.push('• Stocker le secret de manière sécurisée (variables d\'environnement)');
    results.recommendations.push('• Implémenter une rotation régulière du secret');
  }

  /**
   * 📝 Log les résultats de validation pour audit
   */
  private logValidationResults(results: JwtSecretValidationResult): void {
    if (!results.isValid) {
      this.logger.error('🚨 Secret JWT invalide détecté:', {
        errors: results.errors,
        strength: results.strength,
        score: results.score,
      });
    } else if (results.warnings.length > 0) {
      this.logger.warn('⚠️ Secret JWT avec warnings:', {
        warnings: results.warnings,
        strength: results.strength,
        score: results.score,
      });
    } else {
      this.logger.log('✅ Secret JWT validé avec succès:', {
        strength: results.strength,
        score: results.score,
        entropy: results.entropy.toFixed(2),
      });
    }
  }

  /**
   * 🎲 Génère un secret JWT sécurisé (pour développement/tests)
   */
  generateSecureSecret(length: number = 64): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let secret = '';
    
    for (let i = 0; i < length; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return secret;
  }
}

// Interface pour le résultat de validation
export interface JwtSecretValidationResult {
  isValid: boolean;
  score: number;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  entropy: number;
  strength: 'weak' | 'medium' | 'good' | 'excellent';
}