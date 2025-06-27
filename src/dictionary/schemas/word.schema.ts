import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Category } from './category.schema';

export type WordDocument = Word & Document;

@Schema()
export class Definition {
  @Prop({ required: true })
  definition: string;

  @Prop({ type: [String], default: [] })
  examples: string[];

  @Prop()
  sourceUrl?: string;
}

@Schema()
export class Phonetic {
  @Prop({ required: true })
  text: string;

  @Prop({
    type: {
      url: { type: String },
      cloudinaryId: { type: String },
      format: { type: String },
      duration: { type: Number },
    },
  })
  audio?: {
    url: string;
    cloudinaryId: string;
    format: string;
    duration: number;
  };

  @Prop()
  sourceUrl?: string;
}

@Schema()
export class Meaning {
  @Prop({ required: true })
  partOfSpeech: string;

  @Prop({ type: [Definition], default: [] })
  definitions: Definition[];

  @Prop({ type: [String], default: [] })
  synonyms: string[];

  @Prop({ type: [String], default: [] })
  antonyms: string[];

  @Prop({ type: [String], default: [] })
  examples: string[];

  @Prop({ type: [Phonetic], default: [] })
  phonetics: Phonetic[];
}

@Schema()
export class Translation {
  @Prop({ required: true })
  language: string;

  @Prop({ required: true })
  translatedWord: string;

  @Prop({ type: [String], default: [] })
  context: string[];

  @Prop({ type: Number, default: 0 })
  confidence: number;

  @Prop({ type: [String], default: [] })
  verifiedBy: string[];
}

@Schema({ timestamps: true })
export class Word {
  @Prop({ required: true, index: true })
  word: string;

  @Prop({ required: true, index: true })
  language: string;

  @Prop()
  pronunciation?: string;

  @Prop()
  etymology?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category' })
  categoryId?: Category;

  @Prop({ type: [Meaning], default: [] })
  meanings: Meaning[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  createdBy?: User;

  @Prop({ default: 'pending', enum: ['approved', 'pending', 'rejected'] })
  status: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  // @Prop({ type: Map, of: String })
  @Prop({
    type: Map,
    of: new MongooseSchema(
      {
        url: { type: String },
        cloudinaryId: { type: String },
        language: { type: String },
        accent: { type: String },
      },
      { _id: false },
    ),
    default: {},
  })
  audioFiles: Map<
    string,
    {
      url: string;
      cloudinaryId: string;
      language: string;
      accent: string;
    }
  >;

  @Prop({ type: [Translation], default: [] })
  translations: Translation[];

  @Prop({ type: Map, of: String })
  languageVariants: Map<string, string>;
}

export const WordSchema = SchemaFactory.createForClass(Word);
// Ajouter des index composites pour améliorer les performances de recherche
WordSchema.index({ word: 'text', language: 1 });
