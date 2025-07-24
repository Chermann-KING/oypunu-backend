import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { RefreshToken, RefreshTokenSchema } from '../auth/schemas/refresh-token.schema';
import { ActivityFeed, ActivityFeedSchema } from '../common/schemas/activity-feed.schema';
import { Language, LanguageSchema } from '../languages/schemas/language.schema';
import { Category, CategorySchema } from '../dictionary/schemas/category.schema';
import { Message, MessageSchema } from '../messaging/schemas/message.schema';
import { Conversation, ConversationSchema } from '../messaging/schemas/conversation.schema';
import { Community, CommunitySchema } from '../communities/schemas/community.schema';
import { CommunityMember, CommunityMemberSchema } from '../communities/schemas/community-member.schema';
import { CommunityPost, CommunityPostSchema } from '../communities/schemas/community-post.schema';
import { PostComment, PostCommentSchema } from '../communities/schemas/post-comment.schema';
import { Vote, VoteSchema } from '../communities/schemas/vote.schema';
import { UserRepository } from './implementations/user.repository';
import { WordRepository } from './implementations/word.repository';
import { RefreshTokenRepository } from './implementations/refresh-token.repository';
import { ActivityFeedRepository } from './implementations/activity-feed.repository';
import { LanguageRepository } from './implementations/language.repository';
import { CategoryRepository } from './implementations/category.repository';
import { MessageRepository } from './implementations/message.repository';
import { ConversationRepository } from './implementations/conversation.repository';
import { CommunityRepository } from './implementations/community.repository';
import { CommunityMemberRepository } from './implementations/community-member.repository';
import { CommunityPostRepository } from './implementations/community-post.repository';
import { PostCommentRepository } from './implementations/post-comment.repository';
import { VoteRepository } from './implementations/vote.repository';
import { IUserRepository } from './interfaces/user.repository.interface';
import { IWordRepository } from './interfaces/word.repository.interface';
import { IRefreshTokenRepository } from './interfaces/refresh-token.repository.interface';
import { IActivityFeedRepository } from './interfaces/activity-feed.repository.interface';
import { ILanguageRepository } from './interfaces/language.repository.interface';
import { ICategoryRepository } from './interfaces/category.repository.interface';
import { IMessageRepository } from './interfaces/message.repository.interface';
import { IConversationRepository } from './interfaces/conversation.repository.interface';
import { ICommunityRepository } from './interfaces/community.repository.interface';
import { ICommunityMemberRepository } from './interfaces/community-member.repository.interface';
import { ICommunityPostRepository } from './interfaces/community-post.repository.interface';
import { IPostCommentRepository } from './interfaces/post-comment.repository.interface';
import { IVoteRepository } from './interfaces/vote.repository.interface';

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
      { name: Language.name, schema: LanguageSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Community.name, schema: CommunitySchema },
      { name: CommunityMember.name, schema: CommunityMemberSchema },
      { name: CommunityPost.name, schema: CommunityPostSchema },
      { name: PostComment.name, schema: PostCommentSchema },
      { name: Vote.name, schema: VoteSchema },
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
    // Liaison interface -> implémentation pour LanguageRepository
    {
      provide: 'ILanguageRepository',
      useClass: LanguageRepository,
    },
    // Liaison interface -> implémentation pour CategoryRepository
    {
      provide: 'ICategoryRepository',
      useClass: CategoryRepository,
    },
    // Liaison interface -> implémentation pour MessageRepository
    {
      provide: 'IMessageRepository',
      useClass: MessageRepository,
    },
    // Liaison interface -> implémentation pour ConversationRepository
    {
      provide: 'IConversationRepository',
      useClass: ConversationRepository,
    },
    // Liaison interface -> implémentation pour CommunityRepository
    {
      provide: 'ICommunityRepository',
      useClass: CommunityRepository,
    },
    // Liaison interface -> implémentation pour CommunityMemberRepository
    {
      provide: 'ICommunityMemberRepository',
      useClass: CommunityMemberRepository,
    },
    // Liaison interface -> implémentation pour CommunityPostRepository
    {
      provide: 'ICommunityPostRepository',
      useClass: CommunityPostRepository,
    },
    // Liaison interface -> implémentation pour PostCommentRepository
    {
      provide: 'IPostCommentRepository',
      useClass: PostCommentRepository,
    },
    // Liaison interface -> implémentation pour VoteRepository
    {
      provide: 'IVoteRepository',
      useClass: VoteRepository,
    },
    // Export direct des classes pour compatibilité
    UserRepository,
    WordRepository,
    RefreshTokenRepository,
    ActivityFeedRepository,
    LanguageRepository,
    CategoryRepository,
    MessageRepository,
    ConversationRepository,
    CommunityRepository,
    CommunityMemberRepository,
    CommunityPostRepository,
    PostCommentRepository,
    VoteRepository,
  ],
  exports: [
    'IUserRepository',
    'IWordRepository',
    'IRefreshTokenRepository',
    'IActivityFeedRepository',
    'ILanguageRepository',
    'ICategoryRepository',
    'IMessageRepository',
    'IConversationRepository',
    'ICommunityRepository',
    'ICommunityMemberRepository',
    'ICommunityPostRepository',
    'IPostCommentRepository',
    'IVoteRepository',
    UserRepository,
    WordRepository,
    RefreshTokenRepository,
    ActivityFeedRepository,
    LanguageRepository,
    CategoryRepository,
    MessageRepository,
    ConversationRepository,
    CommunityRepository,
    CommunityMemberRepository,
    CommunityPostRepository,
    PostCommentRepository,
    VoteRepository,
  ],
})
export class RepositoriesModule {}