import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Community, CommunitySchema } from './schemas/community.schema';
import { CommunityMember, CommunityMemberSchema } from './schemas/community-member.schema';
import { CommunityPost, CommunityPostSchema } from './schemas/community-post.schema';
import { PostComment, PostCommentSchema } from './schemas/post-comment.schema';
import { Vote, VoteSchema } from './schemas/vote.schema';
import { CommunitiesController } from './controllers/communities.controller';
import { CommunityPostsController } from './controllers/community-posts.controller';
import { CommunitiesService } from './services/communities.service';
import { CommunityPostsService } from './services/community-posts.service';
import { VotingService } from './services/voting.service';
import { UsersModule } from '../users/users.module';
import { RepositoriesModule } from '../repositories/repositories.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Community.name, schema: CommunitySchema },
      { name: CommunityMember.name, schema: CommunityMemberSchema },
      { name: CommunityPost.name, schema: CommunityPostSchema },
      { name: PostComment.name, schema: PostCommentSchema },
      { name: Vote.name, schema: VoteSchema },
    ]),
    RepositoriesModule,
    UsersModule,
  ],
  controllers: [CommunitiesController, CommunityPostsController],
  providers: [CommunitiesService, CommunityPostsService, VotingService],
  exports: [CommunitiesService, CommunityPostsService, VotingService],
})
export class CommunitiesModule {}
