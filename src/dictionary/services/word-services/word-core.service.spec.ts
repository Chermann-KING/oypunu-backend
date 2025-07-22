import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { WordCoreService } from './word-core.service';
import { Word } from '../../schemas/word.schema';
import { Language } from '../../../languages/schemas/language.schema';
import { WordView } from '../../../users/schemas/word-view.schema';
import { CategoriesService } from '../categories.service';
import { UsersService } from '../../../users/services/users.service';
import { ActivityService } from '../../../common/services/activity.service';
import { CreateWordDto } from '../../dto/create-word.dto';
import { UpdateWordDto } from '../../dto/update-word.dto';
import { SearchWordsDto } from '../../dto/search-words.dto';
import { UserRole } from '../../../users/schemas/user.schema';

describe('WordCoreService', () => {
  let service: WordCoreService;
  let mockWordModel: any;
  let mockLanguageModel: any;
  let mockWordViewModel: any;
  let mockCategoriesService: any;
  let mockUsersService: any;
  let mockActivityService: any;

  // Mock data
  const mockObjectId = new Types.ObjectId();
  const mockUser = {
    _id: mockObjectId.toString(),
    userId: mockObjectId.toString(),
    role: UserRole.USER,
    username: 'testuser',
  };

  const mockAdmin = {
    _id: mockObjectId.toString(),
    userId: mockObjectId.toString(),
    role: UserRole.ADMIN,
    username: 'admin',
  };

  const mockWord = {
    _id: mockObjectId,
    word: 'test',
    language: 'fr',
    languageId: mockObjectId,
    meanings: [
      {
        partOfSpeech: 'noun',
        definitions: [{ definition: 'test definition' }],
      },
    ],
    translations: [{ translatedWord: 'prueba', language: 'es' }],
    status: 'approved',
    createdBy: mockObjectId,
    categoryId: mockObjectId,
    translationCount: 1,
    version: 1,
    createdAt: new Date(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(this),
    save: jest.fn().mockResolvedValue(this),
  };

  const mockCategory = {
    _id: mockObjectId,
    name: 'Test Category',
  };

  const mockLanguage = {
    _id: mockObjectId,
    name: 'French',
    nativeName: 'Français',
    iso639_1: 'fr',
    region: 'europe',
    flagEmoji: '🇫🇷',
  };

  beforeEach(async () => {
    // Mock models - Use jest.fn() as constructor
    mockWordModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(mockWord),
      populate: jest.fn().mockReturnThis(),
    }));
    mockWordModel.findOne = jest.fn();
    mockWordModel.findById = jest.fn();
    mockWordModel.findByIdAndUpdate = jest.fn();
    mockWordModel.findByIdAndDelete = jest.fn();
    mockWordModel.find = jest.fn();
    mockWordModel.countDocuments = jest.fn();
    mockWordModel.aggregate = jest.fn();

    mockLanguageModel = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    mockWordViewModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(true),
    }));

    // Mock services
    mockCategoriesService = {
      findOne: jest.fn(),
    };

    mockUsersService = {
      findById: jest.fn(),
    };

    mockActivityService = {
      logWordCreated: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordCoreService,
        {
          provide: getModelToken(Word.name),
          useValue: mockWordModel,
        },
        {
          provide: getModelToken(Language.name),
          useValue: mockLanguageModel,
        },
        {
          provide: getModelToken(WordView.name),
          useValue: mockWordViewModel,
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
      ],
    }).compile();

    service = module.get<WordCoreService>(WordCoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createWordDto: CreateWordDto = {
      word: 'nouveau',
      language: 'fr',
      languageId: mockObjectId.toString(),
      meanings: [
        {
          partOfSpeech: 'adjective',
          definitions: [{ definition: 'qui vient d\'être fait' }],
        },
      ],
      translations: [{ translatedWord: 'new', language: 'en' }],
    };

    it('should create a word successfully for regular user', async () => {
      mockWordModel.findOne.mockResolvedValue(null); // No existing word
      mockCategoriesService.findOne.mockResolvedValue(mockCategory);
      
      const mockSavedWord = { 
        ...mockWord, 
        ...createWordDto, 
        status: 'pending',
        save: jest.fn().mockResolvedValue(mockWord),
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockWord)
          })
        })
      };
      
      // Reset and configure the mock
      mockWordModel.mockImplementation(() => mockSavedWord);
      mockWordModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockSavedWord,
            createdBy: { username: 'testuser' }
          })
        })
      });

      const result = await service.create(createWordDto, mockUser);

      expect(mockWordModel.findOne).toHaveBeenCalledWith({
        word: createWordDto.word,
        languageId: createWordDto.languageId,
      });
      expect(result).toBeDefined();
    });

    it('should create a word with approved status for admin user', async () => {
      mockWordModel.findOne.mockResolvedValue(null);
      mockCategoriesService.findOne.mockResolvedValue(mockCategory);
      
      const mockSavedWord = { 
        ...mockWord, 
        ...createWordDto, 
        status: 'approved',
        save: jest.fn().mockResolvedValue(mockWord),
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockWord)
          })
        })
      };
      
      mockWordModel.mockImplementation(() => mockSavedWord);
      mockWordModel.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            ...mockSavedWord,
            createdBy: { username: 'admin' }
          })
        })
      });
      mockActivityService.logWordCreated.mockResolvedValue(true);

      const result = await service.create(createWordDto, mockAdmin);

      expect(result).toBeDefined();
      expect(mockActivityService.logWordCreated).toHaveBeenCalled();
    });

    it('should throw BadRequestException if word already exists', async () => {
      mockWordModel.findOne.mockResolvedValue(mockWord);

      await expect(
        service.create(createWordDto, mockUser)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if category not found', async () => {
      const createWithCategory = { 
        ...createWordDto, 
        categoryId: mockObjectId.toString() 
      };
      
      mockWordModel.findOne.mockResolvedValue(null);
      mockCategoriesService.findOne.mockResolvedValue(null);

      await expect(
        service.create(createWithCategory, mockUser)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user is invalid', async () => {
      const invalidUser = { role: 'user' }; // No _id or userId

      await expect(
        service.create(createWordDto, invalidUser as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated words', async () => {
      const mockWords = [mockWord, { ...mockWord, word: 'test2' }];
      const mockTotal = 2;

      mockWordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockWords),
      });
      mockWordModel.countDocuments.mockResolvedValue(mockTotal);

      const result = await service.findAll(1, 10, 'approved', 'fr');

      expect(result).toEqual({
        words: mockWords,
        total: mockTotal,
        page: 1,
        limit: 10,
      });
    });

    it('should apply language filter', async () => {
      mockWordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      mockWordModel.countDocuments.mockResolvedValue(0);

      await service.findAll(1, 10, 'approved', 'es');

      expect(mockWordModel.find).toHaveBeenCalledWith({
        status: 'approved',
        language: 'es',
      });
    });
  });

  describe('findOne', () => {
    it('should return a word by ID', async () => {
      mockWordModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockWord),
      });

      const result = await service.findOne(mockObjectId.toString());

      expect(result).toEqual(mockWord);
      expect(mockWordModel.findById).toHaveBeenCalledWith(mockObjectId.toString());
    });

    it('should throw BadRequestException for invalid ID', async () => {
      await expect(
        service.findOne('invalid-id')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if word not found', async () => {
      mockWordModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.findOne(mockObjectId.toString())
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('trackWordView', () => {
    it('should create a word view record', async () => {
      await service.trackWordView(
        mockObjectId.toString(),
        mockObjectId.toString(),
        { source: 'search' }
      );

      expect(mockWordViewModel).toHaveBeenCalledWith({
        wordId: mockObjectId,
        userId: mockObjectId,
        viewedAt: expect.any(Date),
        metadata: { source: 'search' },
      });
    });
  });

  describe('update', () => {
    const updateDto: UpdateWordDto = {
      meanings: [
        {
          partOfSpeech: 'noun',
          definitions: [{ definition: 'updated definition' }],
        },
      ],
    };

    it('should update word successfully for creator', async () => {
      const wordToUpdate = { ...mockWord, createdBy: mockObjectId.toString(), status: 'pending' };
      mockWordModel.findById.mockResolvedValue(wordToUpdate);
      mockWordModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...wordToUpdate, ...updateDto }),
      });

      const result = await service.update(mockObjectId.toString(), updateDto, mockUser as any);

      expect(result).toBeDefined();
    });

    it('should update word successfully for admin', async () => {
      const wordToUpdate = { ...mockWord, createdBy: new Types.ObjectId().toString(), status: 'approved' }; // Different creator
      mockWordModel.findById.mockResolvedValue(wordToUpdate);
      mockWordModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...wordToUpdate, ...updateDto }),
      });

      const result = await service.update(mockObjectId.toString(), updateDto, mockAdmin as any);

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException for invalid ID', async () => {
      await expect(
        service.update('invalid-id', updateDto, mockUser as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if word not found', async () => {
      mockWordModel.findById.mockResolvedValue(null);

      await expect(
        service.update(mockObjectId.toString(), updateDto, mockUser as any)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user has no permission', async () => {
      const wordToUpdate = { 
        ...mockWord, 
        createdBy: new Types.ObjectId().toString(), // Different creator
        status: 'pending'
      };
      mockWordModel.findById.mockResolvedValue(wordToUpdate);

      await expect(
        service.update(mockObjectId.toString(), updateDto, mockUser as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for approved word updates by non-admin', async () => {
      const approvedWord = { 
        ...mockWord, 
        status: 'approved',
        createdBy: mockObjectId.toString()
      };
      mockWordModel.findById.mockResolvedValue(approvedWord);

      await expect(
        service.update(mockObjectId.toString(), updateDto, mockUser as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove word successfully for creator', async () => {
      const wordToDelete = { ...mockWord, createdBy: mockObjectId.toString() };
      mockWordModel.findById.mockResolvedValue(wordToDelete);
      mockWordModel.findByIdAndDelete.mockResolvedValue(wordToDelete);

      const result = await service.remove(mockObjectId.toString(), mockUser as any);

      expect(result).toEqual({ success: true });
    });

    it('should remove word successfully for admin', async () => {
      const wordToDelete = { ...mockWord, createdBy: new Types.ObjectId().toString() }; // Different creator
      mockWordModel.findById.mockResolvedValue(wordToDelete);
      mockWordModel.findByIdAndDelete.mockResolvedValue(wordToDelete);

      const result = await service.remove(mockObjectId.toString(), mockAdmin as any);

      expect(result).toEqual({ success: true });
    });

    it('should throw BadRequestException for invalid ID', async () => {
      await expect(
        service.remove('invalid-id', mockUser as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if word not found', async () => {
      mockWordModel.findById.mockResolvedValue(null);

      await expect(
        service.remove(mockObjectId.toString(), mockUser as any)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user has no permission', async () => {
      const wordToDelete = { 
        ...mockWord, 
        createdBy: new Types.ObjectId().toString() // Different creator
      };
      mockWordModel.findById.mockResolvedValue(wordToDelete);

      await expect(
        service.remove(mockObjectId.toString(), mockUser as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('search', () => {
    const searchDto: SearchWordsDto = {
      query: 'test',
      languages: ['fr', 'en'],
      categories: [mockObjectId.toString()],
      partsOfSpeech: ['noun'],
      page: 1,
      limit: 10,
    };

    it('should search words with all filters', async () => {
      const mockSearchResults = [mockWord];
      mockWordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSearchResults),
      });
      mockWordModel.countDocuments.mockResolvedValue(1);

      const result = await service.search(searchDto);

      expect(result).toEqual({
        words: mockSearchResults,
        total: 1,
        page: 1,
        limit: 10,
      });
    });

    it('should search without query', async () => {
      const searchWithoutQuery = { ...searchDto, query: '' };
      mockWordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      mockWordModel.countDocuments.mockResolvedValue(0);

      const result = await service.search(searchWithoutQuery);

      expect(mockWordModel.find).toHaveBeenCalledWith(
        expect.not.objectContaining({ $or: expect.anything() })
      );
    });
  });

  describe('getFeaturedWords', () => {
    it('should return featured words', async () => {
      const featuredWords = [mockWord];
      mockWordModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(featuredWords),
      });

      const result = await service.getFeaturedWords(5);

      expect(result).toEqual(featuredWords);
      expect(mockWordModel.find).toHaveBeenCalledWith({
        status: 'approved',
        $or: [
          { 'audioFiles': { $exists: true, $ne: {} } },
          { translationCount: { $gte: 2 } },
        ],
      });
    });
  });

  describe('getAvailableLanguages', () => {
    it('should return available languages with counts', async () => {
      const mockLanguageStats = [{ _id: mockObjectId, count: 5 }];
      const mockDirectStats = [{ _id: 'fr', count: 3 }];

      mockWordModel.aggregate
        .mockResolvedValueOnce(mockLanguageStats)
        .mockResolvedValueOnce(mockDirectStats);

      mockLanguageModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockLanguage]),
      });

      const result = await service.getAvailableLanguages();

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            language: expect.any(String),
            count: expect.any(Number),
          }),
        ])
      );
    });
  });

  describe('updateWordStatus', () => {
    it('should update word status successfully', async () => {
      const updatedWord = { ...mockWord, status: 'approved' };
      mockWordModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(updatedWord),
      });

      const result = await service.updateWordStatus(
        mockObjectId.toString(),
        'approved',
        mockObjectId.toString()
      );

      expect(result).toEqual(updatedWord);
      expect(mockWordModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockObjectId.toString(),
        { status: 'approved', updatedAt: expect.any(Date) },
        { new: true }
      );
    });

    it('should throw BadRequestException for invalid ID', async () => {
      await expect(
        service.updateWordStatus('invalid-id', 'approved', mockObjectId.toString())
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if word not found after update', async () => {
      mockWordModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateWordStatus(mockObjectId.toString(), 'approved', mockObjectId.toString())
      ).rejects.toThrow(NotFoundException);
    });
  });
});