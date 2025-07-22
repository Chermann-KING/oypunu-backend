import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../services/users.service';
import { IUserRepository } from '../../repositories/interfaces/user.repository.interface';
import { IActivityFeedRepository } from '../../repositories/interfaces/activity-feed.repository.interface';
import { IWordRepository } from '../../repositories/interfaces/word.repository.interface';
import { User } from '../schemas/user.schema';

/**
 * 👤 TESTS UNITAIRES - USERS SERVICE (REPOSITORY PATTERN)
 * 
 * Tests pour UsersService utilisant Repository Pattern :
 * - CRUD de base des utilisateurs
 * - Recherche d'utilisateurs
 * - Calculs de statistiques complexes (streak, stats personnelles)
 * - Contributions et consultations récentes
 * - Gestion des compteurs et activités
 * - Utilisateurs actifs et contributeurs
 */
describe('UsersService (Repository Pattern)', () => {
  let usersService: UsersService;
  let userRepository: jest.Mocked<IUserRepository>;
  let activityFeedRepository: jest.Mocked<IActivityFeedRepository>;
  let wordRepository: jest.Mocked<IWordRepository>;

  // Mock user data
  const mockUser = {
    _id: 'user123',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashedpassword',
    isEmailVerified: true,
    isActive: true,
    role: 'user',
    nativeLanguageId: 'fr',
    learningLanguageIds: ['en'],
    profilePicture: null,
    totalWordsAdded: 5,
    totalCommunityPosts: 2,
    createdAt: new Date('2024-01-01'),
    lastActive: new Date(),
  };

  const mockActivities = [
    {
      _id: 'activity1',
      userId: 'user123',
      activityType: 'word_created',
      createdAt: new Date(),
      entityId: 'word1',
      entityType: 'Word',
      username: 'testuser',
      isPublic: true,
      metadata: { languageCode: 'en', wordName: 'hello' },
    },
    {
      _id: 'activity2',
      userId: 'user123',
      activityType: 'word_created',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      entityId: 'word2',
      entityType: 'Word',
      username: 'testuser',
      isPublic: true,
      metadata: { languageCode: 'fr', wordName: 'bonjour' },
    },
  ];

  const mockWords = [
    {
      _id: 'word1',
      word: 'hello',
      language: 'en',
      createdBy: 'user123',
      status: 'approved',
      createdAt: new Date(),
      meanings: [{ definitions: [{ definition: 'A greeting' }] }],
    },
    {
      _id: 'word2',
      word: 'bonjour',
      language: 'fr',
      createdBy: 'user123',
      status: 'approved',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      meanings: [{ definitions: [{ definition: 'Une salutation' }] }],
    },
  ];

  beforeEach(async () => {
    // Mock repositories
    const mockUserRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      update: jest.fn(),
      search: jest.fn(),
      incrementWordCount: jest.fn(),
      updateLastActive: jest.fn(),
      findAll: jest.fn(),
      findActiveUsers: jest.fn(),
    };

    const mockActivityFeedRepository = {
      getUserActivities: jest.fn(),
      getActivitiesByPeriod: jest.fn(),
      getDistinctLanguagesByUser: jest.fn(),
    };

    const mockWordRepository = {
      countByCreatorAndStatus: jest.fn(),
      findByCreator: jest.fn(),
      getDistinctLanguagesByCreator: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: 'IUserRepository', useValue: mockUserRepository },
        { provide: 'IActivityFeedRepository', useValue: mockActivityFeedRepository },
        { provide: 'IWordRepository', useValue: mockWordRepository },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
    userRepository = module.get('IUserRepository');
    activityFeedRepository = module.get('IActivityFeedRepository');
    wordRepository = module.get('IWordRepository');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('👤 Basic CRUD Operations', () => {
    it('should find user by ID', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);

      const result = await usersService.findById('user123');

      expect(result).toEqual(mockUser);
      expect(userRepository.findById).toHaveBeenCalledWith('user123');
    });

    it('should find user by email', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);

      const result = await usersService.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should find user by username', async () => {
      userRepository.findByUsername.mockResolvedValue(mockUser as any);

      const result = await usersService.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(userRepository.findByUsername).toHaveBeenCalledWith('testuser');
    });

    it('should update user', async () => {
      const updateData = { profilePicture: 'new-pic.jpg' };
      const updatedUser = { ...mockUser, ...updateData };
      
      userRepository.update.mockResolvedValue(updatedUser as any);

      const result = await usersService.updateUser('user123', updateData);

      expect(result).toEqual(updatedUser);
      expect(userRepository.update).toHaveBeenCalledWith('user123', updateData);
    });
  });

  describe('🔍 User Search', () => {
    it('should search users and exclude specified user', async () => {
      const searchResults = [mockUser, { ...mockUser, _id: 'user456', username: 'otheruser' }];
      userRepository.search.mockResolvedValue(searchResults as any);

      const result = await usersService.searchUsers('test', 'user456');

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('user123');
      expect(userRepository.search).toHaveBeenCalledWith('test', {
        limit: 10,
        offset: 0,
      });
    });

    it('should search users without exclusion', async () => {
      const searchResults = [mockUser];
      userRepository.search.mockResolvedValue(searchResults as any);

      const result = await usersService.searchUsers('test');

      expect(result).toEqual(searchResults);
      expect(userRepository.search).toHaveBeenCalledWith('test', {
        limit: 10,
        offset: undefined,
      });
    });
  });

  describe('📊 User Statistics', () => {
    it('should calculate user stats correctly', async () => {
      // Setup mocks
      userRepository.findById.mockResolvedValue(mockUser as any);
      wordRepository.countByCreatorAndStatus.mockResolvedValue(5);
      activityFeedRepository.getUserActivities.mockResolvedValue(mockActivities);
      activityFeedRepository.getActivitiesByPeriod.mockResolvedValue(mockActivities);
      activityFeedRepository.getDistinctLanguagesByUser
        .mockResolvedValueOnce(['en', 'fr']) // contribution languages
        .mockResolvedValueOnce(['en', 'fr', 'es']); // all activity languages
      wordRepository.getDistinctLanguagesByCreator.mockResolvedValue(['en', 'fr']);

      const result = await usersService.getUserStats('user123');

      expect(result).toEqual({
        totalWordsAdded: 5,
        totalCommunityPosts: 2,
        favoriteWordsCount: 0, // Placeholder
        joinDate: expect.any(Date),
        streak: expect.any(Number),
        languagesContributed: 2,
        languagesExplored: 3,
        contributionScore: expect.any(Number),
        activitiesThisWeek: 2,
        lastActivityDate: expect.any(Date),
      });

      expect(wordRepository.countByCreatorAndStatus).toHaveBeenCalledWith('user123', 'approved');
    });

    it('should handle user not found in stats', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(usersService.getUserStats('nonexistent')).rejects.toThrow('Utilisateur non trouvé');
    });
  });

  describe('🔥 Activity Streak Calculation', () => {
    it('should calculate activity streak correctly', async () => {
      const today = new Date();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const activitiesWithDates = [
        { ...mockActivities[0], createdAt: today },
        { ...mockActivities[1], createdAt: yesterday },
      ];
      
      activityFeedRepository.getUserActivities.mockResolvedValue(activitiesWithDates);

      const result = await usersService.getUserActivityStreak('user123');

      expect(result).toBeGreaterThanOrEqual(1); // At least 1 day streak
      expect(activityFeedRepository.getUserActivities).toHaveBeenCalledWith('user123', {
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 1000,
      });
    });

    it('should return 0 for user with no activities', async () => {
      activityFeedRepository.getUserActivities.mockResolvedValue([]);

      const result = await usersService.getUserActivityStreak('user123');

      expect(result).toBe(0);
    });
  });

  describe('📈 Personal Stats', () => {
    it('should calculate comprehensive personal stats', async () => {
      // Setup all mocks
      userRepository.findById.mockResolvedValue(mockUser as any);
      activityFeedRepository.getUserActivities
        .mockResolvedValueOnce(mockActivities) // For streak calculation
        .mockResolvedValueOnce([mockActivities[0]]); // For last activity
      wordRepository.countByCreatorAndStatus.mockResolvedValue(5);
      activityFeedRepository.getActivitiesByPeriod.mockResolvedValue(mockActivities);
      activityFeedRepository.getDistinctLanguagesByUser
        .mockResolvedValueOnce(['en', 'fr']) // contribution languages
        .mockResolvedValueOnce(['en', 'fr', 'es']); // all languages
      wordRepository.getDistinctLanguagesByCreator.mockResolvedValue(['en', 'fr']);

      const result = await usersService.getUserPersonalStats('user123');

      expect(result).toEqual({
        wordsAdded: 5,
        favoritesCount: 0, // Placeholder
        languagesContributed: 2,
        languagesExplored: 3, // Combined unique languages
        contributionScore: expect.any(Number),
        streak: expect.any(Number),
        lastActivityDate: expect.any(Date),
        activitiesThisWeek: 2,
      });
    });
  });

  describe('📝 Recent Contributions', () => {
    it('should get user recent contributions', async () => {
      wordRepository.findByCreator.mockResolvedValue(mockWords as any);

      const result = await usersService.getUserRecentContributions('user123', 5);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'word1',
        word: 'hello',
        language: 'en',
        definition: 'A greeting',
        createdAt: expect.any(Date),
        isOwner: true,
      });

      expect(wordRepository.findByCreator).toHaveBeenCalledWith('user123', {
        status: 'approved',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 5,
      });
    });

    it('should handle empty contributions', async () => {
      wordRepository.findByCreator.mockResolvedValue([]);

      const result = await usersService.getUserRecentContributions('user123');

      expect(result).toEqual([]);
    });
  });

  describe('👀 Recent Consultations', () => {
    it('should return empty consultations (placeholder)', async () => {
      const result = await usersService.getUserRecentConsultations('user123');

      expect(result).toEqual([]);
    });
  });

  describe('⚡ User Activity Management', () => {
    it('should increment word count', async () => {
      userRepository.incrementWordCount.mockResolvedValue(true);

      await usersService.incrementWordCount('user123');

      expect(userRepository.incrementWordCount).toHaveBeenCalledWith('user123');
    });

    it('should increment post count', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);
      userRepository.update.mockResolvedValue(mockUser as any);

      await usersService.incrementPostCount('user123');

      expect(userRepository.update).toHaveBeenCalledWith('user123', {
        totalCommunityPosts: 3, // mockUser.totalCommunityPosts + 1
      });
    });

    it('should update last active', async () => {
      userRepository.updateLastActive.mockResolvedValue(true);

      await usersService.updateLastActive('user123');

      expect(userRepository.updateLastActive).toHaveBeenCalledWith('user123');
    });
  });

  describe('👥 User Management', () => {
    it('should find all users', async () => {
      const usersResult = {
        users: [mockUser],
        total: 1,
        page: 1,
        limit: 10,
      };
      userRepository.findAll.mockResolvedValue(usersResult as any);

      const result = await usersService.findAll();

      expect(result).toEqual([mockUser]);
      expect(userRepository.findAll).toHaveBeenCalled();
    });

    it('should activate super admins', async () => {
      const adminUsers = { users: [{ ...mockUser, role: 'admin', isActive: false }], total: 1, page: 1, limit: 10 };
      const superAdminUsers = { users: [{ ...mockUser, role: 'superadmin', isActive: false }], total: 1, page: 1, limit: 10 };
      const contributorUsers = { users: [{ ...mockUser, role: 'contributor', isActive: false }], total: 1, page: 1, limit: 10 };

      userRepository.findAll
        .mockResolvedValueOnce(adminUsers as any)
        .mockResolvedValueOnce(superAdminUsers as any)
        .mockResolvedValueOnce(contributorUsers as any);
      
      userRepository.update.mockResolvedValue(mockUser as any);

      const result = await usersService.activateSuperAdmins();

      expect(result).toBe(3); // 3 users activated
      expect(userRepository.update).toHaveBeenCalledTimes(3);
    });

    it('should get active users count', async () => {
      const activeUsers = [mockUser, { ...mockUser, _id: 'user456' }];
      userRepository.findActiveUsers.mockResolvedValue(activeUsers as any);

      const result = await usersService.getActiveUsersCount();

      expect(result).toBe(2);
      expect(userRepository.findActiveUsers).toHaveBeenCalledWith(0.003); // ~5 minutes in days
    });

    it('should get online contributors count', async () => {
      const contributorUsers = [
        { ...mockUser, totalWordsAdded: 5 },
        { ...mockUser, _id: 'user456', role: 'contributor', totalWordsAdded: 0 },
      ];
      userRepository.findActiveUsers.mockResolvedValue(contributorUsers as any);

      const result = await usersService.getOnlineContributorsCount();

      expect(result).toBe(2); // Both qualify as contributors
      expect(userRepository.findActiveUsers).toHaveBeenCalledWith(0.003);
    });
  });

  describe('🚨 Error Handling', () => {
    it('should handle repository errors gracefully in getUserPersonalStats', async () => {
      userRepository.findById.mockRejectedValue(new Error('Database error'));

      const result = await usersService.getUserPersonalStats('user123');

      expect(result).toEqual({
        wordsAdded: 0,
        favoritesCount: 0,
        languagesContributed: 0,
        languagesExplored: 0,
        contributionScore: 0,
        streak: 0,
        activitiesThisWeek: 0,
      });
    });

    it('should handle streak calculation errors', async () => {
      activityFeedRepository.getUserActivities.mockRejectedValue(new Error('Database error'));

      const result = await usersService.getUserActivityStreak('user123');

      expect(result).toBe(0);
    });

    it('should handle contribution retrieval errors', async () => {
      wordRepository.findByCreator.mockRejectedValue(new Error('Database error'));

      const result = await usersService.getUserRecentContributions('user123');

      expect(result).toEqual([]);
    });
  });
});