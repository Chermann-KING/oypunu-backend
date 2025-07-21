/**
 * Index des services pour les mots
 * PHASE 1-4 - Refactoring WordsService
 */

// Phase 1 - Services utilitaires
export { WordValidationService } from './word-validation.service';
export { WordPermissionService } from './word-permission.service';
export { WordNotificationService } from './word-notification.service';
export { WordTranslationService, Translation } from './word-translation.service';

// Phase 2 - Services spécialisés
export { WordAudioService } from './word-audio.service';

// Phase 3 - Service favoris
export { WordFavoriteService } from './word-favorite.service';

// Phase 4 - Service analytics
export { WordAnalyticsService } from './word-analytics.service';
