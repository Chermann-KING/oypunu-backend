import { Like } from '../../communities/schemas/like.schema';

export interface ILikeRepository {
  create(like: Partial<Like>): Promise<Like>;
  findById(id: string): Promise<Like | null>;
  findByUserAndTarget(userId: string, targetType: string, targetId: string): Promise<Like | null>;
  findByTarget(targetType: string, targetId: string): Promise<Like[]>;
  findByUser(userId: string, options?: {
    limit?: number;
    offset?: number;
    targetType?: string;
  }): Promise<Like[]>;
  delete(id: string): Promise<boolean>;
  deleteByUserAndTarget(userId: string, targetType: string, targetId: string): Promise<boolean>;
  countByTarget(targetType: string, targetId: string): Promise<number>;
  countByUser(userId: string): Promise<number>;
  getUserTargetLikes(userId: string, targetType: string, targetIds: string[]): Promise<Like[]>;
}