import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Language, LanguageSchema } from '../languages/schemas/language.schema';
import { RepositoriesModule } from '../repositories/repositories.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Word.name, schema: WordSchema },
      { name: User.name, schema: UserSchema },
      { name: Language.name, schema: LanguageSchema },
    ]),
    RepositoriesModule,
  ],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
