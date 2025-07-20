import { Injectable } from '@nestjs/common';
import { PasswordStrengthEvaluator } from '../validators/password.validator';

export interface PasswordStrengthResult {
  score: number;
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  feedback: string[];
  isValid: boolean;
  requirements: {
    minLength: boolean;
    hasUpperCase: boolean;
    hasLowerCase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
    noCommonPatterns: boolean;
    noRepeatedChars: boolean;
  };
}

@Injectable()
export class PasswordStrengthService {
  /**
   * Évalue la force d'un mot de passe et retourne un rapport détaillé
   */
  evaluatePassword(password: string): PasswordStrengthResult {
    const evaluation = PasswordStrengthEvaluator.evaluate(password);
    
    // Vérifier toutes les exigences
    const requirements = this.checkRequirements(password);
    const isValid = Object.values(requirements).every(check => check);

    return {
      ...evaluation,
      isValid,
      requirements,
    };
  }

  /**
   * Vérifie si un mot de passe respecte tous les critères de sécurité
   */
  isPasswordValid(password: string): boolean {
    const requirements = this.checkRequirements(password);
    return Object.values(requirements).every(check => check);
  }

  /**
   * Génère des recommandations pour améliorer un mot de passe
   */
  getPasswordRecommendations(password: string): string[] {
    const requirements = this.checkRequirements(password);
    const recommendations: string[] = [];

    if (!requirements.minLength) {
      recommendations.push('Utilisez au moins 12 caractères');
    }
    if (!requirements.hasUpperCase) {
      recommendations.push('Ajoutez au moins une lettre majuscule (A-Z)');
    }
    if (!requirements.hasLowerCase) {
      recommendations.push('Ajoutez au moins une lettre minuscule (a-z)');
    }
    if (!requirements.hasNumbers) {
      recommendations.push('Ajoutez au moins un chiffre (0-9)');
    }
    if (!requirements.hasSpecialChars) {
      recommendations.push('Ajoutez au moins un caractère spécial (!@#$%^&*...)');
    }
    if (!requirements.noCommonPatterns) {
      recommendations.push('Évitez les motifs courants (123, abc, qwerty, password...)');
    }
    if (!requirements.noRepeatedChars) {
      recommendations.push('Évitez les caractères répétés consécutifs (aaa, 111...)');
    }

    if (recommendations.length === 0) {
      recommendations.push('Votre mot de passe respecte tous les critères de sécurité ! 🎉');
    }

    return recommendations;
  }

  /**
   * Génère un mot de passe sécurisé automatiquement
   */
  generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    // S'assurer qu'on a au moins un caractère de chaque type
    let password = '';
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Remplir le reste
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Mélanger les caractères
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  private checkRequirements(password: string) {
    if (!password) {
      return {
        minLength: false,
        hasUpperCase: false,
        hasLowerCase: false,
        hasNumbers: false,
        hasSpecialChars: false,
        noCommonPatterns: false,
        noRepeatedChars: false,
      };
    }

    return {
      minLength: password.length >= 12,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password),
      noCommonPatterns: !this.hasCommonPatterns(password),
      noRepeatedChars: !this.hasRepeatedCharacters(password),
    };
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
      /oypunu/i,
    ];

    return commonPatterns.some(pattern => pattern.test(password));
  }

  private hasRepeatedCharacters(password: string): boolean {
    return /(.)\1{2,}/.test(password);
  }
}