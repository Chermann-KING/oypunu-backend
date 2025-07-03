import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Language } from '../../languages/schemas/language.schema';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  // NOUVEAU: Référence vers la collection Languages
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Language', index: true })
  languageId?: Language;

  // DURANT LA MIGRATION: Ancien champ pour compatibilité (à supprimer après migration)
  @Prop({ index: true })
  language?: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
