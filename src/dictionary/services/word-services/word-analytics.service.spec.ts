import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WordAnalyticsService } from './word-analytics.service';
import { Word } from '../../schemas/word.schema';
import { WordView } from '../../../users/schemas/word-view.schema';

describe('WordAnalyticsService', () => {
  let service: WordAnalyticsService;
  let mockWordModel: any;
  let mockWordViewModel: any;

  const mockWord = {
    _id: '507f1f77bcf86cd799439011',
    word: 'test',
    language: 'fr',
    status: 'approved',
  };

  beforeEach(async () => {
    mockWordModel = {
      countDocuments: jest.fn(),
      findById: jest.fn(),
      aggregate: jest.fn(),
    };

    // Mock the WordView model constructor and methods
    const mockSave = jest.fn().mockResolvedValue({ _id: 'new-view-id' });
    
    mockWordViewModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: mockSave,
    }));
    
    // Add static methods to the constructor
    mockWordViewModel.findOne = jest.fn();
    mockWordViewModel.distinct = jest.fn();
    mockWordViewModel.aggregate = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordAnalyticsService,
        {
          provide: getModelToken(Word.name),
          useValue: mockWordModel,
        },
        {
          provide: getModelToken(WordView.name),
          useValue: mockWordViewModel,
        },
      ],
    }).compile();

    service = module.get<WordAnalyticsService>(WordAnalyticsService);
  });

  describe('getApprovedWordsCount', () => {
    it('should return approved words count', async () => {
      mockWordModel.countDocuments.mockResolvedValue(150);

      const result = await service.getApprovedWordsCount();

      expect(result).toBe(150);
      expect(mockWordModel.countDocuments).toHaveBeenCalledWith({ status: 'approved' });
    });
  });

  describe('getWordsAddedToday', () => {
    it('should return words added today count', async () => {
      mockWordModel.countDocuments.mockResolvedValue(5);

      const result = await service.getWordsAddedToday();

      expect(result).toBe(5);
      expect(mockWordModel.countDocuments).toHaveBeenCalledWith({
        createdAt: expect.any(Object),
      });
    });
  });

  describe('getWordsStatistics', () => {
    it('should return complete words statistics', async () => {
      // Mock Promise.all results in order
      mockWordModel.countDocuments.mockReturnValue({
        exec: jest.fn()
          .mockResolvedValueOnce(1000) // totalApprovedWords
          .mockResolvedValueOnce(10)   // wordsAddedToday  
          .mockResolvedValueOnce(50)   // wordsAddedThisWeek
          .mockResolvedValueOnce(200)  // wordsAddedThisMonth
      });

      const result = await service.getWordsStatistics();

      expect(result).toEqual({
        totalApprovedWords: 1000,
        wordsAddedToday: 10,
        wordsAddedThisWeek: 50,
        wordsAddedThisMonth: 200,
      });
    });
  });

  describe('trackWordView', () => {
    it('should create new view when no existing view found', async () => {
      mockWordModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockWord),
      });
      
      mockWordViewModel.findOne.mockResolvedValue(null); // No existing view

      await service.trackWordView('wordId123', 'userId123', 'detail');

      expect(mockWordModel.findById).toHaveBeenCalledWith('wordId123');
      expect(mockWordViewModel.findOne).toHaveBeenCalled();
      expect(mockWordViewModel).toHaveBeenCalled();
    });

    it('should update existing view when found', async () => {
      mockWordModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockWord),
      });

      const existingView = {
        viewCount: 1,
        save: jest.fn().mockResolvedValue({}),
      };
      mockWordViewModel.findOne.mockResolvedValue(existingView);

      await service.trackWordView('wordId123', 'userId123', 'detail');

      expect(existingView.viewCount).toBe(2);
      expect(existingView.save).toHaveBeenCalled();
    });

    it('should handle word not found gracefully', async () => {
      mockWordModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      // Should not throw
      await expect(service.trackWordView('invalid-id', 'userId123')).resolves.toBeUndefined();
    });
  });

  describe('getWordViewStats', () => {
    it('should return complete view statistics', async () => {
      mockWordViewModel.aggregate
        .mockResolvedValueOnce([{ total: 100 }]) // totalViews
        .mockResolvedValueOnce([{ total: 5 }])   // viewsToday
        .mockResolvedValueOnce([              // viewsByType
          { _id: 'detail', count: 80 },
          { _id: 'search', count: 20 },
        ]);
      
      mockWordViewModel.distinct.mockResolvedValue(['user1', 'user2', 'user3']);

      const result = await service.getWordViewStats('wordId123');

      expect(result).toEqual({
        totalViews: 100,
        uniqueUsers: 3,
        viewsToday: 5,
        viewsByType: {
          detail: 80,
          search: 20,
        },
      });
    });
  });

  describe('getMostViewedWords', () => {
    it('should return most viewed words', async () => {
      const mockResults = [
        {
          word: 'bonjour',
          language: 'fr',
          totalViews: 150,
          uniqueUsers: 50,
        },
        {
          word: 'hello',
          language: 'en',
          totalViews: 120,
          uniqueUsers: 40,
        },
      ];

      mockWordViewModel.aggregate.mockResolvedValue(mockResults);

      const result = await service.getMostViewedWords(5);

      expect(result).toEqual(mockResults);
      expect(mockWordViewModel.aggregate).toHaveBeenCalledWith([
        expect.objectContaining({ $group: expect.any(Object) }),
        expect.objectContaining({ $project: expect.any(Object) }),
        expect.objectContaining({ $sort: { totalViews: -1 } }),
        expect.objectContaining({ $limit: 5 }),
      ]);
    });
  });
});