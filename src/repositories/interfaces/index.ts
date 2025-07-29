/**
 * 📦 INDEX DES INTERFACES REPOSITORY
 *
 * Export centralisé des contrats abstraits des repositories.
 * Ces interfaces définissent les méthodes que doivent implémenter les repositories concrets.
 */

export { IUserRepository } from "./user.repository.interface";
export { IWordRepository } from "./word.repository.interface";
export { IRefreshTokenRepository } from "./refresh-token.repository.interface";
export { IActivityFeedRepository } from "./activity-feed.repository.interface";
export { ILanguageRepository } from "./language.repository.interface";
export { ICategoryRepository } from "./category.repository.interface";
export { IMessageRepository } from "./message.repository.interface";
export { IConversationRepository } from "./conversation.repository.interface";
export { ICommunityRepository } from "./community.repository.interface";
export { ICommunityMemberRepository } from "./community-member.repository.interface";
export { IVoteRepository } from "./vote.repository.interface";
export {
  IRevisionHistoryRepository,
  CreateRevisionData,
} from "./revision-history.repository.interface";
