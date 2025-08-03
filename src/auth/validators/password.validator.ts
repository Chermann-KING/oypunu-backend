/**
 * @fileoverview Validateur de force de mot de passe pour O'Ypunu
 * 
 * Ce validateur implémente une validation avancée de la force des mots de passe
 * avec critères de sécurité stricts, détection de motifs courants et évaluation
 * intelligente de la complexité pour garantir la sécurité des comptes utilisateur.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Contrainte de validation pour mots de passe forts
 * 
 * Cette classe implémente une validation rigoureuse des mots de passe
 * selon les standards de sécurité O'Ypunu. Elle vérifie la complexité,
 * la longueur, et détecte les motifs faibles couramment utilisés.
 * 
 * ## 🔒 Critères de sécurité requis :
 * - **Longueur** : Minimum 12 caractères
 * - **Majuscules** : Au moins 1 lettre majuscule
 * - **Minuscules** : Au moins 1 lettre minuscule
 * - **Chiffres** : Au moins 1 chiffre
 * - **Spéciaux** : Au moins 1 caractère spécial
 * - **Anti-motifs** : Pas de séquences courantes
 * - **Anti-répétition** : Max 2 caractères identiques consécutifs
 * 
 * @class StrongPasswordConstraint
 * @implements ValidatorConstraintInterface
 * @version 1.0.0
 */
@ValidatorConstraint({ name: 'strongPassword', async: false })
export class StrongPasswordConstraint implements ValidatorConstraintInterface {
  /**
   * Valide la force et la sécurité d'un mot de passe
   * 
   * Effectue une série de vérifications pour s'assurer que le mot de passe
   * respecte tous les critères de sécurité définis par O'Ypunu.
   * 
   * @method validate
   * @param {string} password - Mot de passe à valider
   * @param {ValidationArguments} args - Arguments de validation class-validator
   * @returns {boolean} True si le mot de passe est valide, false sinon
   */
  validate(password: string, args: ValidationArguments) {
    if (!password) return false;

    // Vérifications de sécurité requises
    const checks = {
      minLength: password.length >= 12,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password),
      noCommonPatterns: !this.hasCommonPatterns(password),
      noRepeatedChars: !this.hasRepeatedCharacters(password),
    };

    // Le mot de passe doit passer tous les tests
    return Object.values(checks).every(check => check);
  }

  /**
   * Génère un message d'erreur détaillé pour les mots de passe invalides
   * 
   * Analyse le mot de passe fourni et retourne un message explicatif
   * listant tous les critères non respectés pour guider l'utilisateur.
   * 
   * @method defaultMessage
   * @param {ValidationArguments} args - Arguments contenant le mot de passe à analyser
   * @returns {string} Message d'erreur détaillé avec les critères manquants
   */
  defaultMessage(args: ValidationArguments) {
    const password = args.value as string;
    const failedChecks: string[] = [];

    if (!password) {
      return 'Le mot de passe est requis';
    }

    if (password.length < 12) {
      failedChecks.push('au moins 12 caractères');
    }
    if (!/[A-Z]/.test(password)) {
      failedChecks.push('au moins une lettre majuscule');
    }
    if (!/[a-z]/.test(password)) {
      failedChecks.push('au moins une lettre minuscule');
    }
    if (!/\d/.test(password)) {
      failedChecks.push('au moins un chiffre');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
      failedChecks.push('au moins un caractère spécial (!@#$%^&*...)');
    }
    if (this.hasCommonPatterns(password)) {
      failedChecks.push('éviter les motifs courants (123, abc, qwerty...)');
    }
    if (this.hasRepeatedCharacters(password)) {
      failedChecks.push('éviter les caractères répétés consécutifs');
    }

    return `Le mot de passe doit contenir : ${failedChecks.join(', ')}`;
  }

  /**
   * Détecte les motifs courants dans un mot de passe
   * 
   * Vérifie la présence de séquences prévisibles ou de mots communs
   * qui réduisent significativement la sécurité du mot de passe.
   * 
   * @private
   * @method hasCommonPatterns
   * @param {string} password - Mot de passe à analyser
   * @returns {boolean} True si des motifs courants sont détectés
   */
  private hasCommonPatterns(password: string): boolean {
    const commonPatterns = [
      /123/i,      // Séquences numériques
      /abc/i,      // Séquences alphabétiques  
      /qwerty/i,   // Dispositions clavier QWERTY
      /azerty/i,   // Dispositions clavier AZERTY
      /password/i, // Mots évidents anglais
      /motdepasse/i, // Mots évidents français
      /admin/i,    // Termes administratifs
      /user/i,     // Termes utilisateur
      /oypunu/i,   // Spécifique à l'application
    ];

    return commonPatterns.some(pattern => pattern.test(password));
  }

  /**
   * Détecte les caractères répétés consécutivement
   * 
   * Vérifie s'il y a plus de 2 caractères identiques d'affilée,
   * ce qui indique un motif faible réduisant l'entropie.
   * 
   * @private
   * @method hasRepeatedCharacters
   * @param {string} password - Mot de passe à analyser
   * @returns {boolean} True si plus de 2 caractères consécutifs identiques
   */
  private hasRepeatedCharacters(password: string): boolean {
    // Vérifier si il y a plus de 2 caractères identiques consécutifs
    return /(.)\1{2,}/.test(password);
  }
}

/**
 * Décorateur pour valider la force d'un mot de passe selon les standards O'Ypunu
 * 
 * Ce décorateur applique automatiquement la validation StrongPasswordConstraint
 * sur les propriétés de DTO pour garantir la sécurité des mots de passe.
 * 
 * ## Exigences de sécurité :
 * - **Minimum 12 caractères** pour résister aux attaques par force brute
 * - **Au moins une majuscule** pour augmenter la complexité
 * - **Au moins une minuscule** pour diversifier les caractères
 * - **Au moins un chiffre** pour introduire des éléments numériques
 * - **Au moins un caractère spécial** pour maximiser l'entropie
 * - **Pas de motifs courants** (123, abc, qwerty, etc.)
 * - **Pas plus de 2 caractères identiques consécutifs**
 * 
 * @function IsStrongPassword
 * @param {ValidationOptions} validationOptions - Options de validation optionnelles
 * @returns {PropertyDecorator} Décorateur de propriété class-validator
 * 
 * @example
 * ```typescript
 * export class ChangePasswordDto {
 *   @IsStrongPassword({ message: 'Mot de passe trop faible' })
 *   newPassword: string;
 * }
 * ```
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: StrongPasswordConstraint,
    });
  };
}

/**
 * Utilitaire d'évaluation intelligente de la force des mots de passe
 * 
 * Cette classe fournit une évaluation avancée de la force des mots de passe
 * avec scoring détaillé, classification par niveau et recommandations
 * d'amélioration pour guider les utilisateurs vers de meilleurs mots de passe.
 * 
 * ## Système de scoring (100 points max) :
 * - **Longueur** : 40 points (base + bonus pour longueur étendue)
 * - **Complexité** : 40 points (majuscules, minuscules, chiffres, spéciaux)
 * - **Diversité** : 20 points (unicité, absence de motifs)
 * 
 * ## Niveaux de force :
 * - **very-strong** : 90-100 points (excellent)
 * - **strong** : 75-89 points (très bon)
 * - **good** : 60-74 points (acceptable)
 * - **fair** : 40-59 points (faible)
 * - **weak** : 20-39 points (très faible)
 * - **very-weak** : 0-19 points (inacceptable)
 * 
 * @class PasswordStrengthEvaluator
 * @version 1.0.0
 */
export class PasswordStrengthEvaluator {
  /**
   * Évalue la force d'un mot de passe avec scoring et recommandations
   * 
   * Analyse complète d'un mot de passe retournant un score détaillé,
   * un niveau de sécurité et des suggestions d'amélioration spécifiques.
   * 
   * @static
   * @method evaluate
   * @param {string} password - Mot de passe à évaluer
   * @returns {Object} Objet contenant score, niveau et recommandations
   */
  static evaluate(password: string): {
    score: number;
    level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
    feedback: string[];
  } {
    if (!password) {
      return {
        score: 0,
        level: 'very-weak',
        feedback: ['Mot de passe requis'],
      };
    }

    let score = 0;
    const feedback: string[] = [];

    // Longueur (40 points max)
    if (password.length >= 12) {
      score += 25;
    } else if (password.length >= 8) {
      score += 15;
      feedback.push('Augmentez la longueur à 12+ caractères');
    } else {
      feedback.push('Minimum 8 caractères requis');
    }

    if (password.length >= 16) score += 10;
    if (password.length >= 20) score += 5;

    // Complexité des caractères (40 points max)
    if (/[a-z]/.test(password)) score += 10;
    else feedback.push('Ajoutez des lettres minuscules');

    if (/[A-Z]/.test(password)) score += 10;
    else feedback.push('Ajoutez des lettres majuscules');

    if (/\d/.test(password)) score += 10;
    else feedback.push('Ajoutez des chiffres');

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) score += 10;
    else feedback.push('Ajoutez des caractères spéciaux');

    // Diversité et patterns (20 points max)
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.8) score += 10;
    else feedback.push('Variez davantage les caractères');

    if (!/(.)\\1{2,}/.test(password)) score += 5;
    else feedback.push('Évitez les caractères répétés');

    if (!/123|abc|qwerty|azerty|password/i.test(password)) score += 5;
    else feedback.push('Évitez les motifs courants');

    // Déterminer le niveau
    let level: any;
    if (score >= 90) level = 'very-strong';
    else if (score >= 75) level = 'strong';
    else if (score >= 60) level = 'good';
    else if (score >= 40) level = 'fair';
    else if (score >= 20) level = 'weak';
    else level = 'very-weak';

    return { score, level, feedback };
  }
}