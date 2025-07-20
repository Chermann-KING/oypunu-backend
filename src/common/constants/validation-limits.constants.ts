/**
 * Constantes de validation pour les limites de longueur des champs
 * Objectif : Prévenir les attaques DoS par payloads surdimensionnés
 * 
 * PHASE 1 - ÉTAPE 3 : Protection DoS via @MaxLength()
 */

// ========== LIMITES GÉNÉRALES ==========

export const VALIDATION_LIMITS = {
  // Identifiants et codes
  ID: {
    MIN: 1,
    MAX: 100,
  },
  
  // Textes courts (titres, noms, mots simples)
  SHORT_TEXT: {
    MIN: 1,
    MAX: 200,
  },
  
  // Textes moyens (descriptions courtes, sous-titres)
  MEDIUM_TEXT: {
    MIN: 1,
    MAX: 500,
  },
  
  // Textes longs (descriptions, contenus)
  LONG_TEXT: {
    MIN: 1,
    MAX: 2000,
  },
  
  // Textes très longs (articles, posts détaillés)
  VERY_LONG_TEXT: {
    MIN: 1,
    MAX: 10000,
  },
  
  // URLs
  URL: {
    MIN: 10,
    MAX: 2048,
  },
  
  // Emails
  EMAIL: {
    MIN: 5,
    MAX: 254, // RFC 5321 limite
  },
  
  // Mots de passe (après validation de force)
  PASSWORD: {
    MIN: 12,
    MAX: 128,
  },
} as const;

// ========== LIMITES SPÉCIFIQUES PAR DOMAINE ==========

export const DICTIONARY_LIMITS = {
  // Mots et termes
  WORD: {
    MIN: 1,
    MAX: 100,
  },
  
  // Définitions
  DEFINITION: {
    MIN: 10,
    MAX: 1000,
  },
  
  // Exemples d'utilisation
  EXAMPLE: {
    MIN: 5,
    MAX: 300,
  },
  
  // Prononciation phonétique
  PRONUNCIATION: {
    MIN: 2,
    MAX: 200,
  },
  
  // Étymologie
  ETYMOLOGY: {
    MIN: 10,
    MAX: 1500,
  },
  
  // Synonymes/Antonymes (par item)
  SYNONYM: {
    MIN: 1,
    MAX: 50,
  },
  
  // Notes de modérateur
  MODERATOR_NOTES: {
    MIN: 5,
    MAX: 1000,
  },
  
  // Contexte de traduction
  TRANSLATION_CONTEXT: {
    MIN: 2,
    MAX: 50,
  },
  
  // Accent/dialecte
  ACCENT: {
    MIN: 2,
    MAX: 10,
  },
} as const;

export const COMMUNITY_LIMITS = {
  // Titres de posts/communautés
  TITLE: {
    MIN: 3,
    MAX: 150,
  },
  
  // Contenu de posts
  POST_CONTENT: {
    MIN: 1,
    MAX: 5000,
  },
  
  // Commentaires
  COMMENT_CONTENT: {
    MIN: 1,
    MAX: 1000,
  },
  
  // Noms de communautés
  COMMUNITY_NAME: {
    MIN: 3,
    MAX: 100,
  },
  
  // Descriptions de communautés
  COMMUNITY_DESCRIPTION: {
    MIN: 10,
    MAX: 500,
  },
  
  // Tags
  TAG: {
    MIN: 1,
    MAX: 30,
  },
} as const;

export const USER_LIMITS = {
  // Noms d'utilisateur
  USERNAME: {
    MIN: 3,
    MAX: 30,
  },
  
  // Noms complets
  FULL_NAME: {
    MIN: 2,
    MAX: 100,
  },
  
  // Biographies
  BIO: {
    MIN: 10,
    MAX: 500,
  },
  
  // Raisons de demande de contribution
  CONTRIBUTION_REASON: {
    MIN: 20,
    MAX: 1000,
  },
  
  // Commentaires d'évaluation
  REVIEW_COMMENT: {
    MIN: 10,
    MAX: 500,
  },
} as const;

export const MESSAGING_LIMITS = {
  // Contenu de messages
  MESSAGE_CONTENT: {
    MIN: 1,
    MAX: 2000,
  },
  
  // Sujets de conversation
  CONVERSATION_SUBJECT: {
    MIN: 3,
    MAX: 100,
  },
} as const;

export const LANGUAGE_LIMITS = {
  // Noms de langues
  LANGUAGE_NAME: {
    MIN: 2,
    MAX: 100,
  },
  
  // Noms natifs
  NATIVE_NAME: {
    MIN: 2,
    MAX: 100,
  },
  
  // Codes ISO
  ISO_CODE: {
    MIN: 2,
    MAX: 10,
  },
  
  // Régions
  REGION: {
    MIN: 2,
    MAX: 50,
  },
  
  // Familles de langues
  FAMILY: {
    MIN: 3,
    MAX: 50,
  },
} as const;

// ========== LIMITES POUR ARRAYS ==========

export const ARRAY_LIMITS = {
  // Nombre maximum d'éléments dans les arrays
  TAGS: 10,
  SYNONYMS: 20,
  ANTONYMS: 20,
  EXAMPLES: 10,
  TRANSLATIONS: 50,
  AUDIO_FILES: 20,
  SOURCES: 10,
  PHONETICS: 5,
  DEFINITIONS_PER_MEANING: 5,
  MEANINGS_PER_WORD: 10,
  CONTEXT_ITEMS: 5,
  LEARNING_LANGUAGES: 10,
} as const;

// ========== UTILITAIRES ==========

/**
 * Messages d'erreur standardisés pour les validations de longueur
 */
export const VALIDATION_MESSAGES = {
  TOO_SHORT: (field: string, min: number) => 
    `${field} doit contenir au moins ${min} caractère(s)`,
  TOO_LONG: (field: string, max: number) => 
    `${field} ne peut pas dépasser ${max} caractère(s)`,
  ARRAY_TOO_LONG: (field: string, max: number) => 
    `${field} ne peut pas contenir plus de ${max} élément(s)`,
  INVALID_FORMAT: (field: string, format: string) => 
    `${field} doit respecter le format : ${format}`,
} as const;

/**
 * Générateur de messages de validation personnalisés
 */
export function createValidationMessage(
  field: string, 
  limits: { MIN: number; MAX: number }
): { minLength: { message: string }; maxLength: { message: string } } {
  return {
    minLength: { 
      message: VALIDATION_MESSAGES.TOO_SHORT(field, limits.MIN) 
    },
    maxLength: { 
      message: VALIDATION_MESSAGES.TOO_LONG(field, limits.MAX) 
    },
  };
}