import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityService } from './services/activity.service';
import { ActivityGateway } from './gateways/activity.gateway';
import { ActivityController } from './controllers/activity.controller';
import {
  ActivityFeed,
  ActivityFeedSchema,
} from './schemas/activity-feed.schema';
import { Language, LanguageSchema } from '../languages/schemas/language.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityFeed.name, schema: ActivityFeedSchema },
      { name: Language.name, schema: LanguageSchema },
    ]),
  ],
  controllers: [ActivityController],
  providers: [ActivityService, ActivityGateway],
  exports: [ActivityService],
})
export class ActivityModule {}
