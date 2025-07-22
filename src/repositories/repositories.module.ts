import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { UserRepository } from './implementations/user.repository';
import { WordRepository } from './implementations/word.repository';
import { IUserRepository } from './interfaces/user.repository.interface';
import { IWordRepository } from './interfaces/word.repository.interface';

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
    // Export direct des classes pour compatibilité
    UserRepository,
    WordRepository,
  ],
  exports: [
    'IUserRepository',
    'IWordRepository',
    UserRepository,
    WordRepository,
  ],
})
export class RepositoriesModule {}