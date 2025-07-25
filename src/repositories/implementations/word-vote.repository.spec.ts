import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WordVoteRepository } from './word-vote.repository';
import { WordVote, WordVoteDocument } from '../../social/schemas/word-vote.schema';

/**
 * 🧪 TESTS UNITAIRES - WORD VOTE REPOSITORY
 * 
 * Tests complets pour le repository de votes sophistiqués.
 * Couvre toutes les méthodes critiques avec mocks et validation.
 * 
 * Couverture :
 * - CRUD de base (create, findById, update, delete)
 * - Gestion des votes (vote, removeUserVote, hasUserVoted)
 * - Statistiques (getWordScore, getWeightedScore, countByWord)
 * - Classements (getMostReacted, getTopQualityWords, getTrendingWords)
 * - Métriques utilisateur (getUserVotingStats, findByUser)
 * - Cas d'erreur et validation ObjectId
 */

describe('WordVoteRepository', () => {
  let repository: WordVoteRepository;
  let model: Model<WordVoteDocument>;
  
  // Mock data constants
  const mockUserId = new Types.ObjectId().toString();
  const mockWordId = new Types.ObjectId().toString();
  const mockVoteId = new Types.ObjectId().toString();
  const mockInvalidId = 'invalid-id';

  const mockWordVote = {
    _id: new Types.ObjectId(mockVoteId),
    userId: new Types.ObjectId(mockUserId),
    wordId: new Types.ObjectId(mockWordId),
    reactionType: 'like',
    context: 'word',
    weight: 1.5,
    comment: 'Test comment',
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn(),
    populate: jest.fn(),
  };

  const mockModelMethods = {
    save: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    deleteMany: jest.fn(),
    populate: jest.fn(),
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    select: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WordVoteRepository,
        {
          provide: getModelToken(WordVote.name),
          useValue: {
            ...mockModelMethods,
            // Constructor mock for new model instances
            new: jest.fn(() => ({
              ...mockWordVote,
              save: jest.fn().mockResolvedValue(mockWordVote),
            })),
          },
        },
      ],
    }).compile();

    repository = module.get<WordVoteRepository>(WordVoteRepository);
    model = module.get<Model<WordVoteDocument>>(getModelToken(WordVote.name));

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    describe('create', () => {
      it('should create a new word vote successfully', async () => {
        const voteData = {
          userId: mockUserId,
          wordId: mockWordId,
          reactionType: 'like' as const,
          context: 'word' as const,
          weight: 1.5,
        };

        // Mock constructor behavior
        const saveSpy = jest.fn().mockResolvedValue(mockWordVote);
        (model as any).mockImplementation(() => ({
          ...mockWordVote,
          save: saveSpy,
        }));

        const result = await repository.create(voteData);

        expect(result).toEqual(mockWordVote);
        expect(saveSpy).toHaveBeenCalled();
      });

      it('should throw error for invalid ObjectId in create', async () => {
        const invalidVoteData = {
          userId: mockInvalidId,
          wordId: mockWordId,
          reactionType: 'like' as const,
        };

        await expect(repository.create(invalidVoteData)).rejects.toThrow(
          'Invalid ObjectId format'
        );
      });

      it('should set default values for optional fields', async () => {
        const minimalVoteData = {
          userId: mockUserId,
          wordId: mockWordId,
          reactionType: 'accurate' as const,
        };

        const saveSpy = jest.fn().mockResolvedValue({
          ...mockWordVote,
          reactionType: 'accurate',
          context: 'word',
          weight: 1,
        });
        
        (model as any).mockImplementation(() => ({
          save: saveSpy,
        }));

        await repository.create(minimalVoteData);
        expect(saveSpy).toHaveBeenCalled();
      });
    });

    describe('findById', () => {
      it('should find vote by valid ID', async () => {
        const populateMock = jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockWordVote),
          }),
        });

        mockModelMethods.findById.mockReturnValue({
          populate: populateMock,
        });

        const result = await repository.findById(mockVoteId);

        expect(result).toEqual(mockWordVote);
        expect(mockModelMethods.findById).toHaveBeenCalledWith(mockVoteId);
        expect(populateMock).toHaveBeenCalledWith('userId', 'username email reputation');
      });

      it('should return null for invalid ObjectId', async () => {
        const result = await repository.findById(mockInvalidId);
        expect(result).toBeNull();
        expect(mockModelMethods.findById).not.toHaveBeenCalled();
      });

      it('should return null when vote not found', async () => {
        const populateMock = jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        });

        mockModelMethods.findById.mockReturnValue({
          populate: populateMock,
        });

        const result = await repository.findById(mockVoteId);
        expect(result).toBeNull();
      });
    });

    describe('update', () => {
      it('should update vote successfully', async () => {
        const updateData = { reactionType: 'love', comment: 'Updated comment' };
        const updatedVote = { ...mockWordVote, ...updateData };

        const populateMock = jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(updatedVote),
          }),
        });

        mockModelMethods.findByIdAndUpdate.mockReturnValue({
          populate: populateMock,
        });

        const result = await repository.update(mockVoteId, updateData);

        expect(result).toEqual(updatedVote);
        expect(mockModelMethods.findByIdAndUpdate).toHaveBeenCalledWith(
          mockVoteId,
          updateData,
          { new: true }
        );
      });

      it('should return null for invalid ObjectId in update', async () => {
        const result = await repository.update(mockInvalidId, {});
        expect(result).toBeNull();
      });
    });

    describe('delete', () => {
      it('should delete vote successfully', async () => {
        mockModelMethods.findByIdAndDelete.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWordVote),
        });

        const result = await repository.delete(mockVoteId);

        expect(result).toBe(true);
        expect(mockModelMethods.findByIdAndDelete).toHaveBeenCalledWith(mockVoteId);
      });

      it('should return false when vote not found', async () => {
        mockModelMethods.findByIdAndDelete.mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        });

        const result = await repository.delete(mockVoteId);
        expect(result).toBe(false);
      });

      it('should return false for invalid ObjectId', async () => {
        const result = await repository.delete(mockInvalidId);
        expect(result).toBe(false);
      });
    });
  });

  describe('Vote Management', () => {
    describe('findUserVote', () => {
      it('should find existing user vote', async () => {
        const populateMock = jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWordVote),
        });

        mockModelMethods.findOne.mockReturnValue({
          populate: populateMock,
        });

        const result = await repository.findUserVote(mockUserId, mockWordId);

        expect(result).toEqual(mockWordVote);
        expect(mockModelMethods.findOne).toHaveBeenCalledWith({
          userId: mockUserId,
          wordId: mockWordId,
        });
      });

      it('should include context and contextId in filter when provided', async () => {
        const populateMock = jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockWordVote),
        });

        mockModelMethods.findOne.mockReturnValue({
          populate: populateMock,
        });

        await repository.findUserVote(mockUserId, mockWordId, 'definition', 'def123');

        expect(mockModelMethods.findOne).toHaveBeenCalledWith({
          userId: mockUserId,
          wordId: mockWordId,
          context: 'definition',
          contextId: 'def123',
        });
      });

      it('should return null for invalid ObjectIds', async () => {
        const result = await repository.findUserVote(mockInvalidId, mockWordId);
        expect(result).toBeNull();
      });
    });

    describe('hasUserVoted', () => {
      it('should return true when user has voted', async () => {
        mockModelMethods.findOne.mockReturnValue({
          select: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ _id: mockVoteId }),
          }),
        });

        const result = await repository.hasUserVoted(mockUserId, mockWordId);

        expect(result).toBe(true);
        expect(mockModelMethods.findOne).toHaveBeenCalledWith({
          userId: mockUserId,
          wordId: mockWordId,
        });
      });

      it('should return false when user has not voted', async () => {
        mockModelMethods.findOne.mockReturnValue({
          select: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        });

        const result = await repository.hasUserVoted(mockUserId, mockWordId);
        expect(result).toBe(false);
      });

      it('should return false for invalid ObjectIds', async () => {
        const result = await repository.hasUserVoted(mockInvalidId, mockWordId);
        expect(result).toBe(false);
      });
    });

    describe('vote', () => {
      beforeEach(() => {
        // Mock findUserVote method within the repository
        jest.spyOn(repository, 'findUserVote');
        jest.spyOn(repository, 'create');
        jest.spyOn(repository, 'delete');
        jest.spyOn(repository, 'update');
      });

      it('should create new vote when user has not voted', async () => {
        (repository.findUserVote as jest.Mock).mockResolvedValue(null);
        (repository.create as jest.Mock).mockResolvedValue(mockWordVote);

        const result = await repository.vote(
          mockUserId,
          mockWordId,
          'like',
          'word',
          undefined,
          { weight: 1.5, comment: 'Great word!' }
        );

        expect(result.action).toBe('created');
        expect(result.vote).toEqual(mockWordVote);
        expect(repository.create).toHaveBeenCalledWith({
          userId: mockUserId,
          wordId: mockWordId,
          reactionType: 'like',
          context: 'word',
          contextId: undefined,
          weight: 1.5,
          comment: 'Great word!',
          userAgent: undefined,
          ipAddress: undefined,
        });
      });

      it('should remove vote when same reaction type is voted again', async () => {
        const existingVote = { ...mockWordVote, reactionType: 'like' };
        (repository.findUserVote as jest.Mock).mockResolvedValue(existingVote);
        (repository.delete as jest.Mock).mockResolvedValue(true);

        const result = await repository.vote(mockUserId, mockWordId, 'like');

        expect(result.action).toBe('removed');
        expect(result.previousReaction).toBe('like');
        expect(repository.delete).toHaveBeenCalled();
      });

      it('should update vote when different reaction type is voted', async () => {
        const existingVote = { ...mockWordVote, reactionType: 'like' };
        const updatedVote = { ...mockWordVote, reactionType: 'love' };
        
        (repository.findUserVote as jest.Mock).mockResolvedValue(existingVote);
        (repository.update as jest.Mock).mockResolvedValue(updatedVote);

        const result = await repository.vote(mockUserId, mockWordId, 'love');

        expect(result.action).toBe('updated');
        expect(result.previousReaction).toBe('like');
        expect(result.vote).toEqual(updatedVote);
      });

      it('should throw error for invalid ObjectIds', async () => {
        await expect(
          repository.vote(mockInvalidId, mockWordId, 'like')
        ).rejects.toThrow('Invalid ObjectId format');
      });
    });
  });

  describe('Statistics and Scoring', () => {
    describe('countByWord', () => {
      it('should return reaction counts for a word', async () => {
        const mockAggregateResult = [
          { _id: 'like', count: 5 },
          { _id: 'love', count: 3 },
          { _id: 'accurate', count: 2 },
        ];

        mockModelMethods.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockAggregateResult),
        });

        const result = await repository.countByWord(mockWordId);

        expect(result).toEqual({
          like: 5,
          love: 3,
          accurate: 2,
          total: 10,
        });

        expect(mockModelMethods.aggregate).toHaveBeenCalledWith([
          { $match: { wordId: mockWordId } },
          {
            $group: {
              _id: '$reactionType',
              count: { $sum: 1 }
            }
          }
        ]);
      });

      it('should return empty counts for invalid ObjectId', async () => {
        const result = await repository.countByWord(mockInvalidId);
        expect(result).toEqual({ total: 0 });
      });

      it('should filter by context when provided', async () => {
        mockModelMethods.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        });

        await repository.countByWord(mockWordId, { context: 'definition' });

        expect(mockModelMethods.aggregate).toHaveBeenCalledWith([
          { $match: { wordId: mockWordId, context: 'definition' } },
          {
            $group: {
              _id: '$reactionType',
              count: { $sum: 1 }
            }
          }
        ]);
      });
    });

    describe('getWordScore', () => {
      it('should calculate comprehensive word scores', async () => {
        const mockAggregateResult = [
          { _id: 'accurate', count: 5, totalWeight: 15, avgWeight: 3 },
          { _id: 'like', count: 10, totalWeight: 10, avgWeight: 1 },
          { _id: 'disagree', count: 2, totalWeight: 4, avgWeight: 2 },
        ];

        mockModelMethods.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockAggregateResult),
        });

        const result = await repository.getWordScore(mockWordId);

        expect(result.reactions).toEqual({
          accurate: { count: 5, weight: 15 },
          like: { count: 10, weight: 10 },
          disagree: { count: 2, weight: 4 },
        });
        expect(result.totalVotes).toBe(17);
        expect(result.averageWeight).toBeCloseTo(1.71, 2);
        expect(result.popularityScore).toBe(29);
        expect(result.qualityScore).toBeGreaterThan(0); // Should be positive due to accurate votes
      });

      it('should return zero scores for invalid ObjectId', async () => {
        const result = await repository.getWordScore(mockInvalidId);
        
        expect(result).toEqual({
          reactions: {},
          totalVotes: 0,
          averageWeight: 0,
          popularityScore: 0,
          qualityScore: 0,
        });
      });
    });

    describe('getWeightedScore', () => {
      it('should calculate weighted scores by positive/negative categories', async () => {
        const mockAggregateResult = [
          { _id: 'positive', totalWeight: 25, count: 10 },
          { _id: 'negative', totalWeight: 5, count: 2 },
          { _id: 'neutral', totalWeight: 8, count: 8 },
        ];

        mockModelMethods.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockAggregateResult),
        });

        const result = await repository.getWeightedScore(mockWordId);

        expect(result.positiveScore).toBe(25);
        expect(result.negativeScore).toBe(5);
        expect(result.neutralScore).toBe(8);
        expect(result.overallScore).toBe(24); // 25 - 5 + (8 * 0.5)
        expect(result.weightedAverage).toBeCloseTo(0.63, 2); // 24/38
      });

      it('should include context filter when provided', async () => {
        mockModelMethods.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        });

        await repository.getWeightedScore(mockWordId, 'pronunciation');

        expect(mockModelMethods.aggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            { $match: { wordId: new Types.ObjectId(mockWordId), context: 'pronunciation' } }
          ])
        );
      });
    });
  });

  describe('Rankings and Trends', () => {
    describe('getMostReacted', () => {
      it('should return most reacted words with quality scores', async () => {
        const mockAggregateResult = [
          {
            _id: new Types.ObjectId(),
            reactions: { like: 15, love: 8, accurate: 5 },
            totalScore: 45,
            totalVotes: 28,
          },
          {
            _id: new Types.ObjectId(),
            reactions: { helpful: 12, clear: 6 },
            totalScore: 35,
            totalVotes: 18,
          },
        ];

        mockModelMethods.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockAggregateResult),
        });

        const result = await repository.getMostReacted({
          timeframe: 'week',
          limit: 10,
          minVotes: 5,
        });

        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty('wordId');
        expect(result[0]).toHaveProperty('reactions');
        expect(result[0]).toHaveProperty('totalScore');
        expect(result[0]).toHaveProperty('qualityScore');
      });

      it('should apply timeframe filter correctly', async () => {
        mockModelMethods.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        });

        await repository.getMostReacted({ timeframe: 'day' });

        const expectedTimeFilter = expect.objectContaining({
          createdAt: expect.objectContaining({ $gte: expect.any(Date) })
        });

        expect(mockModelMethods.aggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            { $match: expectedTimeFilter }
          ])
        );
      });
    });

    describe('getTopQualityWords', () => {
      it('should return words ranked by quality score', async () => {
        const mockQualityResult = [
          {
            _id: new Types.ObjectId(),
            wordId: mockWordId,
            qualityScore: 42.5,
            accurateVotes: 15,
            clearVotes: 12,
            helpfulVotes: 8,
            totalVotes: 35,
          },
        ];

        mockModelMethods.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockQualityResult),
        });

        const result = await repository.getTopQualityWords({
          timeframe: 'month',
          limit: 5,
          minVotes: 10,
        });

        expect(result).toHaveLength(1);
        expect(result[0].qualityScore).toBe(42.5);
        expect(result[0].accurateVotes).toBe(15);
        
        // Verify quality score calculation: accurate(3x) + clear(2.5x) + helpful(2x)
        const expectedScore = (15 * 3) + (12 * 2.5) + (8 * 2);
        expect(result[0].qualityScore).toBe(expectedScore);
      });

      it('should filter by minimum votes requirement', async () => {
        mockModelMethods.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        });

        await repository.getTopQualityWords({ minVotes: 20 });

        expect(mockModelMethods.aggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            { $match: { totalVotes: { $gte: 20 } } }
          ])
        );
      });
    });

    describe('getTrendingWords', () => {
      it('should return trending words based on recent activity', async () => {
        const mockTrendingResult = [
          {
            _id: new Types.ObjectId(),
            wordId: mockWordId,
            recentVotes: 25,
            trendScore: 38.5,
            growth: 250, // 25 * 10 simplified calculation
          },
        ];

        mockModelMethods.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockTrendingResult),
        });

        const result = await repository.getTrendingWords({
          timeframe: 'hour',
          limit: 15,
        });

        expect(result).toHaveLength(1);
        expect(result[0].trendScore).toBe(38.5);
        expect(result[0].recentVotes).toBe(25);
        expect(result[0]).toHaveProperty('wordId');
      });

      it('should apply correct timeframe filter', async () => {
        mockModelMethods.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        });

        await repository.getTrendingWords({ timeframe: 'week' });

        const expectedFilter = expect.objectContaining({
          createdAt: expect.objectContaining({ $gte: expect.any(Date) })
        });

        expect(mockModelMethods.aggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            { $match: expectedFilter }
          ])
        );
      });
    });
  });

  describe('User Metrics', () => {
    describe('findByUser', () => {
      it('should return paginated user votes', async () => {
        const mockUserVotes = [mockWordVote];
        const mockCount = 1;

        const populateMock = jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockUserVotes),
              }),
            }),
          }),
        });

        mockModelMethods.find.mockReturnValue({
          populate: populateMock,
        });

        mockModelMethods.countDocuments.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockCount),
        });

        const result = await repository.findByUser(mockUserId, {
          page: 1,
          limit: 10,
          sortOrder: 'desc',
        });

        expect(result.votes).toEqual(mockUserVotes);
        expect(result.total).toBe(mockCount);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(10);
      });

      it('should filter by reaction type when provided', async () => {
        const mockReturnValue = {
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        };

        mockModelMethods.find.mockReturnValue(mockReturnValue);
        mockModelMethods.countDocuments.mockReturnValue({
          exec: jest.fn().mockResolvedValue(0),
        });

        await repository.findByUser(mockUserId, { reactionType: 'accurate' });

        expect(mockModelMethods.find).toHaveBeenCalledWith({
          userId: mockUserId,
          reactionType: 'accurate',
        });
      });

      it('should return empty result for invalid ObjectId', async () => {
        const result = await repository.findByUser(mockInvalidId);
        
        expect(result).toEqual({
          votes: [],
          total: 0,
          page: 1,
          limit: 20,
        });
      });
    });

    describe('getUserVotingStats', () => {
      it('should calculate comprehensive user voting statistics', async () => {
        const mockStatsResult = [
          { _id: 'accurate', count: 15, totalWeight: 45 },
          { _id: 'like', count: 25, totalWeight: 25 },
          { _id: 'helpful', count: 8, totalWeight: 16 },
        ];

        mockModelMethods.aggregate.mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockStatsResult),
        });

        const result = await repository.getUserVotingStats(mockUserId);

        expect(result.totalVotes).toBe(48);
        expect(result.reactionBreakdown).toEqual({
          accurate: 15,
          like: 25,
          helpful: 8,
        });
        expect(result.averageWeight).toBeCloseTo(1.79, 2); // 86/48
        expect(result.contributionScore).toBeGreaterThan(0);
      });

      it('should return zero stats for invalid ObjectId', async () => {
        const result = await repository.getUserVotingStats(mockInvalidId);
        
        expect(result).toEqual({
          totalVotes: 0,
          reactionBreakdown: {},
          averageWeight: 0,
          contributionScore: 0,
        });
      });
    });
  });

  describe('Maintenance Operations', () => {
    describe('deleteUserVotes', () => {
      it('should delete all votes by user', async () => {
        mockModelMethods.deleteMany.mockReturnValue({
          exec: jest.fn().mockResolvedValue({ deletedCount: 15 }),
        });

        const result = await repository.deleteUserVotes(mockUserId);

        expect(result).toBe(15);
        expect(mockModelMethods.deleteMany).toHaveBeenCalledWith({
          userId: mockUserId,
        });
      });

      it('should return 0 for invalid ObjectId', async () => {
        const result = await repository.deleteUserVotes(mockInvalidId);
        expect(result).toBe(0);
      });
    });

    describe('deleteWordVotes', () => {
      it('should delete all votes for a word', async () => {
        mockModelMethods.deleteMany.mockReturnValue({
          exec: jest.fn().mockResolvedValue({ deletedCount: 32 }),
        });

        const result = await repository.deleteWordVotes(mockWordId);

        expect(result).toBe(32);
        expect(mockModelMethods.deleteMany).toHaveBeenCalledWith({
          wordId: mockWordId,
        });
      });
    });

    describe('cleanupOldVotes', () => {
      it('should delete votes older than specified days', async () => {
        const days = 30;
        mockModelMethods.deleteMany.mockReturnValue({
          exec: jest.fn().mockResolvedValue({ deletedCount: 5 }),
        });

        const result = await repository.cleanupOldVotes(days);

        expect(result).toBe(5);
        expect(mockModelMethods.deleteMany).toHaveBeenCalledWith({
          createdAt: { $lt: expect.any(Date) },
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      mockModelMethods.findById.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(repository.findById(mockVoteId)).rejects.toThrow();
    });

    it('should handle aggregate operation failures', async () => {
      mockModelMethods.aggregate.mockImplementation(() => {
        throw new Error('Aggregation failed');
      });

      await expect(repository.getWordScore(mockWordId)).rejects.toThrow();
    });
  });
});