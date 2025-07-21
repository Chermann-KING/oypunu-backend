import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WordNotificationService } from './word-notification.service';
import { WordNotification } from '../../schemas/word-notification.schema';

describe('WordNotificationService', () => {
  let service: WordNotificationService;
  let mockNotificationModel: any;

  beforeEach(async () => {
    const mockSave = jest.fn().mockResolvedValue({ _id: 'notification-id' });
    
    mockNotificationModel = jest.fn().mockImplementation((data) => ({
      ...data,
      save: mockSave,
    }));
    
    // Add static methods to the constructor
    mockNotificationModel.find = jest.fn();
    mockNotificationModel.findByIdAndUpdate = jest.fn();
    mockNotificationModel.deleteMany = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordNotificationService,
        {
          provide: getModelToken(WordNotification.name),
          useValue: mockNotificationModel,
        },
      ],
    }).compile();

    service = module.get<WordNotificationService>(WordNotificationService);
  });

  describe('notifyAdminsOfRevision', () => {
    it('should create admin notification for pending revision', async () => {
      await service.notifyAdminsOfRevision('word-id', 'user-id', 'revision-id', []);

      expect(mockNotificationModel).toHaveBeenCalledWith({
        wordId: 'word-id',
        userId: 'user-id',
        adminTargeted: true,
        type: 'revision_pending',
        message: 'Une révision est en attente d\'approbation pour le mot word-id',
        metadata: {
          revisionId: 'revision-id',
          changes: [],
          createdAt: expect.any(Date),
        },
        isRead: false,
        createdAt: expect.any(Date),
      });
    });
  });

  describe('notifyUserOfRevisionApproval', () => {
    it('should create user notification for approved revision', async () => {
      await service.notifyUserOfRevisionApproval('user-id', 'word-id', 'revision-id', 'Good job!');

      expect(mockNotificationModel).toHaveBeenCalledWith({
        wordId: 'word-id',
        userId: 'user-id',
        adminTargeted: false,
        type: 'revision_approved',
        message: 'Votre révision du mot word-id a été approuvée',
        metadata: {
          revisionId: 'revision-id',
          adminNotes: 'Good job!',
          approvedAt: expect.any(Date),
        },
        isRead: false,
        createdAt: expect.any(Date),
      });
    });
  });

  describe('notifyUserOfRevisionRejection', () => {
    it('should create user notification for rejected revision', async () => {
      await service.notifyUserOfRevisionRejection('user-id', 'word-id', 'revision-id', 'Needs improvement');

      expect(mockNotificationModel).toHaveBeenCalledWith({
        wordId: 'word-id',
        userId: 'user-id',
        adminTargeted: false,
        type: 'revision_rejected',
        message: 'Votre révision du mot word-id a été rejetée',
        metadata: {
          revisionId: 'revision-id',
          adminNotes: 'Needs improvement',
          rejectedAt: expect.any(Date),
        },
        isRead: false,
        createdAt: expect.any(Date),
      });
    });
  });

  describe('getUnreadNotifications', () => {
    it('should return unread notifications for user', async () => {
      const mockNotifications = [
        { _id: '1', type: 'revision_approved', isRead: false },
        { _id: '2', type: 'revision_pending', isRead: false },
      ];

      mockNotificationModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockNotifications),
          }),
        }),
      });

      const result = await service.getUnreadNotifications('user-id');

      expect(result).toEqual(mockNotifications);
      expect(mockNotificationModel.find).toHaveBeenCalledWith({
        $or: [
          { userId: 'user-id', adminTargeted: false },
          { adminTargeted: true },
        ],
        isRead: false,
      });
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read', async () => {
      mockNotificationModel.findByIdAndUpdate.mockResolvedValue({});

      await service.markNotificationAsRead('notification-id');

      expect(mockNotificationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'notification-id',
        { isRead: true, readAt: expect.any(Date) },
      );
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should delete old read notifications', async () => {
      mockNotificationModel.deleteMany.mockResolvedValue({ deletedCount: 5 });

      const result = await service.cleanupOldNotifications();

      expect(result.deletedCount).toBe(5);
      expect(mockNotificationModel.deleteMany).toHaveBeenCalledWith({
        createdAt: { $lt: expect.any(Date) },
        isRead: true,
      });
    });
  });
});