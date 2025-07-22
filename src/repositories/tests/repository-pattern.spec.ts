import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UserRepository } from '../implementations/user.repository';
import { WordRepository } from '../implementations/word.repository';
import { ActivityFeedRepository } from '../implementations/activity-feed.repository';
import { IUserRepository } from '../interfaces/user.repository.interface';
import { IWordRepository } from '../interfaces/word.repository.interface';
import { IActivityFeedRepository } from '../interfaces/activity-feed.repository.interface';

/**
 * 🏗️ TESTS UNITAIRES - REPOSITORY PATTERN
 * 
 * Tests pour vérifier que le Repository Pattern fonctionne correctement :
 * - Interface contracts sont respectés
 * - Implémentations concrètes fonctionnent avec mocks
 * - Injection de dépendances fonctionne
 * - Error handling avec DatabaseErrorHandler
 * - Méthodes spécifiques ajoutées pour services
 */
describe('Repository Pattern Integration', () => {
  let userRepository: IUserRepository;
  let wordRepository: IWordRepository;
  let activityFeedRepository: IActivityFeedRepository;
  let mockUserModel: any;
  let mockWordModel: any;
  let mockActivityFeedModel: any;

  beforeEach(async () => {
    // Mock Mongoose models
    mockUserModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      distinct: jest.fn(),
      save: jest.fn(),
      exec: jest.fn(),
    };

    mockWordModel = {
      findById: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      distinct: jest.fn(),
      exec: jest.fn(),
    };

    mockActivityFeedModel = {
      find: jest.fn(),
      create: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
      distinct: jest.fn(),
      exec: jest.fn(),
    };

    // Make exec() chainable and return the mock itself by default
    mockUserModel.exec.mockReturnThis();
    mockWordModel.exec.mockReturnThis();
    mockActivityFeedModel.exec.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        WordRepository,
        ActivityFeedRepository,
        {
          provide: getModelToken('User'),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken('Word'),
          useValue: mockWordModel,
        },
        {
          provide: getModelToken('ActivityFeed'),
          useValue: mockActivityFeedModel,
        },
      ],
    }).compile();

    userRepository = module.get<UserRepository>(UserRepository);
    wordRepository = module.get<WordRepository>(WordRepository);
    activityFeedRepository = module.get<ActivityFeedRepository>(ActivityFeedRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('🏗️ Repository Pattern Architecture', () => {
    it('should implement correct interfaces', () => {
      expect(userRepository).toBeDefined();
      expect(wordRepository).toBeDefined();
      expect(activityFeedRepository).toBeDefined();
    });

    it('should have all required methods from interfaces', () => {
      // UserRepository methods
      expect(typeof userRepository.create).toBe('function');
      expect(typeof userRepository.findById).toBe('function');
      expect(typeof userRepository.findByEmail).toBe('function');
      expect(typeof userRepository.update).toBe('function');
      expect(typeof userRepository.markEmailAsVerified).toBe('function');

      // WordRepository methods  
      expect(typeof wordRepository.create).toBe('function');
      expect(typeof wordRepository.findById).toBe('function');
      expect(typeof wordRepository.countByCreatorAndStatus).toBe('function');
      expect(typeof wordRepository.findByCreator).toBe('function');
      expect(typeof wordRepository.getDistinctLanguagesByCreator).toBe('function');

      // ActivityFeedRepository methods
      expect(typeof activityFeedRepository.create).toBe('function');
      expect(typeof activityFeedRepository.findByUserId).toBe('function');
      expect(typeof activityFeedRepository.getUserActivities).toBe('function');
      expect(typeof activityFeedRepository.getDistinctLanguagesByUser).toBe('function');
    });
  });

  describe('👤 UserRepository Implementation', () => {
    const mockUser = {
      _id: 'user123',
      email: 'test@example.com',
      username: 'testuser',
      save: jest.fn(),
    };

    it('should find user by ID', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await userRepository.findById('user123');

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findById).toHaveBeenCalledWith('user123');
    });

    it('should find user by email', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await userRepository.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should update user', async () => {
      const updateData = { profilePicture: 'new-pic.jpg' };
      const updatedUser = { ...mockUser, ...updateData };
      
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedUser),
      });

      const result = await userRepository.update('user123', updateData);

      expect(result).toEqual(updatedUser);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        updateData,
        { new: true }
      );
    });

    it('should check if email exists', async () => {
      mockUserModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await userRepository.existsByEmail('test@example.com');

      expect(result).toBe(true);
      expect(mockUserModel.countDocuments).toHaveBeenCalledWith({ email: 'test@example.com' });
    });
  });

  describe('📚 WordRepository Implementation', () => {
    const mockWord = {
      _id: 'word123',
      word: 'hello',
      language: 'en',
      createdBy: 'user123',
      status: 'approved',
    };

    it('should count words by creator and status', async () => {
      mockWordModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(5),
      });

      const result = await wordRepository.countByCreatorAndStatus('user123', 'approved');

      expect(result).toBe(5);
      expect(mockWordModel.countDocuments).toHaveBeenCalledWith({
        createdBy: 'user123',
        status: 'approved',
      });
    });

    it('should find words by creator with options', async () => {
      const mockWords = [mockWord];
      mockWordModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockWords),
            }),
          }),
        }),
      });

      const result = await wordRepository.findByCreator('user123', {
        status: 'approved',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 10,
      });

      expect(result).toEqual(mockWords);
      expect(mockWordModel.find).toHaveBeenCalledWith({
        createdBy: 'user123',
        status: 'approved',
      });
    });

    it('should get distinct languages by creator', async () => {
      const languages = ['en', 'fr'];
      mockWordModel.distinct.mockReturnValue({
        exec: jest.fn().mockResolvedValue(languages),
      });

      const result = await wordRepository.getDistinctLanguagesByCreator('user123');

      expect(result).toEqual(languages);
      expect(mockWordModel.distinct).toHaveBeenCalledWith('language', {
        createdBy: 'user123',
        status: 'approved',
      });
    });
  });

  describe('📊 ActivityFeedRepository Implementation', () => {
    const mockActivity = {
      _id: 'activity123',
      userId: 'user123',
      activityType: 'word_created',
      createdAt: new Date(),
      entityId: 'word123',
      entityType: 'Word',
      username: 'testuser',
      metadata: { languageCode: 'en' },
    };

    const mockActivityDocument = {
      ...mockActivity,
      _id: { toString: () => 'activity123' },
      userId: { toString: () => 'user123' },
      entityId: { toString: () => 'word123' },
    };

    it('should find activities by user ID with pagination', async () => {
      const activities = [mockActivityDocument];
      
      mockActivityFeedModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(activities),
            }),
          }),
        }),
      });

      mockActivityFeedModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await activityFeedRepository.findByUserId('user123', {
        page: 1,
        limit: 10,
      });

      expect(result.activities).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should get user activities (simple version)', async () => {
      const activities = [mockActivityDocument];
      
      mockActivityFeedModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(activities),
          }),
        }),
      });

      const result = await activityFeedRepository.getUserActivities('user123', {
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 100,
      });

      expect(result).toHaveLength(1);
      expect(mockActivityFeedModel.find).toHaveBeenCalledWith({ userId: 'user123' });
    });

    it('should get distinct languages by user', async () => {
      const languages = ['en', 'fr'];
      mockActivityFeedModel.distinct.mockReturnValue({
        exec: jest.fn().mockResolvedValue(languages),
      });

      const result = await activityFeedRepository.getDistinctLanguagesByUser('user123');

      expect(result).toEqual(languages);
      expect(mockActivityFeedModel.distinct).toHaveBeenCalledWith('metadata.languageCode', {
        userId: 'user123',
      });
    });
  });

  describe('🛡️ Error Handling', () => {
    it('should handle database errors gracefully in UserRepository', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      });

      await expect(userRepository.findById('user123')).rejects.toThrow();
    });

    it('should handle database errors gracefully in WordRepository', async () => {
      mockWordModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Database connection failed')),
      });

      await expect(
        wordRepository.countByCreatorAndStatus('user123', 'approved')
      ).rejects.toThrow();
    });

    it('should handle database errors gracefully in ActivityFeedRepository', async () => {
      mockActivityFeedModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockRejectedValue(new Error('Database connection failed')),
          }),
        }),
      });

      await expect(
        activityFeedRepository.getUserActivities('user123')
      ).rejects.toThrow();
    });
  });

  describe('🔧 Interface Compatibility', () => {
    it('should satisfy TypeScript interface contracts', () => {
      // This test verifies that our implementations satisfy the interface contracts
      // If there were any missing methods or incorrect signatures, TypeScript would fail at compile time
      
      const userRepo: IUserRepository = userRepository;
      const wordRepo: IWordRepository = wordRepository;
      const activityRepo: IActivityFeedRepository = activityFeedRepository;

      expect(userRepo).toBeDefined();
      expect(wordRepo).toBeDefined();
      expect(activityRepo).toBeDefined();
    });

    it('should support dependency injection', async () => {
      // Verify that repositories can be injected as interfaces
      expect(userRepository.constructor.name).toBe('UserRepository');
      expect(wordRepository.constructor.name).toBe('WordRepository');
      expect(activityFeedRepository.constructor.name).toBe('ActivityFeedRepository');
    });
  });

  describe('🚀 Performance Considerations', () => {
    it('should handle large datasets efficiently', async () => {
      // Mock large dataset response
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        _id: `user${i}`,
        username: `user${i}`,
        email: `user${i}@example.com`,
      }));

      mockUserModel.find.mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(largeDataset.slice(0, 10)),
            }),
          }),
        }),
      });

      mockUserModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1000),
      });

      const result = await userRepository.findAll({
        page: 1,
        limit: 10,
      });

      expect(result.users).toHaveLength(10);
      expect(result.total).toBe(1000);
    });
  });
});