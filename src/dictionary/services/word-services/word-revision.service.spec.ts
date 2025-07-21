import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WordRevisionService } from './word-revision.service';
import { Word } from '../../schemas/word.schema';
import { RevisionHistory } from '../../schemas/revision-history.schema';
import { User, UserRole } from '../../../users/schemas/user.schema';
import { WordNotificationService } from './word-notification.service';
import { Types } from 'mongoose';

describe('WordRevisionService', () => {
  let service: WordRevisionService;
  let mockWordModel: any;
  let mockRevisionHistoryModel: any;
  let mockUserModel: any;
  let mockNotificationService: any;

  const mockUser = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    username: 'testuser',
    email: 'test@example.com',
    role: UserRole.USER,
  };

  const mockAdminUser = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    username: 'admin',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };

  const mockWord = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
    word: 'test',
    language: 'fr',
    status: 'approved',
    version: 1,
    meanings: [{ definition: 'ancien sens' }],
    toObject: jest.fn().mockReturnValue({
      _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
      word: 'test',
      meanings: [{ definition: 'ancien sens' }],
    }),
  };

  const mockRevision = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439014'),
    wordId: new Types.ObjectId('507f1f77bcf86cd799439013'),
    modifiedBy: new Types.ObjectId('507f1f77bcf86cd799439011'),
    status: 'pending',
    changes: [{ field: 'meanings', changeType: 'modified' }],
    newVersion: { meanings: [{ definition: 'nouveau sens' }] },
    save: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    mockWordModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    const mockRevisionSave = jest.fn().mockResolvedValue({ _id: 'revision-id' });
    mockRevisionHistoryModel = jest.fn().mockImplementation((data) => ({
      ...data,
      _id: 'new-revision-id',
      save: mockRevisionSave,
    }));
    mockRevisionHistoryModel.findById = jest.fn();
    mockRevisionHistoryModel.find = jest.fn();
    mockRevisionHistoryModel.countDocuments = jest.fn();
    mockRevisionHistoryModel.aggregate = jest.fn();

    mockUserModel = {
      find: jest.fn(),
    };

    mockNotificationService = {
      notifyAdminsOfRevision: jest.fn(),
      notifyUserOfRevisionApproval: jest.fn(),
      notifyUserOfRevisionRejection: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordRevisionService,
        {
          provide: getModelToken(Word.name),
          useValue: mockWordModel,
        },
        {
          provide: getModelToken(RevisionHistory.name),
          useValue: mockRevisionHistoryModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: WordNotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<WordRevisionService>(WordRevisionService);
  });

  describe('createRevision', () => {
    it('should create revision when changes are detected', async () => {
      const updateDto = { meanings: [{ definition: 'nouveau sens' }] };
      
      mockWordModel.findById.mockResolvedValue(mockWord);
      mockWordModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ ...mockWord, status: 'pending_revision' }),
          }),
        }),
      });

      const result = await service.createRevision('507f1f77bcf86cd799439013', updateDto, mockUser as any);

      expect(mockRevisionHistoryModel).toHaveBeenCalledWith(
        expect.objectContaining({
          wordId: mockWord._id,
          version: 2,
          modifiedBy: mockUser._id,
          status: 'pending',
        })
      );
      expect(mockNotificationService.notifyAdminsOfRevision).toHaveBeenCalled();
      expect(result.status).toBe('pending_revision');
    });

    it('should return existing word when no changes detected', async () => {
      const updateDto = { meanings: [{ definition: 'ancien sens' }] }; // Same as existing

      mockWordModel.findById.mockResolvedValue(mockWord);

      const result = await service.createRevision('507f1f77bcf86cd799439013', updateDto, mockUser as any);

      expect(mockRevisionHistoryModel).not.toHaveBeenCalled();
      expect(result).toEqual(mockWord);
    });

    it('should throw NotFoundException for non-existent word', async () => {
      mockWordModel.findById.mockResolvedValue(null);

      await expect(
        service.createRevision('invalid-id', {}, mockUser as any)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid word ID', async () => {
      await expect(
        service.createRevision('invalid-id', {}, mockUser as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveRevision', () => {
    it('should approve revision and update word', async () => {
      mockRevisionHistoryModel.findById.mockResolvedValue(mockRevision);
      mockWordModel.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ ...mockWord, status: 'approved' }),
          }),
        }),
      });

      const result = await service.approveRevision(
        '507f1f77bcf86cd799439013',
        '507f1f77bcf86cd799439014',
        mockAdminUser as any,
        'Approved'
      );

      expect(mockRevision.status).toBe('approved');
      expect(mockRevision.adminApprovedBy).toBe(mockAdminUser._id);
      expect(mockRevision.adminNotes).toBe('Approved');
      expect(mockRevision.save).toHaveBeenCalled();
      expect(mockNotificationService.notifyUserOfRevisionApproval).toHaveBeenCalled();
      expect(result.status).toBe('approved');
    });

    it('should throw NotFoundException for non-existent revision', async () => {
      mockRevisionHistoryModel.findById.mockResolvedValue(null);

      await expect(
        service.approveRevision('word-id', 'revision-id', mockAdminUser as any)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when revision does not match word', async () => {
      const mismatchedRevision = {
        ...mockRevision,
        wordId: new Types.ObjectId('different-word-id'),
      };
      mockRevisionHistoryModel.findById.mockResolvedValue(mismatchedRevision);

      await expect(
        service.approveRevision('507f1f77bcf86cd799439013', 'revision-id', mockAdminUser as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectRevision', () => {
    it('should reject revision and revert word status', async () => {
      mockRevisionHistoryModel.findById.mockResolvedValue(mockRevision);
      mockWordModel.findByIdAndUpdate.mockResolvedValue({});

      await service.rejectRevision(
        '507f1f77bcf86cd799439013',
        '507f1f77bcf86cd799439014',
        mockAdminUser as any,
        'Need more details'
      );

      expect(mockRevision.status).toBe('rejected');
      expect(mockRevision.adminNotes).toBe('Need more details');
      expect(mockRevision.save).toHaveBeenCalled();
      expect(mockWordModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439013',
        { status: 'approved' }
      );
      expect(mockNotificationService.notifyUserOfRevisionRejection).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent revision', async () => {
      mockRevisionHistoryModel.findById.mockResolvedValue(null);

      await expect(
        service.rejectRevision('word-id', 'revision-id', mockAdminUser as any, 'reason')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRevisionHistory', () => {
    it('should return revision history for a word', async () => {
      const mockRevisions = [
        { _id: '1', version: 2, status: 'approved' },
        { _id: '2', version: 1, status: 'pending' },
      ];

      mockRevisionHistoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockRevisions),
            }),
          }),
        }),
      });

      const result = await service.getRevisionHistory('507f1f77bcf86cd799439013');

      expect(result).toEqual(mockRevisions);
      expect(mockRevisionHistoryModel.find).toHaveBeenCalledWith({
        wordId: '507f1f77bcf86cd799439013',
      });
    });

    it('should throw BadRequestException for invalid word ID', async () => {
      await expect(
        service.getRevisionHistory('invalid-id')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPendingRevisions', () => {
    it('should return paginated pending revisions', async () => {
      const mockRevisions = [
        { _id: '1', status: 'pending' },
        { _id: '2', status: 'pending' },
      ];

      mockRevisionHistoryModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue(mockRevisions),
                }),
              }),
            }),
          }),
        }),
      });
      mockRevisionHistoryModel.countDocuments.mockResolvedValue(15);

      const result = await service.getPendingRevisions(2, 10);

      expect(result).toEqual({
        revisions: mockRevisions,
        total: 15,
        page: 2,
        limit: 10,
        totalPages: 2,
      });
    });
  });

  describe('canUserCreateRevision', () => {
    it('should return false for admin users', async () => {
      const result = await service.canUserCreateRevision(mockWord as any, mockAdminUser as any);
      expect(result).toBe(false);
    });

    it('should return true for regular users on approved words', async () => {
      const result = await service.canUserCreateRevision(mockWord as any, mockUser as any);
      expect(result).toBe(true);
    });

    it('should return false for words not in allowed status', async () => {
      const draftWord = { ...mockWord, status: 'draft' };
      const result = await service.canUserCreateRevision(draftWord as any, mockUser as any);
      expect(result).toBe(false);
    });
  });

  describe('getRevisionStatistics', () => {
    it('should return revision statistics', async () => {
      const mockStats = {
        totalPending: 5,
        totalApproved: 20,
        totalRejected: 3,
        averageApprovalTime: 24,
      };

      mockRevisionHistoryModel.aggregate.mockResolvedValue([mockStats]);

      const result = await service.getRevisionStatistics();

      expect(result).toEqual({
        totalPending: 5,
        totalApproved: 20,
        totalRejected: 3,
        averageApprovalTime: 24,
      });
    });

    it('should return zeros when no statistics available', async () => {
      mockRevisionHistoryModel.aggregate.mockResolvedValue([]);

      const result = await service.getRevisionStatistics();

      expect(result).toEqual({
        totalPending: 0,
        totalApproved: 0,
        totalRejected: 0,
        averageApprovalTime: 0,
      });
    });
  });

  describe('detectChanges', () => {
    it('should detect field modifications', () => {
      const oldWord = { meanings: [{ definition: 'ancien' }] };
      const newData = { meanings: [{ definition: 'nouveau' }] };

      const changes = (service as any).detectChanges(oldWord, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({
        field: 'meanings',
        oldValue: [{ definition: 'ancien' }],
        newValue: [{ definition: 'nouveau' }],
        changeType: 'modified',
      });
    });

    it('should detect field additions', () => {
      const oldWord = {};
      const newData = { pronunciation: 'test-pronunciation' };

      const changes = (service as any).detectChanges(oldWord, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('added');
    });

    it('should detect field removals', () => {
      const oldWord = { etymology: 'old etymology' };
      const newData = { etymology: null };

      const changes = (service as any).detectChanges(oldWord, newData);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('removed');
    });

    it('should return empty array when no changes detected', () => {
      const oldWord = { meanings: [{ definition: 'same' }] };
      const newData = { meanings: [{ definition: 'same' }] };

      const changes = (service as any).detectChanges(oldWord, newData);

      expect(changes).toHaveLength(0);
    });
  });
});