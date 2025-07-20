import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'strongPassword', async: false })
export class StrongPasswordConstraint implements ValidatorConstraintInterface {
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

  private hasCommonPatterns(password: string): boolean {
    const commonPatterns = [
      /123/i,
      /abc/i,
      /qwerty/i,
      /azerty/i,
      /password/i,
      /motdepasse/i,
      /admin/i,
      /user/i,
      /oypunu/i, // Spécifique à l'application
    ];

    return commonPatterns.some(pattern => pattern.test(password));
  }

  private hasRepeatedCharacters(password: string): boolean {
    // Vérifier si il y a plus de 2 caractères identiques consécutifs
    return /(.)\1{2,}/.test(password);
  }
}

/**
 * Décorateur pour valider la force d'un mot de passe
 * Exigences :
 * - Minimum 12 caractères
 * - Au moins une majuscule
 * - Au moins une minuscule  
 * - Au moins un chiffre
 * - Au moins un caractère spécial
 * - Pas de motifs courants (123, abc, etc.)
 * - Pas plus de 2 caractères identiques consécutifs
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
 * Utilitaire pour évaluer la force d'un mot de passe
 * Retourne un score de 0 à 100
 */
export class PasswordStrengthEvaluator {
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