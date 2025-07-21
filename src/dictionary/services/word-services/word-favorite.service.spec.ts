import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WordFavoriteService } from './word-favorite.service';
import { Word } from '../../schemas/word.schema';
import { FavoriteWord } from '../../schemas/favorite-word.schema';
import { User, UserRole } from '../../../users/schemas/user.schema';
import { ActivityService } from '../../../common/services/activity.service';
import { WordPermissionService } from './word-permission.service';

describe('WordFavoriteService', () => {
  let service: WordFavoriteService;
  let mockWordModel: any;
  let mockFavoriteWordModel: any;
  let mockUserModel: any;
  let mockActivityService: any;
  let mockWordPermissionService: any;

  const mockUser: User = {
    _id: '507f1f77bcf86cd799439011',
    username: 'testuser',
    email: 'test@example.com',
    role: UserRole.USER,
    isActive: true,
  } as User;

  const mockWord = {
    _id: '507f1f77bcf86cd799439012',
    word: 'test',
    language: 'fr',
    status: 'approved',
  };

  const mockFavorite = {
    _id: '507f1f77bcf86cd799439013',
    wordId: '507f1f77bcf86cd799439012',
    userId: '507f1f77bcf86cd799439011',
    addedAt: new Date(),
  };

  beforeEach(async () => {
    mockWordModel = {
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };

    mockFavoriteWordModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    // Mock constructor pattern
    mockFavoriteWordModel.constructor = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ ...data, _id: 'new-favorite-id' }),
    }));

    // Make the constructor callable as a function
    Object.setPrototypeOf(mockFavoriteWordModel, Function.prototype);
    mockFavoriteWordModel.prototype = {};

    mockUserModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
    };

    mockActivityService = {
      recordActivity: jest.fn(),
    };

    mockWordPermissionService = {
      canUserAddToFavorites: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordFavoriteService,
        {
          provide: getModelToken(Word.name),
          useValue: mockWordModel,
        },
        {
          provide: getModelToken(FavoriteWord.name),
          useValue: mockFavoriteWordModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: ActivityService,
          useValue: mockActivityService,
        },
        {
          provide: WordPermissionService,
          useValue: mockWordPermissionService,
        },
      ],
    }).compile();

    service = module.get<WordFavoriteService>(WordFavoriteService);
  });

  describe('addToFavorites', () => {
    it('should add word to favorites successfully', async () => {
      mockWordModel.findById.mockResolvedValue(mockWord);
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockWordPermissionService.canUserAddToFavorites.mockResolvedValue(true);
      mockFavoriteWordModel.findOne.mockResolvedValue(null); // Not already favorite
      
      // Mock the constructor call
      const saveMock = jest.fn().mockResolvedValue(mockFavorite);
      mockFavoriteWordModel.mockImplementation(() => ({
        save: saveMock,
      }));

      const result = await service.addToFavorites(mockWord._id, mockUser._id);

      expect(result.success).toBe(true);
      expect(mockWordModel.findById).toHaveBeenCalledWith(mockWord._id);
      expect(mockUserModel.findById).toHaveBeenCalledWith(mockUser._id);
      expect(mockWordPermissionService.canUserAddToFavorites).toHaveBeenCalled();
      expect(saveMock).toHaveBeenCalled();
    });

    it('should return success if word is already in favorites', async () => {
      mockWordModel.findById.mockResolvedValue(mockWord);
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockWordPermissionService.canUserAddToFavorites.mockResolvedValue(true);
      mockFavoriteWordModel.findOne.mockResolvedValue(mockFavorite); // Already favorite

      const result = await service.addToFavorites(mockWord._id, mockUser._id);

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException for invalid word ID', async () => {
      mockWordModel.findById.mockResolvedValue(null);

      await expect(
        service.addToFavorites('invalid-word-id', mockUser._id)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid user ID', async () => {
      await expect(
        service.addToFavorites(mockWord._id, 'invalid-user-id')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user lacks permission', async () => {
      mockWordModel.findById.mockResolvedValue(mockWord);
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockWordPermissionService.canUserAddToFavorites.mockResolvedValue(false);

      await expect(
        service.addToFavorites(mockWord._id, mockUser._id)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeFromFavorites', () => {
    it('should remove word from favorites successfully', async () => {
      mockFavoriteWordModel.findOne.mockResolvedValue(mockFavorite);
      mockFavoriteWordModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await service.removeFromFavorites(mockWord._id, mockUser._id);

      expect(result.success).toBe(true);
      expect(mockFavoriteWordModel.deleteOne).toHaveBeenCalled();
    });

    it('should return success false if favorite not found', async () => {
      mockFavoriteWordModel.findOne.mockResolvedValue(null);

      const result = await service.removeFromFavorites(mockWord._id, mockUser._id);

      expect(result.success).toBe(false);
      expect(result.message).toContain('pas dans vos favoris');
    });

    it('should throw BadRequestException for invalid word ID', async () => {
      await expect(
        service.removeFromFavorites('invalid-id', mockUser._id)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkIfFavorite', () => {
    it('should return true if word is favorite', async () => {
      mockFavoriteWordModel.findOne.mockResolvedValue(mockFavorite);

      const result = await service.checkIfFavorite(mockWord._id, mockUser._id);

      expect(result).toBe(true);
      expect(mockFavoriteWordModel.findOne).toHaveBeenCalled();
    });

    it('should return false if word is not favorite', async () => {
      mockFavoriteWordModel.findOne.mockResolvedValue(null);

      const result = await service.checkIfFavorite(mockWord._id, mockUser._id);

      expect(result).toBe(false);
    });

    it('should throw BadRequestException for invalid IDs', async () => {
      await expect(
        service.checkIfFavorite('invalid-id', mockUser._id)
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.checkIfFavorite(mockWord._id, 'invalid-id')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFavoriteWords', () => {
    it('should return paginated favorite words', async () => {
      const mockFavorites = [
        { wordId: mockWord._id, userId: mockUser._id, addedAt: new Date() },
      ];

      mockFavoriteWordModel.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockFavorites),
      });
      
      mockFavoriteWordModel.countDocuments.mockResolvedValue(1);
      
      mockWordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockWord]),
      });

      const result = await service.getFavoriteWords(mockUser._id, 1, 10);

      expect(result.words).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should return empty array when no favorites', async () => {
      mockFavoriteWordModel.find.mockReturnValue({
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      
      mockFavoriteWordModel.countDocuments.mockResolvedValue(0);

      const result = await service.getFavoriteWords(mockUser._id, 1, 10);

      expect(result.words).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('shareWordWithUser', () => {
    const targetUser = {
      _id: '507f1f77bcf86cd799439014',
      username: 'targetuser',
    };

    it('should share word successfully', async () => {
      mockUserModel.findOne.mockResolvedValue(targetUser);
      mockFavoriteWordModel.findOne.mockResolvedValue(null); // Not already favorite
      
      const saveMock = jest.fn().mockResolvedValue(mockFavorite);
      mockFavoriteWordModel.mockImplementation(() => ({
        save: saveMock,
      }));

      const result = await service.shareWordWithUser(
        mockWord._id,
        mockUser._id,
        targetUser.username
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('partagé avec succès');
    });

    it('should return error if target user not found', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      const result = await service.shareWordWithUser(
        mockWord._id,
        mockUser._id,
        'nonexistent'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('non trouvé');
    });

    it('should return error if word already in target user favorites', async () => {
      mockUserModel.findOne.mockResolvedValue(targetUser);
      mockFavoriteWordModel.findOne.mockResolvedValue(mockFavorite);

      const result = await service.shareWordWithUser(
        mockWord._id,
        mockUser._id,
        targetUser.username
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('déjà dans les favoris');
    });
  });

  describe('getFavoriteStats', () => {
    it('should return favorite statistics', async () => {
      const mockStatsData = [
        { _id: 'fr', count: 3 },
        { _id: 'en', count: 2 },
      ];

      const mockRecentFavorites = [
        {
          wordId: { word: 'test1', language: 'fr' },
          addedAt: new Date(),
        },
      ];

      mockFavoriteWordModel.countDocuments
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(2); // today

      mockFavoriteWordModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockRecentFavorites),
      });

      mockFavoriteWordModel.aggregate.mockResolvedValue(mockStatsData);

      const result = await service.getFavoriteStats(mockUser._id);

      expect(result.totalFavorites).toBe(5);
      expect(result.favoritesToday).toBe(2);
      expect(result.favoritesByLanguage).toHaveLength(2);
      expect(result.recentFavorites).toHaveLength(1);
    });
  });

  describe('clearAllFavorites', () => {
    it('should clear all favorites successfully', async () => {
      mockFavoriteWordModel.deleteMany.mockResolvedValue({ deletedCount: 5 });

      const result = await service.clearAllFavorites(mockUser._id);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(5);
    });
  });

  describe('getMostFavoritedWords', () => {
    it('should return most favorited words', async () => {
      const mockResults = [
        {
          word: mockWord,
          favoriteCount: 10,
        },
      ];

      mockFavoriteWordModel.aggregate.mockResolvedValue(mockResults);

      const result = await service.getMostFavoritedWords(5);

      expect(result).toHaveLength(1);
      expect(result[0].favoriteCount).toBe(10);
      expect(mockFavoriteWordModel.aggregate).toHaveBeenCalled();
    });
  });
});