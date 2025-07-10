import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';
import { AnalyticsService } from './services/analytics.service';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import {
  Community,
  CommunitySchema,
} from '../communities/schemas/community.schema';
import {
  CommunityMember,
  CommunityMemberSchema,
} from '../communities/schemas/community-member.schema';
import {
  CommunityPost,
  CommunityPostSchema,
} from '../communities/schemas/community-post.schema';
import { Message, MessageSchema } from '../messaging/schemas/message.schema';
import { ActivityFeed, ActivityFeedSchema } from '../common/schemas/activity-feed.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Word.name, schema: WordSchema },
      { name: Community.name, schema: CommunitySchema },
      { name: CommunityMember.name, schema: CommunityMemberSchema },
      { name: CommunityPost.name, schema: CommunityPostSchema },
      { name: Message.name, schema: MessageSchema },
      { name: ActivityFeed.name, schema: ActivityFeedSchema },
    ]),
    UsersModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AnalyticsService],
  exports: [AdminService, AnalyticsService],
})
export class AdminModule {}
