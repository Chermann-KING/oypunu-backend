import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/schemas/user.schema";
import { WordView, WordViewSchema } from "../users/schemas/word-view.schema";
import { Word, WordSchema } from "../dictionary/schemas/word.schema";
import {
  RefreshToken,
  RefreshTokenSchema,
} from "../auth/schemas/refresh-token.schema";
import {
  ActivityFeed,
  ActivityFeedSchema,
} from "../common/schemas/activity-feed.schema";
import { Language, LanguageSchema } from "../languages/schemas/language.schema";
import {
  Category,
  CategorySchema,
} from "../dictionary/schemas/category.schema";
import { Message, MessageSchema } from "../messaging/schemas/message.schema";
import {
  Conversation,
  ConversationSchema,
} from "../messaging/schemas/conversation.schema";
import {
  Community,
  CommunitySchema,
} from "../communities/schemas/community.schema";
import {
  CommunityMember,
  CommunityMemberSchema,
} from "../communities/schemas/community-member.schema";
import {
  CommunityPost,
  CommunityPostSchema,
} from "../communities/schemas/community-post.schema";
import {
  PostComment,
  PostCommentSchema,
} from "../communities/schemas/post-comment.schema";
import { Vote, VoteSchema } from "../communities/schemas/vote.schema";
import { WordVote, WordVoteSchema } from "../social/schemas/word-vote.schema";
import {
  RevisionHistory,
  RevisionHistorySchema,
} from "../dictionary/schemas/revision-history.schema";
import {
  Competition,
  CompetitionSchema,
} from "../achievements/schemas/competition.schema";
import {
  FavoriteWord,
  FavoriteWordSchema,
} from "../dictionary/schemas/favorite-word.schema";
import {
  ContributorRequest,
  ContributorRequestSchema,
} from "../users/schemas/contributor-request.schema";
import { UserRepository } from "./implementations/user.repository";
import { WordViewRepository } from "./implementations/word-view.repository";
import { WordRepository } from "./implementations/word.repository";
import { RefreshTokenRepository } from "./implementations/refresh-token.repository";
import { ActivityFeedRepository } from "./implementations/activity-feed.repository";
import { LanguageRepository } from "./implementations/language.repository";
import { CategoryRepository } from "./implementations/category.repository";
import { MessageRepository } from "./implementations/message.repository";
import { ConversationRepository } from "./implementations/conversation.repository";
import { CommunityRepository } from "./implementations/community.repository";
import { CommunityMemberRepository } from "./implementations/community-member.repository";
import { CommunityPostRepository } from "./implementations/community-post.repository";
import { PostCommentRepository } from "./implementations/post-comment.repository";
import { VoteRepository } from "./implementations/vote.repository";
import { WordVoteRepository } from "./implementations/word-vote.repository";
import { RevisionHistoryRepository } from "./implementations/revision-history.repository";
import { CompetitionRepository } from "./implementations/competition.repository";
import { FavoriteWordRepository } from "./implementations/favorite-word.repository";
import { ContributorRequestRepository } from "./implementations/contributor-request.repository";
import { IUserRepository } from "./interfaces/user.repository.interface";
import { IWordViewRepository } from "./interfaces/word-view.repository.interface";
import { IWordRepository } from "./interfaces/word.repository.interface";
import { IRefreshTokenRepository } from "./interfaces/refresh-token.repository.interface";
import { IActivityFeedRepository } from "./interfaces/activity-feed.repository.interface";
import { ILanguageRepository } from "./interfaces/language.repository.interface";
import { ICategoryRepository } from "./interfaces/category.repository.interface";
import { IMessageRepository } from "./interfaces/message.repository.interface";
import { IConversationRepository } from "./interfaces/conversation.repository.interface";
import { ICommunityRepository } from "./interfaces/community.repository.interface";
import { ICommunityMemberRepository } from "./interfaces/community-member.repository.interface";
import { ICommunityPostRepository } from "./interfaces/community-post.repository.interface";
import { IPostCommentRepository } from "./interfaces/post-comment.repository.interface";
import { IVoteRepository } from "./interfaces/vote.repository.interface";
import { IWordVoteRepository } from "./interfaces/word-vote.repository.interface";
import { IRevisionHistoryRepository } from "./interfaces/revision-history.repository.interface";
import { ICompetitionRepository } from "./interfaces/competition.repository.interface";
import { IFavoriteWordRepository } from "./interfaces/favorite-word.repository.interface";
import { IContributorRequestRepository } from "./interfaces/contributor-request.repository.interface";
import { AuditLog, AuditLogSchema } from "../auth/schemas/audit-log.schema";
import { Like, LikeSchema } from "../communities/schemas/like.schema";
import { RecommendationCache, RecommendationCacheSchema } from "../recommendations/schemas/recommendation-cache.schema";
import { TrainingData, TrainingDataSchema } from "../translation/schemas/training-data.schema";
import { TranslationGroup, TranslationGroupSchema } from "../translation/schemas/translation-group.schema";
import { UserRecommendationProfile, UserRecommendationProfileSchema } from "../recommendations/schemas/user-recommendation-profile.schema";
import { WordNotification, WordNotificationSchema } from "../dictionary/schemas/word-notification.schema";
import { AuditLogRepository } from "./implementations/audit-log.repository";
import { LikeRepository } from "./implementations/like.repository";
import { RecommendationCacheRepository } from "./implementations/recommendation-cache.repository";
import { TrainingDataRepository } from "./implementations/training-data.repository";
import { TranslationGroupRepository } from "./implementations/translation-group.repository";
import { UserRecommendationProfileRepository } from "./implementations/user-recommendation-profile.repository";
import { WordNotificationRepository } from "./implementations/word-notification.repository";
import { IAuditLogRepository } from "./interfaces/audit-log.repository.interface";
import { ILikeRepository } from "./interfaces/like.repository.interface";
import { IRecommendationCacheRepository } from "./interfaces/recommendation-cache.repository.interface";
import { ITrainingDataRepository } from "./interfaces/training-data.repository.interface";
import { ITranslationGroupRepository } from "./interfaces/translation-group.repository.interface";
import { IUserRecommendationProfileRepository } from "./interfaces/user-recommendation-profile.repository.interface";
import { IWordNotificationRepository } from "./interfaces/word-notification.repository.interface";

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
      { name: WordView.name, schema: WordViewSchema },
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
      { name: WordVote.name, schema: WordVoteSchema },
      { name: RevisionHistory.name, schema: RevisionHistorySchema },
      { name: Competition.name, schema: CompetitionSchema },
      { name: FavoriteWord.name, schema: FavoriteWordSchema },
      { name: ContributorRequest.name, schema: ContributorRequestSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: Like.name, schema: LikeSchema },
      { name: RecommendationCache.name, schema: RecommendationCacheSchema },
      { name: TrainingData.name, schema: TrainingDataSchema },
      { name: TranslationGroup.name, schema: TranslationGroupSchema },
      { name: UserRecommendationProfile.name, schema: UserRecommendationProfileSchema },
      { name: WordNotification.name, schema: WordNotificationSchema },
    ]),
  ],
  providers: [
    // Liaison interface -> implémentation pour UserRepository
    {
      provide: "IUserRepository",
      useClass: UserRepository,
    },
    // Liaison interface -> implémentation pour WordViewRepository
    {
      provide: "IWordViewRepository",
      useClass: WordViewRepository,
    },
    // Liaison interface -> implémentation pour WordRepository
    {
      provide: "IWordRepository",
      useClass: WordRepository,
    },
    // Liaison interface -> implémentation pour RefreshTokenRepository
    {
      provide: "IRefreshTokenRepository",
      useClass: RefreshTokenRepository,
    },
    // Liaison interface -> implémentation pour ActivityFeedRepository
    {
      provide: "IActivityFeedRepository",
      useClass: ActivityFeedRepository,
    },
    // Liaison interface -> implémentation pour LanguageRepository
    {
      provide: "ILanguageRepository",
      useClass: LanguageRepository,
    },
    // Liaison interface -> implémentation pour CategoryRepository
    {
      provide: "ICategoryRepository",
      useClass: CategoryRepository,
    },
    // Liaison interface -> implémentation pour MessageRepository
    {
      provide: "IMessageRepository",
      useClass: MessageRepository,
    },
    // Liaison interface -> implémentation pour ConversationRepository
    {
      provide: "IConversationRepository",
      useClass: ConversationRepository,
    },
    // Liaison interface -> implémentation pour CommunityRepository
    {
      provide: "ICommunityRepository",
      useClass: CommunityRepository,
    },
    // Liaison interface -> implémentation pour CommunityMemberRepository
    {
      provide: "ICommunityMemberRepository",
      useClass: CommunityMemberRepository,
    },
    // Liaison interface -> implémentation pour CommunityPostRepository
    {
      provide: "ICommunityPostRepository",
      useClass: CommunityPostRepository,
    },
    // Liaison interface -> implémentation pour PostCommentRepository
    {
      provide: "IPostCommentRepository",
      useClass: PostCommentRepository,
    },
    // Liaison interface -> implémentation pour VoteRepository
    {
      provide: "IVoteRepository",
      useClass: VoteRepository,
    },
    // Liaison interface -> implémentation pour WordVoteRepository
    {
      provide: "IWordVoteRepository",
      useClass: WordVoteRepository,
    },
    // Liaison interface -> implémentation pour RevisionHistoryRepository
    {
      provide: "IRevisionHistoryRepository",
      useClass: RevisionHistoryRepository,
    },
    // Liaison interface -> implémentation pour CompetitionRepository
    {
      provide: "ICompetitionRepository",
      useClass: CompetitionRepository,
    },
    // Liaison interface -> implémentation pour FavoriteWordRepository
    {
      provide: "IFavoriteWordRepository",
      useClass: FavoriteWordRepository,
    },
    // Liaison interface -> implémentation pour ContributorRequestRepository
    {
      provide: "IContributorRequestRepository",
      useClass: ContributorRequestRepository,
    },
    // Liaison interface -> implémentation pour AuditLogRepository
    {
      provide: "IAuditLogRepository",
      useClass: AuditLogRepository,
    },
    // Liaison interface -> implémentation pour LikeRepository
    {
      provide: "ILikeRepository",
      useClass: LikeRepository,
    },
    // Liaison interface -> implémentation pour RecommendationCacheRepository
    {
      provide: "IRecommendationCacheRepository",
      useClass: RecommendationCacheRepository,
    },
    // Liaison interface -> implémentation pour TrainingDataRepository
    {
      provide: "ITrainingDataRepository",
      useClass: TrainingDataRepository,
    },
    // Liaison interface -> implémentation pour TranslationGroupRepository
    {
      provide: "ITranslationGroupRepository",
      useClass: TranslationGroupRepository,
    },
    // Liaison interface -> implémentation pour UserRecommendationProfileRepository
    {
      provide: "IUserRecommendationProfileRepository",
      useClass: UserRecommendationProfileRepository,
    },
    // Liaison interface -> implémentation pour WordNotificationRepository
    {
      provide: "IWordNotificationRepository",
      useClass: WordNotificationRepository,
    },
    // Exports directs pour les tests et utilisations directes
    UserRepository,
    WordViewRepository,
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
    WordVoteRepository,
    RevisionHistoryRepository,
    CompetitionRepository,
    FavoriteWordRepository,
    ContributorRequestRepository,
    AuditLogRepository,
    LikeRepository,
    RecommendationCacheRepository,
    TrainingDataRepository,
    TranslationGroupRepository,
    UserRecommendationProfileRepository,
    WordNotificationRepository,
  ],
  exports: [
    "IUserRepository",
    "IWordViewRepository",
    "IWordRepository",
    "IRefreshTokenRepository",
    "IActivityFeedRepository",
    "ILanguageRepository",
    "ICategoryRepository",
    "IMessageRepository",
    "IConversationRepository",
    "ICommunityRepository",
    "ICommunityMemberRepository",
    "ICommunityPostRepository",
    "IPostCommentRepository",
    "IVoteRepository",
    "IWordVoteRepository",
    "IRevisionHistoryRepository",
    "ICompetitionRepository",
    "IFavoriteWordRepository",
    "IContributorRequestRepository",
    "IAuditLogRepository",
    "ILikeRepository",
    "IRecommendationCacheRepository",
    "ITrainingDataRepository",
    "ITranslationGroupRepository",
    "IUserRecommendationProfileRepository",
    "IWordNotificationRepository",
    UserRepository,
    WordViewRepository,
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
    WordVoteRepository,
    RevisionHistoryRepository,
    CompetitionRepository,
    FavoriteWordRepository,
    ContributorRequestRepository,
    AuditLogRepository,
    LikeRepository,
    RecommendationCacheRepository,
    TrainingDataRepository,
    TranslationGroupRepository,
    UserRecommendationProfileRepository,
    WordNotificationRepository,
  ],
})
export class RepositoriesModule {}
