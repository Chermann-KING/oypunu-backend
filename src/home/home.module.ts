import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { RepositoriesModule } from '../repositories/repositories.module';

@Module({
  imports: [
    RepositoriesModule,
  ],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
