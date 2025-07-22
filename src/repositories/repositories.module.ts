import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { RefreshToken, RefreshTokenSchema } from '../auth/schemas/refresh-token.schema';
import { ActivityFeed, ActivityFeedSchema } from '../common/schemas/activity-feed.schema';
import { UserRepository } from './implementations/user.repository';
import { WordRepository } from './implementations/word.repository';
import { RefreshTokenRepository } from './implementations/refresh-token.repository';
import { ActivityFeedRepository } from './implementations/activity-feed.repository';
import { IUserRepository } from './interfaces/user.repository.interface';
import { IWordRepository } from './interfaces/word.repository.interface';
import { IRefreshTokenRepository } from './interfaces/refresh-token.repository.interface';
import { IActivityFeedRepository } from './interfaces/activity-feed.repository.interface';

/**
 * 🏭 MODULE DES REPOSITORIES
 * 
 * Module NestJS qui configure l'injection de dépendance pour les repositories.
 * Lie les interfaces abstraites aux implémentations concrètes.
 * 
 * Pattern utilisé : Repository Pattern avec Dependency Injection
 * - Services dépendent des interfaces (IUserRepository, IWordRepository)
 * - Module injecte les implémentations concrètes (UserRepository, WordRepository)
 * - Facilite les tests unitaires avec des mocks
 * - Permet le changement d'implémentation sans impact sur les services
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Word.name, schema: WordSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: ActivityFeed.name, schema: ActivityFeedSchema },
    ]),
  ],
  providers: [
    // Liaison interface -> implémentation pour UserRepository
    {
      provide: 'IUserRepository',
      useClass: UserRepository,
    },
    // Liaison interface -> implémentation pour WordRepository
    {
      provide: 'IWordRepository',
      useClass: WordRepository,
    },
    // Liaison interface -> implémentation pour RefreshTokenRepository
    {
      provide: 'IRefreshTokenRepository',
      useClass: RefreshTokenRepository,
    },
    // Liaison interface -> implémentation pour ActivityFeedRepository
    {
      provide: 'IActivityFeedRepository',
      useClass: ActivityFeedRepository,
    },
    // Export direct des classes pour compatibilité
    UserRepository,
    WordRepository,
    RefreshTokenRepository,
    ActivityFeedRepository,
  ],
  exports: [
    'IUserRepository',
    'IWordRepository',
    'IRefreshTokenRepository',
    'IActivityFeedRepository',
    UserRepository,
    WordRepository,
    RefreshTokenRepository,
    ActivityFeedRepository,
  ],
})
export class RepositoriesModule {}