/**
 * @fileoverview Module social O'Ypunu pour interactions communautaires
 * 
 * Ce module centralise toutes les fonctionnalités sociales et interactives
 * du dictionnaire, transformant l'expérience d'apprentissage en plateforme
 * sociale engageante avec votes, commentaires et partages communautaires.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Module } from '@nestjs/common';
import { WordSocialController } from './controllers/word-social.controller';
import { WordSocialService } from './services/word-social.service';
import { RepositoriesModule } from '../repositories/repositories.module';
import { DictionaryModule } from '../dictionary/dictionary.module';

/**
 * Module social O'Ypunu - Plateforme communautaire interactive
 * 
 * Transforme l'expérience dictionnaire en véritable réseau social
 * linguistique avec engagement communautaire, partages et interactions
 * pour enrichir l'apprentissage collaboratif des langues.
 * 
 * ## 🎯 Fonctionnalités principales :
 * 
 * ### 👥 Interactions sociales
 * - **Votes et réactions** : Système de votes contextuels sur mots
 * - **Commentaires** : Discussions hiérarchiques et collaboratives
 * - **Partages** : Intégration réseaux sociaux (Facebook, Twitter, etc.)
 * - **Notation** : Système d'évaluation 1-5 étoiles avec pondération
 * 
 * ### 📈 Engagement communautaire
 * - **Mot du jour** : Challenges quotidiens avec statistiques
 * - **Tendances** : Mots populaires avec scoring dynamique
 * - **Exemples communautaires** : Contributions d'usage authentiques
 * - **Discussions** : Forums thématiques par mot et catégorie
 * 
 * ### 📊 Analytics et métriques
 * - **Statistiques d'engagement** : Métriques de participation
 * - **Scoring intelligent** : Algorithmes de pertinence sociale
 * - **Profils d'activité** : Historique et contributions utilisateur
 * - **Recommandations sociales** : Suggestions basées sur l'activité
 * 
 * ## 🔄 Intégrations :
 * - **DictionaryModule** : Accès complet aux mots et définitions
 * - **RepositoriesModule** : Pattern Repository pour gestion données
 * - Architecture découplée pour extensibilité sociale
 * 
 * @class SocialModule
 * @version 1.0.0
 */
@Module({
  imports: [
    RepositoriesModule, // Pour accès aux repositories
    DictionaryModule,   // Pour intégration avec les services de mots
  ],
  controllers: [
    WordSocialController, // Controller avec tous les endpoints sociaux
  ],
  providers: [
    WordSocialService, // Service principal pour logique sociale
  ],
  exports: [
    WordSocialService, // Exporté pour utilisation par d'autres modules
  ],
})
export class SocialModule {}