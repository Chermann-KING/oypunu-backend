import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Language, LanguageSchema } from './schemas/language.schema';
import { Word, WordSchema } from '../dictionary/schemas/word.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { LanguagesService } from './services/languages.service';
import { LanguagesController } from './controllers/languages.controller';
import { LanguageMigrationService } from './migration/language-migration.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Language.name, schema: LanguageSchema },
      { name: Word.name, schema: WordSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [LanguagesController],
  providers: [LanguagesService, LanguageMigrationService],
  exports: [LanguagesService, LanguageMigrationService],
})
export class LanguagesModule {}