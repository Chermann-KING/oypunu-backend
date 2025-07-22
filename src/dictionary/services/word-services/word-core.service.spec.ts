import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { WordCoreService } from './word-core.service';
import { CategoriesService } from '../categories.service';
import { UsersService } from '../../../users/services/users.service';
import { ActivityService } from '../../../common/services/activity.service';
import { Language } from '../../../languages/schemas/language.schema';
import { WordView } from '../../../users/schemas/word-view.schema';
import { UserRole } from '../../../users/schemas/user.schema';
import { IWordRepository } from '../../../repositories/interfaces/word.repository.interface';
import { IUserRepository } from '../../../repositories/interfaces/user.repository.interface';
import { CreateWordDto } from '../../dto/create-word.dto';
import { UpdateWordDto } from '../../dto/update-word.dto';
import { SearchWordsDto } from '../../dto/search-words.dto';

/**
 * 🧪 TESTS UNITAIRES - WORD CORE SERVICE AVEC REPOSITORY PATTERN
 * 
 * Tests du service principal après refactoring Repository Pattern.
 * Focus sur les opérations CRUD et la logique métier avec repositories mockés.
 * 
 * Couverture :
 * ✅ CRUD complet avec permissions
 * ✅ Recherche avancée avec filtres
 * ✅ Gestion des erreurs et validations
 * ✅ Intégration activity logging
 */
describe('WordCoreService - Repository Pattern', () => {
  let service: WordCoreService;
  let wordRepository: jest.Mocked<IWordRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let categoriesService: jest.Mocked<CategoriesService>;
  let usersService: jest.Mocked<UsersService>;
  let activityService: jest.Mocked<ActivityService>;

  // Données de test
  const mockUser = {
    _id: '64a1b2c3d4e5f6a7b8c9d0e1',
    username: 'testuser',
    email: 'test@example.com',
    role: UserRole.USER,
  } as any;

  const mockAdmin = {
    _id: '64a1b2c3d4e5f6a7b8c9d0e2',
    username: 'admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  } as any;

  const mockWord = {
    _id: '64a1b2c3d4e5f6a7b8c9d0e3',
    id: '64a1b2c3d4e5f6a7b8c9d0e3',
    word: 'serenité',
    language: 'fr',
    languageId: '64a1b2c3d4e5f6a7b8c9d0e4',
    meanings: [
      {
        partOfSpeech: 'noun',
        definitions: [{ definition: 'État de calme et de tranquillité' }],
      },
    ],
    translations: [
      {
        language: 'en',
        translatedWord: 'serenity',
      },
    ],
    status: 'approved',
    createdBy: '64a1b2c3d4e5f6a7b8c9d0e1',
    categoryId: '64a1b2c3d4e5f6a7b8c9d0e5',
    translationCount: 1,
    viewCount: 0,
    audioFiles: {},
    languageVariants: [],
    extractedKeywords: [],
    availableLanguages: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const mockCategory = {
    _id: '64a1b2c3d4e5f6a7b8c9d0e5',
    name: 'Emotions',
    description: 'Catégorie des émotions',
  };

  beforeEach(async () => {
    // Mocks des repositories
    const mockWordRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
      findFeatured: jest.fn(),
      getAvailableLanguages: jest.fn(),
      updateStatus: jest.fn(),
      incrementViewCount: jest.fn(),
      existsByWordAndLanguage: jest.fn(),
      findByStatus: jest.fn(),
      countByStatus: jest.fn(),
      countAddedToday: jest.fn(),
      getWordsStatistics: jest.fn(),
      findByUserId: jest.fn(),
      findByCategoryId: jest.fn(),
      updateTranslationCount: jest.fn(),
      deleteMany: jest.fn(),
      updateManyStatus: jest.fn(),
      searchByText: jest.fn(),
    };

    const mockUserRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      existsByEmail: jest.fn(),
      existsByUsername: jest.fn(),
      findBySocialProvider: jest.fn(),
      updatePassword: jest.fn(),
      markEmailAsVerified: jest.fn(),
      updateLanguagePreferences: jest.fn(),
      updateProfilePicture: jest.fn(),
      updateNotificationSettings: jest.fn(),
      count: jest.fn(),
      countByRole: jest.fn(),
      findActiveUsers: jest.fn(),
      findByNativeLanguage: jest.fn(),
      search: jest.fn(),
      findAll: jest.fn(),
      findAdmins: jest.fn(),
    };

    // Mocks des services
    const mockCategoriesService = {
      findOne: jest.fn(),
    };

    const mockUsersService = {
      findOne: jest.fn(),
    };

    const mockActivityService = {
      logWordCreated: jest.fn(),
    };

    // Mock des modèles Mongoose pour les injections restantes
    const mockLanguageModel = {
      find: jest.fn(),
      aggregate: jest.fn(),
    };

    const mockWordViewModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(data),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordCoreService,
        {
          provide: 'IWordRepository',
          useValue: mockWordRepository,
        },
        {
          provide: 'IUserRepository',
          useValue: mockUserRepository,
        },
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ActivityService,
          useValue: mockActivityService,
        },
        {
          provide: getModelToken(Language.name),
          useValue: mockLanguageModel,
        },
        {
          provide: getModelToken(WordView.name),
          useValue: mockWordViewModel,
        },
      ],
    }).compile();

    service = module.get<WordCoreService>(WordCoreService);
    wordRepository = module.get('IWordRepository');
    userRepository = module.get('IUserRepository');
    categoriesService = module.get(CategoriesService) as any;
    usersService = module.get(UsersService) as any;
    activityService = module.get(ActivityService) as any;
  });

  describe('🔧 Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have injected dependencies', () => {
      expect(wordRepository).toBeDefined();
      expect(userRepository).toBeDefined();
      expect(categoriesService).toBeDefined();
      expect(activityService).toBeDefined();
    });
  });

  describe('📝 CREATE Operations', () => {
    const createWordDto: CreateWordDto = {
      word: 'serenité',
      language: 'fr',
      languageId: '64a1b2c3d4e5f6a7b8c9d0e4',
      meanings: [
        {
          partOfSpeech: 'noun',
          definitions: [{ definition: 'État de calme et de tranquillité' }],
        },
      ],
      translations: [
        {
          language: 'en',
          translatedWord: 'serenity',
        },
      ],
      categoryId: '64a1b2c3d4e5f6a7b8c9d0e5',
    };

    it('should create word successfully for regular user', async () => {
      // Arrange
      wordRepository.existsByWordAndLanguage.mockResolvedValue(false);
      categoriesService.findOne.mockResolvedValue(mockCategory);
      wordRepository.create.mockResolvedValue(mockWord);
      userRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.create(createWordDto, mockUser);

      // Assert
      expect(result).toEqual(mockWord);
      expect(wordRepository.existsByWordAndLanguage).toHaveBeenCalledWith(
        'serenité',
        'fr',
        '64a1b2c3d4e5f6a7b8c9d0e4',
      );
      expect(wordRepository.create).toHaveBeenCalledWith(
        createWordDto,
        mockUser._id,
        'pending', // Regular user gets pending status
      );
    });

    it('should create word with approved status for admin', async () => {
      // Arrange
      wordRepository.existsByWordAndLanguage.mockResolvedValue(false);
      categoriesService.findOne.mockResolvedValue(mockCategory);
      wordRepository.create.mockResolvedValue({ ...mockWord, status: 'approved' });
      userRepository.findById.mockResolvedValue(mockAdmin);
      activityService.logWordCreated.mockResolvedValue(undefined);

      // Act
      const result = await service.create(createWordDto, mockAdmin);

      // Assert
      expect(wordRepository.create).toHaveBeenCalledWith(
        createWordDto,
        mockAdmin._id,
        'approved', // Admin gets approved status
      );
      expect(activityService.logWordCreated).toHaveBeenCalled();
    });

    it('should throw error if word already exists', async () => {
      // Arrange
      wordRepository.existsByWordAndLanguage.mockResolvedValue(true);

      // Act & Assert
      await expect(service.create(createWordDto, mockUser))
        .rejects.toThrow(BadRequestException);
      
      expect(wordRepository.existsByWordAndLanguage).toHaveBeenCalled();
      expect(wordRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if category does not exist', async () => {
      // Arrange
      wordRepository.existsByWordAndLanguage.mockResolvedValue(false);
      categoriesService.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(createWordDto, mockUser))
        .rejects.toThrow(BadRequestException);
      
      expect(categoriesService.findOne).toHaveBeenCalledWith(createWordDto.categoryId);
      expect(wordRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid user', async () => {
      // Act & Assert
      await expect(service.create(createWordDto, { role: 'user' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('📖 READ Operations', () => {
    describe('findAll', () => {
      it('should return paginated words successfully', async () => {
        // Arrange
        const expectedResult = {
          words: [mockWord],
          total: 1,
          page: 1,
          limit: 10,
        };
        wordRepository.findAll.mockResolvedValue(expectedResult);

        // Act
        const result = await service.findAll(1, 10, 'approved', 'fr');

        // Assert
        expect(result).toEqual(expectedResult);
        expect(wordRepository.findAll).toHaveBeenCalledWith({
          page: 1,
          limit: 10,
          status: 'approved',
          language: 'fr',
          categoryId: undefined,
        });
      });

      it('should use default parameters', async () => {
        // Arrange
        const expectedResult = {
          words: [mockWord],
          total: 1,
          page: 1,
          limit: 10,
        };
        wordRepository.findAll.mockResolvedValue(expectedResult);

        // Act
        const result = await service.findAll();

        // Assert
        expect(wordRepository.findAll).toHaveBeenCalledWith({
          page: 1,
          limit: 10,
          status: 'approved',
          language: undefined,
          categoryId: undefined,
        });
      });
    });

    describe('findOne', () => {
      it('should return word by ID successfully', async () => {
        // Arrange
        wordRepository.findById.mockResolvedValue(mockWord);

        // Act
        const result = await service.findOne(mockWord._id);

        // Assert
        expect(result).toEqual(mockWord);
        expect(wordRepository.findById).toHaveBeenCalledWith(mockWord._id);
      });

      it('should throw NotFoundException if word not found', async () => {
        // Arrange
        wordRepository.findById.mockResolvedValue(null);

        // Act & Assert
        await expect(service.findOne('nonexistent-id'))
          .rejects.toThrow(NotFoundException);
        
        expect(wordRepository.findById).toHaveBeenCalledWith('nonexistent-id');
      });
    });

    describe('getFeaturedWords', () => {
      it('should return featured words', async () => {
        // Arrange
        const featuredWords = [mockWord];
        wordRepository.findFeatured.mockResolvedValue(featuredWords);

        // Act
        const result = await service.getFeaturedWords(3);

        // Assert
        expect(result).toEqual(featuredWords);
        expect(wordRepository.findFeatured).toHaveBeenCalledWith(3);
      });
    });

    describe('getAvailableLanguages', () => {
      it('should return available languages', async () => {
        // Arrange
        const languages = [
          { language: 'français', count: 10, languageId: 'fr-id' },
          { language: 'english', count: 5, languageId: 'en-id' },
        ];
        wordRepository.getAvailableLanguages.mockResolvedValue(languages);

        // Act
        const result = await service.getAvailableLanguages();

        // Assert
        expect(result).toEqual(languages);
        expect(wordRepository.getAvailableLanguages).toHaveBeenCalled();
      });
    });
  });

  describe('🔍 SEARCH Operations', () => {
    const searchDto: SearchWordsDto = {
      query: 'serenité',
      languages: ['fr'],
      categories: ['64a1b2c3d4e5f6a7b8c9d0e5'],
      partsOfSpeech: ['noun'],
      page: 1,
      limit: 10,
    };

    it('should search words successfully', async () => {
      // Arrange
      const expectedResult = {
        words: [mockWord],
        total: 1,
        page: 1,
        limit: 10,
      };
      wordRepository.search.mockResolvedValue(expectedResult);

      // Act
      const result = await service.search(searchDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(wordRepository.search).toHaveBeenCalledWith(searchDto);
    });

    it('should handle empty search results', async () => {
      // Arrange
      const expectedResult = {
        words: [],
        total: 0,
        page: 1,
        limit: 10,
      };
      wordRepository.search.mockResolvedValue(expectedResult);

      // Act
      const result = await service.search(searchDto);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(result.words).toHaveLength(0);
    });
  });

  describe('✏️ UPDATE Operations', () => {
    const updateWordDto: UpdateWordDto = {
      meanings: [
        {
          partOfSpeech: 'noun',
          definitions: [{ definition: 'État de calme et de tranquillité profonde' }],
        },
      ],
    };

    it('should update word successfully by owner', async () => {
      // Arrange
      const wordToUpdate = { ...mockWord, status: 'pending' };
      const updatedWord = { ...wordToUpdate, ...updateWordDto };
      
      wordRepository.findById.mockResolvedValue(wordToUpdate);
      wordRepository.update.mockResolvedValue(updatedWord);
      categoriesService.findOne.mockResolvedValue(mockCategory);

      // Act
      const result = await service.update(mockWord._id, updateWordDto, mockUser);

      // Assert
      expect(result).toEqual(updatedWord);
      expect(wordRepository.update).toHaveBeenCalled();
    });

    it('should update word successfully by admin', async () => {
      // Arrange
      const updatedWord = { ...mockWord, ...updateWordDto };
      
      wordRepository.findById.mockResolvedValue(mockWord);
      wordRepository.update.mockResolvedValue(updatedWord);

      // Act
      const result = await service.update(mockWord._id, updateWordDto, mockAdmin);

      // Assert
      expect(result).toEqual(updatedWord);
      expect(wordRepository.update).toHaveBeenCalled();
    });

    it('should throw error if user not authorized', async () => {
      // Arrange
      const otherUser = { ...mockUser, _id: 'other-user-id' };
      wordRepository.findById.mockResolvedValue(mockWord);

      // Act & Assert
      await expect(service.update(mockWord._id, updateWordDto, otherUser))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw error if word not found', async () => {
      // Arrange
      wordRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('nonexistent-id', updateWordDto, mockUser))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw error if trying to update approved word as non-admin', async () => {
      // Arrange
      const approvedWord = { ...mockWord, status: 'approved' };
      wordRepository.findById.mockResolvedValue(approvedWord);

      // Act & Assert
      await expect(service.update(mockWord._id, updateWordDto, mockUser))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('🗑️ DELETE Operations', () => {
    it('should delete word successfully by owner', async () => {
      // Arrange
      wordRepository.findById.mockResolvedValue(mockWord);
      wordRepository.delete.mockResolvedValue(true);

      // Act
      const result = await service.remove(mockWord._id, mockUser);

      // Assert
      expect(result).toEqual({ success: true });
      expect(wordRepository.delete).toHaveBeenCalledWith(mockWord._id);
    });

    it('should delete word successfully by admin', async () => {
      // Arrange
      const otherUserWord = { ...mockWord, createdBy: 'other-user-id' };
      wordRepository.findById.mockResolvedValue(otherUserWord);
      wordRepository.delete.mockResolvedValue(true);

      // Act
      const result = await service.remove(mockWord._id, mockAdmin);

      // Assert
      expect(result).toEqual({ success: true });
      expect(wordRepository.delete).toHaveBeenCalledWith(mockWord._id);
    });

    it('should throw error if user not authorized', async () => {
      // Arrange
      const otherUser = { ...mockUser, _id: 'other-user-id' };
      wordRepository.findById.mockResolvedValue(mockWord);

      // Act & Assert
      await expect(service.remove(mockWord._id, otherUser))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw error if word not found', async () => {
      // Arrange
      wordRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove('nonexistent-id', mockUser))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('📊 ANALYTICS Operations', () => {
    describe('trackWordView', () => {
      it('should track word view successfully', async () => {
        // Arrange
        wordRepository.incrementViewCount.mockResolvedValue(undefined);

        // Act
        await service.trackWordView(mockWord._id, mockUser._id, { source: 'search' });

        // Assert
        expect(wordRepository.incrementViewCount).toHaveBeenCalledWith(mockWord._id);
      });
    });

    describe('updateWordStatus', () => {
      it('should update word status successfully', async () => {
        // Arrange
        const updatedWord = { ...mockWord, status: 'approved' };
        wordRepository.updateStatus.mockResolvedValue(updatedWord);

        // Act
        const result = await service.updateWordStatus(mockWord._id, 'approved', mockAdmin._id);

        // Assert
        expect(result).toEqual(updatedWord);
        expect(wordRepository.updateStatus).toHaveBeenCalledWith(
          mockWord._id,
          'approved',
          mockAdmin._id,
        );
      });

      it('should throw error if word not found for status update', async () => {
        // Arrange
        wordRepository.updateStatus.mockResolvedValue(null);

        // Act & Assert
        await expect(service.updateWordStatus('nonexistent-id', 'approved', mockAdmin._id))
          .rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('⚠️ Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      // Arrange
      wordRepository.findById.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(service.findOne(mockWord._id))
        .rejects.toThrow();
    });

    it('should handle invalid ObjectId gracefully', async () => {
      // Arrange
      wordRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('invalid-id'))
        .rejects.toThrow(NotFoundException);
    });
  });
});