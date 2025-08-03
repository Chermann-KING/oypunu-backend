/**
 * @fileoverview Service d'évaluation et de génération de mots de passe sécurisés pour O'Ypunu
 * 
 * Ce service fournit des outils complets d'analyse de la force des mots de passe,
 * de génération automatique de mots de passe sécurisés et de recommandations
 * d'amélioration pour garantir la sécurité des comptes utilisateur.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable } from '@nestjs/common';
import { PasswordStrengthEvaluator } from '../validators/password.validator';

/**
 * Interface du résultat d'évaluation de mot de passe
 * 
 * @interface PasswordStrengthResult
 */
export interface PasswordStrengthResult {
  /** Score de force (0-100) */
  score: number;
  /** Niveau de sécurité */
  level: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  /** Recommandations d'amélioration */
  feedback: string[];
  /** Validité selon les critères O'Ypunu */
  isValid: boolean;
  /** Détail des exigences respectées */
  requirements: {
    /** Minimum 12 caractères */
    minLength: boolean;
    /** Contient majuscules */
    hasUpperCase: boolean;
    /** Contient minuscules */
    hasLowerCase: boolean;
    /** Contient chiffres */
    hasNumbers: boolean;
    /** Contient caractères spéciaux */
    hasSpecialChars: boolean;
    /** Pas de motifs courants */
    noCommonPatterns: boolean;
    /** Pas de répétitions */
    noRepeatedChars: boolean;
  };
}

/**
 * Service d'évaluation et de génération de mots de passe sécurisés
 * 
 * Ce service fournit une suite complète d'outils pour la gestion des mots de passe :
 * 
 * ## 🔍 Évaluation intelligente :
 * - **Scoring avancé** : Algorithme de notation sur 100 points
 * - **Analyse granulaire** : Vérification de chaque critère de sécurité
 * - **Recommandations** : Suggestions personnalisées d'amélioration
 * - **Validation stricte** : Conformité aux standards O'Ypunu
 * 
 * ## 🎲 Génération automatique :
 * - **Mots de passe forts** : Respectant tous les critères
 * - **Longueur configurable** : De 12 à N caractères
 * - **Diversité garantie** : Au moins un caractère de chaque type
 * - **Entropie maximale** : Mélange aléatoire sécurisé
 * 
 * ## 📊 Critères de sécurité :
 * - Minimum 12 caractères
 * - Majuscules, minuscules, chiffres, spéciaux
 * - Absence de motifs prévisibles
 * - Pas de répétitions excessives
 * 
 * @class PasswordStrengthService
 * @version 1.0.0
 */
@Injectable()
export class PasswordStrengthService {
  /**
   * Évalue la force d'un mot de passe et retourne un rapport détaillé
   * 
   * Analyse complète d'un mot de passe incluant le scoring, la validation
   * des critères de sécurité et les recommandations d'amélioration.
   * 
   * @method evaluatePassword
   * @param {string} password - Mot de passe à évaluer
   * @returns {PasswordStrengthResult} Rapport détaillé d'évaluation
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