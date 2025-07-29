import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityService } from './services/activity.service';
import { QuotaService } from './services/quota.service';
import { ActivityGateway } from './gateways/activity.gateway';
import { ActivityController } from './controllers/activity.controller';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { RateLimitGuard, QuotaIncrementInterceptor } from './guards/rate-limit.guard';
import { RepositoriesModule } from '../repositories/repositories.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { SecurityModule } from '../auth/security/security.module';

@Module({
  imports: [
    RepositoriesModule,
    SecurityModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema }
    ])
  ],
  controllers: [ActivityController],
  providers: [
    ActivityService, 
    QuotaService,
    ActivityGateway, 
    RateLimitMiddleware,
    RateLimitGuard,
    QuotaIncrementInterceptor
  ],
  exports: [
    ActivityService, 
    QuotaService,
    RateLimitMiddleware,
    RateLimitGuard,
    QuotaIncrementInterceptor
  ],
})
export class ActivityModule {}
