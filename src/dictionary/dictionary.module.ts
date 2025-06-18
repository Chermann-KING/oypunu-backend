import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Schémas
import { Word, WordSchema } from './schemas/word.schema';
import { Category, CategorySchema } from './schemas/category.schema';
import {
  FavoriteWord,
  FavoriteWordSchema,
} from './schemas/favorite-word.schema';

// Services
import { WordsService } from './services/words.service';
import { CategoriesService } from './services/categories.service';

// Contrôleurs
import { WordsController } from './controllers/words.controller';
import { CategoriesController } from './controllers/categories.controller';
import { FavoriteWordsController } from './controllers/favorite-words.controller';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Word.name, schema: WordSchema },
      { name: Category.name, schema: CategorySchema },
      { name: FavoriteWord.name, schema: FavoriteWordSchema },
    ]),
    UsersModule,
  ],
  controllers: [WordsController, CategoriesController, FavoriteWordsController],
  providers: [WordsService, CategoriesService],
  exports: [WordsService, CategoriesService],
})
export class DictionaryModule {}
