import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException } from '@nestjs/common';
import { WordValidationService } from './word-validation.service';
import { Word } from '../../schemas/word.schema';
import { User, UserRole } from '../../../users/schemas/user.schema';

describe('WordValidationService', () => {
  let service: WordValidationService;
  let mockWordModel: any;

  const mockUser: User = {
    _id: '507f1f77bcf86cd799439011',
    username: 'testuser',
    email: 'test@example.com',
    role: UserRole.USER,
    isActive: true,
  } as User;

  beforeEach(async () => {
    mockWordModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordValidationService,
        {
          provide: getModelToken(Word.name),
          useValue: mockWordModel,
        },
      ],
    }).compile();

    service = module.get<WordValidationService>(WordValidationService);
  });

  describe('validateWordCreation', () => {
    it('should validate successful word creation', async () => {
      const validDto = {
        word: 'test',
        languageId: 'fr',
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [{ definition: 'A test word' }],
          },
        ],
      };

      mockWordModel.findOne.mockResolvedValue(null);

      await expect(
        service.validateWordCreation(validDto, mockUser)
      ).resolves.not.toThrow();
    });

    it('should throw error for empty word', async () => {
      const invalidDto = {
        word: '',
        languageId: 'fr',
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [{ definition: 'A test word' }],
          },
        ],
      };

      await expect(
        service.validateWordCreation(invalidDto, mockUser)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for missing meanings', async () => {
      const invalidDto = {
        word: 'test',
        languageId: 'fr',
        meanings: [],
      };

      await expect(
        service.validateWordCreation(invalidDto, mockUser)
      ).rejects.toThrow('Au moins une signification est requise');
    });

    it('should throw error for duplicate word', async () => {
      const dto = {
        word: 'test',
        languageId: 'fr',
        meanings: [
          {
            partOfSpeech: 'noun',
            definitions: [{ definition: 'A test word' }],
          },
        ],
      };

      mockWordModel.findOne.mockResolvedValue({ word: 'test' });

      await expect(
        service.validateWordCreation(dto, mockUser)
      ).rejects.toThrow('Le mot "test" existe déjà dans cette langue');
    });
  });

  describe('validateWordFormat', () => {
    it('should accept valid words', () => {
      expect(() => service['validateWordFormat']('test')).not.toThrow();
      expect(() => service['validateWordFormat']('café')).not.toThrow();
      expect(() => service['validateWordFormat']('hello-world')).not.toThrow();
    });

    it('should reject invalid words', () => {
      expect(() => service['validateWordFormat']('')).toThrow();
      expect(() => service['validateWordFormat']('   ')).toThrow();
      expect(() => service['validateWordFormat']('test<script>')).toThrow();
      expect(() => service['validateWordFormat']('a'.repeat(101))).toThrow();
    });
  });

  describe('validateMeanings', () => {
    it('should accept valid meanings', () => {
      const validMeanings = [
        {
          partOfSpeech: 'noun',
          definitions: [{ definition: 'A test definition' }],
        },
      ];

      expect(() => service['validateMeanings'](validMeanings)).not.toThrow();
    });

    it('should reject empty meanings array', () => {
      expect(() => service['validateMeanings']([])).toThrow(
        'Au moins une signification est requise'
      );
    });

    it('should reject meanings without part of speech', () => {
      const invalidMeanings = [
        {
          definitions: [{ definition: 'A test definition' }],
        },
      ];

      expect(() => service['validateMeanings'](invalidMeanings)).toThrow();
    });

    it('should reject meanings without definitions', () => {
      const invalidMeanings = [
        {
          partOfSpeech: 'noun',
          definitions: [],
        },
      ];

      expect(() => service['validateMeanings'](invalidMeanings)).toThrow();
    });
  });

  describe('validateAudioFile', () => {
    it('should accept valid audio data', () => {
      const validAudio = {
        url: 'https://example.com/audio.mp3',
        accent: 'standard',
      };

      expect(() => service.validateAudioFile(validAudio)).not.toThrow();
    });

    it('should reject audio without URL', () => {
      const invalidAudio = {
        accent: 'standard',
      };

      expect(() => service.validateAudioFile(invalidAudio)).toThrow(
        'URL audio requise'
      );
    });

    it('should reject audio without accent', () => {
      const invalidAudio = {
        url: 'https://example.com/audio.mp3',
      };

      expect(() => service.validateAudioFile(invalidAudio)).toThrow(
        'Accent requis pour le fichier audio'
      );
    });

    it('should reject invalid URL', () => {
      const invalidAudio = {
        url: 'not-a-valid-url',
        accent: 'standard',
      };

      expect(() => service.validateAudioFile(invalidAudio)).toThrow(
        'URL audio invalide'
      );
    });
  });
});