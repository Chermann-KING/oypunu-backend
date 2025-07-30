import { TranslationGroup } from '../../translation/schemas/translation-group.schema';

export interface ITranslationGroupRepository {
  create(group: Partial<TranslationGroup>): Promise<TranslationGroup>;
  findById(id: string): Promise<TranslationGroup | null>;
  findByConceptId(conceptId: string): Promise<TranslationGroup | null>;
  findByPrimaryWord(primaryWord: string, primaryLanguage: string): Promise<TranslationGroup | null>;
  findByCategory(categoryId: string, options?: {
    limit?: number;
    offset?: number;
    sortBy?: 'qualityScore' | 'totalTranslations' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<TranslationGroup[]>;
  findBySense(senseDescription: string, partOfSpeech?: string): Promise<TranslationGroup[]>;
  findByKeywords(keywords: string[], minMatches?: number): Promise<TranslationGroup[]>;
  findRelatedConcepts(conceptId: string, limit?: number): Promise<TranslationGroup[]>;
  updateQualityScore(id: string, newScore: number): Promise<TranslationGroup | null>;
  updateTranslationCount(id: string, increment: number): Promise<TranslationGroup | null>;
  addSense(id: string, sense: any): Promise<TranslationGroup | null>;
  updateSense(id: string, senseId: string, updates: Partial<any>): Promise<TranslationGroup | null>;
  addRelatedConcept(id: string, relatedConceptId: string): Promise<TranslationGroup | null>;
  delete(id: string): Promise<boolean>;
  getHighQualityGroups(minScore?: number, limit?: number): Promise<TranslationGroup[]>;
  searchByText(searchText: string, language?: string): Promise<TranslationGroup[]>;
}