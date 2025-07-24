import { Module } from '@nestjs/common';
import { ActivityService } from './services/activity.service';
import { ActivityGateway } from './gateways/activity.gateway';
import { ActivityController } from './controllers/activity.controller';
import { RepositoriesModule } from '../repositories/repositories.module';

@Module({
  imports: [
    RepositoriesModule,
  ],
  controllers: [ActivityController],
  providers: [ActivityService, ActivityGateway],
  exports: [ActivityService],
})
export class ActivityModule {}
