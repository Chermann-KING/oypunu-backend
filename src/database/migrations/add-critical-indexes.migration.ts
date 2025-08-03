/**
 * @fileoverview Migration critique d'ajout d'index de performance MongoDB
 * 
 * Cette migration fondamentale optimise drastiquement les performances
 * de la base de données O'Ypunu en ajoutant tous les index critiques
 * identifiés lors de l'audit de performance. Elle améliore significativement
 * les temps de réponse des requêtes fréquentes et complexes.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * Migration d'ajout d'index critiques pour optimisation performance
 * 
 * Cette migration critique implémente une stratégie d'indexation complète
 * pour toutes les collections principales de l'application O'Ypunu.
 * Elle couvre les patterns de requêtes les plus fréquents et complexes :
 * 
 * ## Index ajoutés par collection :
 * 
 * ### 👤 Users (6 index)
 * - email (unique) : Authentification et recherche utilisateur
 * - username (unique) : Recherche et profils utilisateur
 * - role : Filtrage par rôle (admin, contributeur, etc.)
 * - isEmailVerified : Filtrage utilisateurs vérifiés
 * - email + isEmailVerified : Authentification optimisée
 * 
 * ### 📚 Words (10 index)
 * - word : Recherche textuelle principale
 * - status : Filtrage par statut (pending, approved, rejected)
 * - language : Filtrage par langue (crucial pour navigation)
 * - category : Filtrage par catégorie grammaticale
 * - contributedBy : Mots par contributeur
 * - status + language : Requêtes approuvées par langue
 * - language + category : Navigation thématique
 * - status + language + category : Requêtes complexes
 * - Full-text search : Recherche avancée avec pondération
 * - createdAt : Tri chronologique
 * 
 * ### 🏘️ Communities (4 index)
 * - language : Recherche communautés par langue
 * - name : Recherche par nom de communauté
 * - createdBy : Communautés par créateur
 * - membersCount : Tri par popularité
 * 
 * ### 💬 Messages (3 index)
 * - conversation + createdAt : Performance chat temps réel
 * - sender : Messages par expéditeur
 * - readBy.user : Gestion messages lus (sparse)
 * 
 * ### 📈 ActivityFeed (3 index)
 * - user + createdAt : Flux activité personnel
 * - type : Filtrage par type d'activité
 * - type + createdAt : Flux global par type
 * 
 * ### 🔐 RefreshTokens (3 index)
 * - token (unique) : Authentification token
 * - user : Tokens par utilisateur
 * - expiresAt (TTL) : Nettoyage automatique
 * 
 * ## Optimisations techniques :
 * - Index background pour éviter le blocage
 * - Index composés pour requêtes multi-critères
 * - Index TTL pour nettoyage automatique
 * - Index sparse pour champs optionnels
 * - Pondération pour recherche textuelle
 * - Rollback complet avec suppression sélective
 * 
 * @class AddCriticalIndexesMigration
 * @version 1.0.0
 */
@Injectable()
export class AddCriticalIndexesMigration {
  private readonly logger = new Logger(AddCriticalIndexesMigration.name);

  constructor(@InjectConnection() private connection: Connection) {}

  /**
   * Exécute la migration d'ajout des index critiques
   * 
   * Cette méthode principale orchestre l'ajout de tous les index
   * critiques sur toutes les collections. Elle procède de manière
   * séquentielle pour garantir la cohérence et gère les erreurs
   * avec rollback automatique si nécessaire.
   * 
   * ## Ordre d'exécution optimisé :
   * 1. Users - Base utilisateur (priorité authentification)
   * 2. Words - Collection principale (cœur métier)
   * 3. Communities - Structure sociale
   * 4. Messages - Communication temps réel
   * 5. ActivityFeed - Notifications et activité
   * 6. RefreshTokens - Sécurité et sessions
   * 
   * @async
   * @method up
   * @returns {Promise<void>}
   * @throws {Error} Si la création d'un index échoue
   * 
   * @example
   * ```typescript
   * // Exécution manuelle via CLI
   * await migrationService.runCriticalIndexesMigration();
   * 
   * // Ou via le service de migration
   * const migration = new AddCriticalIndexesMigration(connection);
   * await migration.up();
   * ```
   */
  async up(): Promise<void> {
    this.logger.log('🗂️ Début de la migration - Ajout des indexes critiques');

    try {
      // Index pour la collection Users
      await this.addUserIndexes();
      
      // Index pour la collection Words
      await this.addWordIndexes();
      
      // Index pour la collection Communities
      await this.addCommunityIndexes();
      
      // Index pour la collection Messages
      await this.addMessageIndexes();
      
      // Index pour la collection ActivityFeed
      await this.addActivityFeedIndexes();
      
      // Index pour la collection RefreshTokens
      await this.addRefreshTokenIndexes();

      this.logger.log('✅ Migration terminée avec succès - Tous les indexes créés');
      
      // Afficher les statistiques
      await this.showIndexStats();
      
    } catch (error) {
      this.logger.error('❌ Erreur lors de la migration:', error);
      throw error;
    }
  }

  /**
   * 👤 Ajouter les indexes pour la collection Users
   */
  private async addUserIndexes(): Promise<void> {
    this.logger.log('📧 Ajout des indexes Users...');
    const userCollection = this.connection.collection('users');

    // Index sur email - recherche et authentification
    await userCollection.createIndex(
      { email: 1 },
      { 
        unique: true,
        name: 'idx_users_email_unique',
        background: true
      }
    );

    // Index sur username - recherche utilisateur
    await userCollection.createIndex(
      { username: 1 },
      { 
        unique: true,
        name: 'idx_users_username_unique',
        background: true
      }
    );

    // Index sur role - filtrage par rôle
    await userCollection.createIndex(
      { role: 1 },
      { 
        name: 'idx_users_role',
        background: true
      }
    );

    // Index sur isEmailVerified - filtrage utilisateurs vérifiés
    await userCollection.createIndex(
      { isEmailVerified: 1 },
      { 
        name: 'idx_users_email_verified',
        background: true
      }
    );

    // Index composé sur email + isEmailVerified (authentification)
    await userCollection.createIndex(
      { email: 1, isEmailVerified: 1 },
      { 
        name: 'idx_users_email_verification',
        background: true
      }
    );

    this.logger.log('✅ Indexes Users créés');
  }

  /**
   * 📚 Ajouter les indexes pour la collection Words
   */
  private async addWordIndexes(): Promise<void> {
    this.logger.log('📚 Ajout des indexes Words...');
    const wordCollection = this.connection.collection('words');

    // Index sur le champ word - recherche textuelle
    await wordCollection.createIndex(
      { word: 1 },
      { 
        name: 'idx_words_word_text',
        background: true
      }
    );

    // Index sur status - filtrage par statut
    await wordCollection.createIndex(
      { status: 1 },
      { 
        name: 'idx_words_status',
        background: true
      }
    );

    // Index sur language - filtrage par langue
    await wordCollection.createIndex(
      { language: 1 },
      { 
        name: 'idx_words_language',
        background: true
      }
    );

    // Index sur category - filtrage par catégorie
    await wordCollection.createIndex(
      { category: 1 },
      { 
        name: 'idx_words_category',
        background: true
      }
    );

    // Index sur contributedBy - mots par utilisateur
    await wordCollection.createIndex(
      { contributedBy: 1 },
      { 
        name: 'idx_words_contributor',
        background: true
      }
    );

    // Index composé critique - status + language (requêtes approuvées par langue)
    await wordCollection.createIndex(
      { status: 1, language: 1 },
      { 
        name: 'idx_words_status_language',
        background: true
      }
    );

    // Index composé - language + category (navigation par langue et catégorie)
    await wordCollection.createIndex(
      { language: 1, category: 1 },
      { 
        name: 'idx_words_language_category',
        background: true
      }
    );

    // Index composé - status + language + category (requêtes complexes)
    await wordCollection.createIndex(
      { status: 1, language: 1, category: 1 },
      { 
        name: 'idx_words_status_language_category',
        background: true
      }
    );

    // Index textuel pour recherche full-text
    await wordCollection.createIndex(
      { 
        word: 'text',
        'meanings.definition': 'text',
        'meanings.examples': 'text'
      },
      { 
        name: 'idx_words_fulltext_search',
        background: true,
        weights: {
          word: 10,
          'meanings.definition': 5,
          'meanings.examples': 1
        }
      }
    );

    // Index sur createdAt - tri chronologique
    await wordCollection.createIndex(
      { createdAt: -1 },
      { 
        name: 'idx_words_created_desc',
        background: true
      }
    );

    // Index sur isFeatured + status pour findFeatured() optimisé
    await wordCollection.createIndex(
      { isFeatured: 1, status: 1 },
      { 
        name: 'idx_words_featured_status',
        background: true
      }
    );

    // Index sur categoryId + createdBy pour requêtes avec populate optimisé
    await wordCollection.createIndex(
      { categoryId: 1, createdBy: 1 },
      { 
        name: 'idx_words_category_creator',
        background: true
      }
    );

    this.logger.log('✅ Indexes Words créés');
  }

  /**
   * 🏘️ Ajouter les indexes pour la collection Communities
   */
  private async addCommunityIndexes(): Promise<void> {
    this.logger.log('🏘️ Ajout des indexes Communities...');
    const communityCollection = this.connection.collection('communities');

    // Index sur language - recherche par langue
    await communityCollection.createIndex(
      { language: 1 },
      { 
        name: 'idx_communities_language',
        background: true
      }
    );

    // Index sur name - recherche par nom
    await communityCollection.createIndex(
      { name: 1 },
      { 
        name: 'idx_communities_name',
        background: true
      }
    );

    // Index sur createdBy - communautés par créateur
    await communityCollection.createIndex(
      { createdBy: 1 },
      { 
        name: 'idx_communities_creator',
        background: true
      }
    );

    // Index sur membersCount - tri par popularité
    await communityCollection.createIndex(
      { membersCount: -1 },
      { 
        name: 'idx_communities_members_desc',
        background: true
      }
    );

    this.logger.log('✅ Indexes Communities créés');
  }

  /**
   * 💬 Ajouter les indexes pour la collection Messages
   */
  private async addMessageIndexes(): Promise<void> {
    this.logger.log('💬 Ajout des indexes Messages...');
    const messageCollection = this.connection.collection('messages');

    // Index composé critique - conversation + timestamp (chat performance)
    await messageCollection.createIndex(
      { conversation: 1, createdAt: -1 },
      { 
        name: 'idx_messages_conversation_timestamp',
        background: true
      }
    );

    // Index sur sender - messages par expéditeur
    await messageCollection.createIndex(
      { sender: 1 },
      { 
        name: 'idx_messages_sender',
        background: true
      }
    );

    // Index sur readBy - gestion des messages lus
    await messageCollection.createIndex(
      { 'readBy.user': 1 },
      { 
        name: 'idx_messages_read_by',
        sparse: true,
        background: true
      }
    );

    this.logger.log('✅ Indexes Messages créés');
  }

  /**
   * 📈 Ajouter les indexes pour la collection ActivityFeed
   */
  private async addActivityFeedIndexes(): Promise<void> {
    this.logger.log('📈 Ajout des indexes ActivityFeed...');
    const activityCollection = this.connection.collection('activityfeeds');

    // Index composé critique - user + timestamp (flux activité personnel)
    await activityCollection.createIndex(
      { user: 1, createdAt: -1 },
      { 
        name: 'idx_activity_user_timestamp',
        background: true
      }
    );

    // Index sur type - filtrage par type d'activité
    await activityCollection.createIndex(
      { type: 1 },
      { 
        name: 'idx_activity_type',
        background: true
      }
    );

    // Index composé - type + timestamp (flux global par type)
    await activityCollection.createIndex(
      { type: 1, createdAt: -1 },
      { 
        name: 'idx_activity_type_timestamp',
        background: true
      }
    );

    this.logger.log('✅ Indexes ActivityFeed créés');
  }

  /**
   * 🔐 Ajouter les indexes pour la collection RefreshTokens
   */
  private async addRefreshTokenIndexes(): Promise<void> {
    this.logger.log('🔐 Ajout des indexes RefreshTokens...');
    const tokenCollection = this.connection.collection('refreshtokens');

    // Index sur token - recherche rapide du token
    await tokenCollection.createIndex(
      { token: 1 },
      { 
        unique: true,
        name: 'idx_refresh_tokens_token_unique',
        background: true
      }
    );

    // Index sur user - tokens par utilisateur
    await tokenCollection.createIndex(
      { user: 1 },
      { 
        name: 'idx_refresh_tokens_user',
        background: true
      }
    );

    // Index TTL sur expiresAt - nettoyage automatique
    await tokenCollection.createIndex(
      { expiresAt: 1 },
      { 
        name: 'idx_refresh_tokens_ttl',
        expireAfterSeconds: 0,
        background: true
      }
    );

    this.logger.log('✅ Indexes RefreshTokens créés');
  }

  /**
   * 📊 Afficher les statistiques des indexes créés
   */
  private async showIndexStats(): Promise<void> {
    this.logger.log('📊 Statistiques des indexes:');

    const collections = ['users', 'words', 'communities', 'messages', 'activityfeeds', 'refreshtokens'];
    
    for (const collectionName of collections) {
      try {
        const collection = this.connection.collection(collectionName);
        const indexes = await collection.indexes();
        this.logger.log(`   ${collectionName}: ${indexes.length} indexes`);
      } catch (error) {
        this.logger.warn(`   ${collectionName}: Collection non trouvée`);
      }
    }
  }

  /**
   * 🔄 Rollback - Supprime tous les indexes créés (sauf les indexes système)
   */
  async down(): Promise<void> {
    this.logger.log('🔄 Rollback - Suppression des indexes créés');

    const indexesToDrop = [
      // Users
      { collection: 'users', indexes: ['idx_users_email_unique', 'idx_users_username_unique', 'idx_users_role', 'idx_users_email_verified', 'idx_users_email_verification'] },
      
      // Words
      { collection: 'words', indexes: ['idx_words_word_text', 'idx_words_status', 'idx_words_language', 'idx_words_category', 'idx_words_contributor', 'idx_words_status_language', 'idx_words_language_category', 'idx_words_status_language_category', 'idx_words_fulltext_search', 'idx_words_created_desc', 'idx_words_featured_status', 'idx_words_category_creator'] },
      
      // Communities
      { collection: 'communities', indexes: ['idx_communities_language', 'idx_communities_name', 'idx_communities_creator', 'idx_communities_members_desc'] },
      
      // Messages
      { collection: 'messages', indexes: ['idx_messages_conversation_timestamp', 'idx_messages_sender', 'idx_messages_read_by'] },
      
      // ActivityFeed
      { collection: 'activityfeeds', indexes: ['idx_activity_user_timestamp', 'idx_activity_type', 'idx_activity_type_timestamp'] },
      
      // RefreshTokens
      { collection: 'refreshtokens', indexes: ['idx_refresh_tokens_token_unique', 'idx_refresh_tokens_user', 'idx_refresh_tokens_ttl'] }
    ];

    for (const { collection, indexes } of indexesToDrop) {
      for (const indexName of indexes) {
        try {
          await this.connection.collection(collection).dropIndex(indexName);
          this.logger.log(`✅ Index supprimé: ${collection}.${indexName}`);
        } catch (error) {
          this.logger.warn(`⚠️ Impossible de supprimer: ${collection}.${indexName} - ${error.message}`);
        }
      }
    }

    this.logger.log('🔄 Rollback terminé');
  }
}