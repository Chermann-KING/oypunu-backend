import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Word.name, schema: WordSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
