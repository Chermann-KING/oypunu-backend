import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WordAudioService } from './word-audio.service';
import { Word } from '../../schemas/word.schema';
import { User, UserRole } from '../../../users/schemas/user.schema';
import { AudioService } from '../audio.service';
import { ActivityService } from '../../../common/services/activity.service';
import { WordPermissionService } from './word-permission.service';

describe('WordAudioService', () => {
  let service: WordAudioService;
  let mockWordModel: any;
  let mockAudioService: any;
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
    audioFiles: new Map([
      ['fr-fr', {
        url: 'https://example.com/audio.mp3',
        cloudinaryId: 'test123',
        language: 'fr',
        accent: 'fr-fr',
      }],
    ]),
  };

  beforeEach(async () => {
    mockWordModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      find: jest.fn(),
    };

    mockAudioService = {
      uploadPhoneticAudio: jest.fn(),
      deletePhoneticAudio: jest.fn(),
      getOptimizedAudioUrl: jest.fn(),
      checkAudioFileExists: jest.fn(),
    };

    mockActivityService = {
      recordActivity: jest.fn(),
    };

    mockWordPermissionService = {
      canUserAddAudio: jest.fn(),
      canUserEditWord: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordAudioService,
        {
          provide: getModelToken(Word.name),
          useValue: mockWordModel,
        },
        {
          provide: AudioService,
          useValue: mockAudioService,
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

    service = module.get<WordAudioService>(WordAudioService);
  });

  describe('addAudioFile', () => {
    it('should add audio file successfully', async () => {
      const fileBuffer = Buffer.from('fake audio data');
      const accent = 'fr-fr';

      mockWordModel.findById.mockResolvedValue(mockWord);
      mockWordPermissionService.canUserAddAudio.mockResolvedValue(true);
      mockAudioService.uploadPhoneticAudio.mockResolvedValue({
        secure_url: 'https://example.com/new-audio.mp3',
        public_id: 'new123',
      });
      
      const updatedWord = { ...mockWord, audioFiles: new Map(mockWord.audioFiles) };
      mockWordModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(updatedWord),
          }),
        }),
      });

      const result = await service.addAudioFile(mockWord._id, accent, fileBuffer, mockUser);

      expect(mockWordModel.findById).toHaveBeenCalledWith(mockWord._id);
      expect(mockWordPermissionService.canUserAddAudio).toHaveBeenCalledWith(mockWord, mockUser);
      expect(mockAudioService.uploadPhoneticAudio).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException for invalid word ID', async () => {
      mockWordModel.findById.mockResolvedValue(null);

      await expect(
        service.addAudioFile('invalid-id', 'fr-fr', Buffer.from('test'), mockUser)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user lacks permission', async () => {
      mockWordModel.findById.mockResolvedValue(mockWord);
      mockWordPermissionService.canUserAddAudio.mockResolvedValue(false);

      await expect(
        service.addAudioFile(mockWord._id, 'fr-fr', Buffer.from('test'), mockUser)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAudioFile', () => {
    it('should delete audio file successfully', async () => {
      mockWordModel.findById.mockResolvedValue(mockWord);
      mockWordPermissionService.canUserEditWord.mockResolvedValue(true);
      mockAudioService.deletePhoneticAudio.mockResolvedValue(true);
      
      const updatedWord = { ...mockWord };
      mockWordModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(updatedWord),
          }),
        }),
      });

      const result = await service.deleteAudioFile(mockWord._id, 'fr-fr', mockUser);

      expect(mockWordModel.findById).toHaveBeenCalledWith(mockWord._id);
      expect(mockWordPermissionService.canUserEditWord).toHaveBeenCalledWith(mockWord, mockUser);
      expect(mockAudioService.deletePhoneticAudio).toHaveBeenCalledWith('test123');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException for non-existent accent', async () => {
      mockWordModel.findById.mockResolvedValue(mockWord);
      mockWordPermissionService.canUserEditWord.mockResolvedValue(true);

      await expect(
        service.deleteAudioFile(mockWord._id, 'non-existent-accent', mockUser)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWordAudioFiles', () => {
    it('should return word audio files', async () => {
      mockWordModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWord),
      });

      const result = await service.getWordAudioFiles(mockWord._id);

      expect(result).toEqual({
        wordId: mockWord._id,
        word: mockWord.word,
        language: mockWord.language,
        audioFiles: [
          {
            accent: 'fr-fr',
            url: 'https://example.com/audio.mp3',
            cloudinaryId: 'test123',
            language: 'fr',
          },
        ],
        totalCount: 1,
      });
    });

    it('should throw NotFoundException for invalid word ID', async () => {
      mockWordModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.getWordAudioFiles('invalid-id')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDefaultAccentForLanguage', () => {
    it('should return correct default accent for known languages', () => {
      expect(service.getDefaultAccentForLanguage('fr')).toBe('fr-fr');
      expect(service.getDefaultAccentForLanguage('en')).toBe('en-us');
      expect(service.getDefaultAccentForLanguage('es')).toBe('es-es');
    });

    it('should return "standard" for unknown languages', () => {
      expect(service.getDefaultAccentForLanguage('unknown')).toBe('standard');
      expect(service.getDefaultAccentForLanguage('xyz')).toBe('standard');
    });
  });

  describe('getAudioStatistics', () => {
    it('should return audio statistics', async () => {
      const wordsWithAudio = [
        {
          language: 'fr',
          audioFiles: new Map([
            ['fr-fr', { url: 'test1.mp3', cloudinaryId: 'id1', language: 'fr', accent: 'fr-fr' }],
            ['fr-ca', { url: 'test2.mp3', cloudinaryId: 'id2', language: 'fr', accent: 'fr-ca' }],
          ]),
        },
        {
          language: 'en',
          audioFiles: new Map([
            ['en-us', { url: 'test3.mp3', cloudinaryId: 'id3', language: 'en', accent: 'en-us' }],
          ]),
        },
      ];

      mockWordModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(wordsWithAudio),
      });

      const result = await service.getAudioStatistics();

      expect(result.totalAudioFiles).toBe(3);
      expect(result.languageStats).toEqual([
        { language: 'fr', count: 2 },
        { language: 'en', count: 1 },
      ]);
      expect(result.accentStats).toEqual([
        { accent: 'fr-fr', count: 1 },
        { accent: 'fr-ca', count: 1 },
        { accent: 'en-us', count: 1 },
      ]);
    });
  });

  describe('validateWordAudioFiles', () => {
    it('should validate audio files and return results', async () => {
      // Mock fetch global
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      mockWordModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockWord),
      });

      const result = await service.validateWordAudioFiles(mockWord._id);

      expect(result.wordId).toBe(mockWord._id);
      expect(result.totalFiles).toBe(1);
      expect(result.validFiles).toBe(1);
      expect(result.invalidFiles).toHaveLength(0);
    });
  });
});