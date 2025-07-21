import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { WordTranslationService } from './word-translation.service';
import { Word } from '../../schemas/word.schema';
import { Types } from 'mongoose';

describe('WordTranslationService', () => {
  let service: WordTranslationService;
  let mockWordModel: any;

  const mockSourceWord = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    word: 'bonjour',
    language: 'fr',
    translations: [
      {
        translatedWord: 'hello',
        language: 'en',
        confidence: 0.9,
        context: ['greeting'],
        verifiedBy: [],
      },
    ],
    save: jest.fn().mockResolvedValue(true),
  };

  const mockTargetWord = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    word: 'hello',
    language: 'en',
    translations: [],
    translationCount: 0,
    save: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    mockWordModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordTranslationService,
        {
          provide: getModelToken(Word.name),
          useValue: mockWordModel,
        },
      ],
    }).compile();

    service = module.get<WordTranslationService>(WordTranslationService);
  });

  describe('createBidirectionalTranslations', () => {
    it('should create bidirectional translations successfully', async () => {
      mockWordModel.findOne.mockResolvedValue(mockTargetWord);
      
      await service.createBidirectionalTranslations(mockSourceWord as any, 'user-id');

      expect(mockWordModel.findOne).toHaveBeenCalledWith({
        language: 'en',
        word: 'hello',
      });
      expect(mockTargetWord.save).toHaveBeenCalled();
    });

    it('should handle target word not found gracefully', async () => {
      mockWordModel.findOne.mockResolvedValue(null);
      
      await expect(
        service.createBidirectionalTranslations(mockSourceWord as any, 'user-id')
      ).resolves.toBeUndefined();

      expect(mockWordModel.findOne).toHaveBeenCalled();
    });

    it('should skip existing reverse translations', async () => {
      const targetWordWithExistingTranslation = {
        ...mockTargetWord,
        translations: [
          {
            language: 'fr',
            translatedWord: 'bonjour',
          },
        ],
      };

      mockWordModel.findOne.mockResolvedValue(targetWordWithExistingTranslation);
      
      await service.createBidirectionalTranslations(mockSourceWord as any, 'user-id');

      expect(targetWordWithExistingTranslation.save).not.toHaveBeenCalled();
    });
  });

  describe('getAllTranslations', () => {
    it('should return both direct and reverse translations', async () => {
      const wordWithTranslations = {
        _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
        word: 'bonjour',
        language: 'fr',
        translations: [
          {
            _id: 'trans-1',
            translatedWord: 'hello',
            language: 'en',
            confidence: 0.9,
            context: ['greeting'],
            verifiedBy: [],
          },
        ],
      };

      const reverseWordsResult = [
        {
          _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
          word: 'hello',
          language: 'en',
          translations: [
            {
              _id: 'trans-2',
              translatedWord: 'bonjour',
              language: 'fr',
              targetWordId: new Types.ObjectId('507f1f77bcf86cd799439011'),
            },
          ],
        },
      ];

      mockWordModel.findById.mockResolvedValue(wordWithTranslations);
      mockWordModel.find.mockResolvedValue(reverseWordsResult);

      const result = await service.getAllTranslations('507f1f77bcf86cd799439011');

      expect(result.directTranslations).toHaveLength(1);
      expect(result.reverseTranslations).toHaveLength(1);
      expect(result.allTranslations).toHaveLength(2);
      expect(result.directTranslations[0].direction).toBe('direct');
      expect(result.reverseTranslations[0].direction).toBe('reverse');
    });

    it('should throw NotFoundException for non-existent word', async () => {
      mockWordModel.findById.mockResolvedValue(null);

      await expect(
        service.getAllTranslations('invalid-id')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateBidirectionalConsistency', () => {
    it('should identify missing reverse translations', async () => {
      const wordWithTranslations = {
        _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
        word: 'bonjour',
        language: 'fr',
        translations: [
          {
            translatedWord: 'hello',
            language: 'en',
            targetWordId: new Types.ObjectId('507f1f77bcf86cd799439012'),
          },
        ],
      };

      mockWordModel.findById.mockResolvedValue(wordWithTranslations);
      mockWordModel.find.mockResolvedValue([]); // No reverse translations

      const result = await service.validateBidirectionalConsistency('507f1f77bcf86cd799439011');

      expect(result.isConsistent).toBe(false);
      expect(result.missingReverse).toHaveLength(1);
      expect(result.suggestions).toContain('1 traduction(s) inverse(s) manquante(s)');
    });

    it('should validate targetWordId links', async () => {
      const wordWithBrokenLink = {
        _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
        word: 'bonjour',
        language: 'fr',
        translations: [
          {
            translatedWord: 'hello',
            language: 'en',
            targetWordId: new Types.ObjectId('507f1f77bcf86cd799439999'), // Non-existent
          },
        ],
      };

      mockWordModel.findById
        .mockResolvedValueOnce(wordWithBrokenLink) // For getAllTranslations
        .mockResolvedValueOnce(null); // For targetWordId validation
      mockWordModel.find.mockResolvedValue([]);

      const result = await service.validateBidirectionalConsistency('507f1f77bcf86cd799439011');

      expect(result.isConsistent).toBe(false);
      expect(result.brokenLinks).toHaveLength(1);
      expect(result.suggestions).toContain('1 lien(s) targetWordId cassé(s)');
    });
  });

  describe('repairBidirectionalTranslations', () => {
    it('should repair translations and return count', async () => {
      const wordToRepair = {
        _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
        word: 'bonjour',
        translations: [
          { translatedWord: 'hello', language: 'en' },
          { translatedWord: 'hi', language: 'en' },
        ],
      };

      mockWordModel.findById.mockResolvedValue(wordToRepair);
      mockWordModel.findOne.mockResolvedValue(null); // No target words found

      const result = await service.repairBidirectionalTranslations('507f1f77bcf86cd799439011');

      expect(result.repaired).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should throw NotFoundException for non-existent word', async () => {
      mockWordModel.findById.mockResolvedValue(null);

      await expect(
        service.repairBidirectionalTranslations('invalid-id')
      ).rejects.toThrow(NotFoundException);
    });
  });
});