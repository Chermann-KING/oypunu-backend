import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { ActivityFeed, ActivityFeedSchema } from '../common/schemas/activity-feed.schema';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { WordView, WordViewSchema } from './schemas/word-view.schema';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ActivityFeed.name, schema: ActivityFeedSchema },
      { name: Word.name, schema: WordSchema },
      { name: WordView.name, schema: WordViewSchema }
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UsersService,
  ],
})
export class UsersModule {}
