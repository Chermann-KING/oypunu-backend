import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { ActivityFeed, ActivityFeedSchema } from '../common/schemas/activity-feed.schema';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { WordView, WordViewSchema } from './schemas/word-view.schema';
import { ContributorRequest, ContributorRequestSchema } from './schemas/contributor-request.schema';
import { FavoriteWord, FavoriteWordSchema } from '../dictionary/schemas/favorite-word.schema';
import { UsersController } from './controllers/users.controller';
import { ContributorRequestController } from './controllers/contributor-request.controller';
import { UsersService } from './services/users.service';
import { ContributorRequestService } from './services/contributor-request.service';
import { ContributorRequestListener } from './listeners/contributor-request.listener';
import { MailService } from '../common/services/mail.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ActivityFeed.name, schema: ActivityFeedSchema },
      { name: Word.name, schema: WordSchema },
      { name: WordView.name, schema: WordViewSchema },
      { name: ContributorRequest.name, schema: ContributorRequestSchema },
      { name: FavoriteWord.name, schema: FavoriteWordSchema }
    ]),
  ],
  controllers: [UsersController, ContributorRequestController],
  providers: [UsersService, ContributorRequestService, ContributorRequestListener, MailService],
  exports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UsersService,
    ContributorRequestService,
  ],
})
export class UsersModule {}
