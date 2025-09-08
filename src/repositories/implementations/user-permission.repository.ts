/**
 * @fileoverview Implémentation du repository des permissions utilisateur
 *
 * Repository Mongoose pour la gestion des permissions contextuelles
 * avec optimisations de performance et gestion d'erreurs robuste.
 *
 * @author Équipe O'Ypunu Backend
 * @version 1.0.0
 * @since 2025-01-01
 */

import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  UserPermission,
  UserPermissionDocument,
} from "../../admin/schemas/user-permission.schema";
import {
  IUserPermissionRepository,
  PermissionSearchOptions,
  PermissionSearchResult,
  PermissionStats,
} from "../interfaces/user-permission.repository.interface";
import { DatabaseErrorHandler } from "../../common/errors/handlers/database-error.handler";

/**
 * Repository pour les permissions utilisateur avec Mongoose
 *
 * Implémentation complète du repository avec gestion d'erreurs,
 * optimisations de performance et requêtes complexes.
 */
@Injectable()
export class UserPermissionRepository implements IUserPermissionRepository {
  constructor(
    @InjectModel(UserPermission.name)
    private userPermissionModel: Model<UserPermissionDocument>
  ) {}

  // ========== CRUD DE BASE ==========

  async create(permissionData: {
    userId: string;
    permission: string;
    context?: string;
    contextId?: string;
    grantedBy: string;
    metadata?: Record<string, any>;
  }): Promise<UserPermission> {
    return DatabaseErrorHandler.handleCreateOperation(async () => {
      const permission = new this.userPermissionModel({
        userId: new Types.ObjectId(permissionData.userId),
        permission: permissionData.permission,
        context: permissionData.context,
        contextId: permissionData.contextId,
        grantedBy: permissionData.grantedBy as any,
        metadata: permissionData.metadata || {},
        granted: true,
        grantedAt: new Date(),
      });

      const savedPermission = await permission.save();

      return this.userPermissionModel
        .findById(savedPermission._id)
        .populate("userId", "username email role")
        .populate("grantedBy", "username email")
        .exec();
    }, "UserPermission");
  }

  async findById(id: string): Promise<UserPermission | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }

        return this.userPermissionModel
          .findById(id)
          .populate("userId", "username email role")
          .populate("grantedBy", "username email")
          .populate("revokedBy", "username email")
          .exec();
      },
      "UserPermission",
      id
    );
  }

  async update(
    id: string,
    updateData: Partial<UserPermission>
  ): Promise<UserPermission | null> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return null;
        }

        return this.userPermissionModel
          .findByIdAndUpdate(id, updateData, { new: true })
          .populate("userId", "username email role")
          .populate("grantedBy", "username email")
          .populate("revokedBy", "username email")
          .exec();
      },
      "UserPermission",
      id
    );
  }

  async delete(id: string): Promise<boolean> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        if (!Types.ObjectId.isValid(id)) {
          return false;
        }

        const result = await this.userPermissionModel
          .findByIdAndDelete(id)
          .exec();
        return result !== null;
      },
      "UserPermission",
      id
    );
  }

  // ========== RECHERCHE DE PERMISSIONS ==========

  async findByUserId(
    userId: string,
    options: PermissionSearchOptions = {}
  ): Promise<PermissionSearchResult> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (!Types.ObjectId.isValid(userId)) {
        return { permissions: [], total: 0, page: 1, limit: 10 };
      }

      const {
        includeRevoked = false,
        context,
        contextId,
        grantedBy,
        limit = 20,
        skip = 0,
        sortBy = "grantedAt",
        sortOrder = "desc",
      } = options;

      const filter: any = { userId: new Types.ObjectId(userId) };

      if (!includeRevoked) {
        filter.granted = true;
      }

      if (context) {
        filter.context = context;
      }

      if (contextId) {
        filter.contextId = contextId;
      }

      if (grantedBy) {
        filter.grantedBy = grantedBy as any;
      }

      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      const [permissions, total] = await Promise.all([
        this.userPermissionModel
          .find(filter)
          .populate("userId", "username email role")
          .populate("grantedBy", "username email")
          .populate("revokedBy", "username email")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.userPermissionModel.countDocuments(filter).exec(),
      ]);

      const page = Math.floor(skip / limit) + 1;
      return { permissions, total, page, limit };
    }, "UserPermission");
  }

  async hasPermission(
    userId: string,
    permission: string,
    context?: string,
    contextId?: string
  ): Promise<boolean> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      if (!Types.ObjectId.isValid(userId)) {
        return false;
      }

      const filter: any = {
        userId: new Types.ObjectId(userId),
        permission,
        granted: true,
      };

      if (context) {
        filter.context = context;
      }

      if (contextId) {
        filter.contextId = contextId;
      }

      const permissionDoc = await this.userPermissionModel
        .findOne(filter)
        .select("_id")
        .exec();

      return permissionDoc !== null;
    }, "UserPermission");
  }

  async findUserPermission(
    userId: string,
    permission: string,
    context?: string,
    contextId?: string
  ): Promise<UserPermission | null> {
    return DatabaseErrorHandler.handleFindOperation(
      async () => {
        if (!Types.ObjectId.isValid(userId)) {
          return null;
        }

        const filter: any = {
          userId: new Types.ObjectId(userId),
          permission,
        };

        if (context) {
          filter.context = context;
        }

        if (contextId) {
          filter.contextId = contextId;
        }

        return this.userPermissionModel
          .findOne(filter)
          .populate("userId", "username email role")
          .populate("grantedBy", "username email")
          .populate("revokedBy", "username email")
          .sort({ grantedAt: -1 })
          .exec();
      },
      "UserPermission",
      `${userId}-${permission}`
    );
  }

  async findByPermission(
    permission: string,
    options: PermissionSearchOptions = {}
  ): Promise<PermissionSearchResult> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      const {
        includeRevoked = false,
        context,
        contextId,
        limit = 20,
        skip = 0,
        sortBy = "grantedAt",
        sortOrder = "desc",
      } = options;

      const filter: any = { permission };

      if (!includeRevoked) {
        filter.granted = true;
      }

      if (context) {
        filter.context = context;
      }

      if (contextId) {
        filter.contextId = contextId;
      }

      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      const [permissions, total] = await Promise.all([
        this.userPermissionModel
          .find(filter)
          .populate("userId", "username email role")
          .populate("grantedBy", "username email")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.userPermissionModel.countDocuments(filter).exec(),
      ]);

      const page = Math.floor(skip / limit) + 1;
      return { permissions, total, page, limit };
    }, "UserPermission");
  }

  async findByContext(
    context: string,
    contextId?: string,
    options: PermissionSearchOptions = {}
  ): Promise<PermissionSearchResult> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      const {
        includeRevoked = false,
        limit = 20,
        skip = 0,
        sortBy = "grantedAt",
        sortOrder = "desc",
      } = options;

      const filter: any = { context };

      if (!includeRevoked) {
        filter.granted = true;
      }

      if (contextId) {
        filter.contextId = contextId;
      }

      const sort: any = {};
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;

      const [permissions, total] = await Promise.all([
        this.userPermissionModel
          .find(filter)
          .populate("userId", "username email role")
          .populate("grantedBy", "username email")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.userPermissionModel.countDocuments(filter).exec(),
      ]);

      const page = Math.floor(skip / limit) + 1;
      return { permissions, total, page, limit };
    }, "UserPermission");
  }

  // ========== GESTION DES PERMISSIONS ==========

  async grantPermission(
    userId: string,
    permission: string,
    grantedBy: string,
    context?: string,
    contextId?: string,
    metadata?: Record<string, any>
  ): Promise<UserPermission> {
    return DatabaseErrorHandler.handleCreateOperation(async () => {
      // Vérifier si la permission existe déjà
      const existingPermission = await this.findUserPermission(
        userId,
        permission,
        context,
        contextId
      );

      if (existingPermission) {
        // Si révoquée, la réactiver
        if (!existingPermission.granted) {
          return this.update((existingPermission as any)._id.toString(), {
            granted: true,
            grantedAt: new Date(),
            grantedBy: new Types.ObjectId(grantedBy) as any,
            revokedAt: undefined,
            revokedBy: undefined,
            metadata: { ...existingPermission.metadata, ...metadata },
          });
        }
        // Si déjà accordée, retourner la permission existante
        return existingPermission;
      }

      // Créer une nouvelle permission
      return this.create({
        userId,
        permission,
        context,
        contextId,
        grantedBy,
        metadata,
      });
    }, "UserPermission");
  }

  async revokePermission(
    userId: string,
    permission: string,
    revokedBy: string,
    context?: string,
    contextId?: string
  ): Promise<boolean> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (
          !Types.ObjectId.isValid(userId) ||
          !Types.ObjectId.isValid(revokedBy)
        ) {
          return false;
        }

        const filter: any = {
          userId: new Types.ObjectId(userId),
          permission,
          granted: true,
        };

        if (context) {
          filter.context = context;
        }

        if (contextId) {
          filter.contextId = contextId;
        }

        const result = await this.userPermissionModel
          .updateOne(filter, {
            granted: false,
            revokedAt: new Date(),
            revokedBy: revokedBy as any,
          })
          .exec();

        return result.modifiedCount > 0;
      },
      "UserPermission",
      `${userId}-${permission}`
    );
  }

  async revokeAllUserPermissions(
    userId: string,
    revokedBy: string
  ): Promise<number> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (
          !Types.ObjectId.isValid(userId) ||
          !Types.ObjectId.isValid(revokedBy)
        ) {
          return 0;
        }

        const result = await this.userPermissionModel
          .updateMany(
            {
              userId: new Types.ObjectId(userId),
              granted: true,
            },
            {
              granted: false,
              revokedAt: new Date(),
              revokedBy: revokedBy as any,
            }
          )
          .exec();

        return result.modifiedCount;
      },
      "UserPermission",
      userId
    );
  }

  async revokeContextPermissions(
    context: string,
    contextId: string,
    revokedBy: string
  ): Promise<number> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        if (!Types.ObjectId.isValid(revokedBy)) {
          return 0;
        }

        const result = await this.userPermissionModel
          .updateMany(
            {
              context,
              contextId,
              granted: true,
            },
            {
              granted: false,
              revokedAt: new Date(),
              revokedBy: revokedBy as any,
            }
          )
          .exec();

        return result.modifiedCount;
      },
      "UserPermission",
      `${context}-${contextId}`
    );
  }

  // ========== HISTORIQUE ET AUDIT ==========

  async getUserPermissionHistory(
    userId: string,
    options: PermissionSearchOptions = {}
  ): Promise<PermissionSearchResult> {
    // Inclure toutes les permissions (accordées et révoquées) pour l'historique
    return this.findByUserId(userId, { ...options, includeRevoked: true });
  }

  async getPermissionsByAdmin(
    adminId: string,
    options: PermissionSearchOptions = {}
  ): Promise<PermissionSearchResult> {
    return this.findByUserId(adminId, { ...options, grantedBy: adminId });
  }

  async getPermissionStats(
    userId?: string,
    context?: string
  ): Promise<PermissionStats> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      const filter: any = {};

      if (userId) {
        filter.userId = new Types.ObjectId(userId);
      }

      if (context) {
        filter.context = context;
      }

      const [
        totalPermissions,
        activePermissions,
        revokedPermissions,
        permissionsByType,
        permissionsByContext,
      ] = await Promise.all([
        this.userPermissionModel.countDocuments(filter).exec(),
        this.userPermissionModel
          .countDocuments({ ...filter, granted: true })
          .exec(),
        this.userPermissionModel
          .countDocuments({ ...filter, granted: false })
          .exec(),
        this.userPermissionModel
          .aggregate([
            { $match: filter },
            { $group: { _id: "$permission", count: { $sum: 1 } } },
          ])
          .exec(),
        this.userPermissionModel
          .aggregate([
            { $match: filter },
            { $group: { _id: "$context", count: { $sum: 1 } } },
          ])
          .exec(),
      ]);

      return {
        totalPermissions,
        activePermissions,
        revokedPermissions,
        permissionsByType: permissionsByType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        permissionsByContext: permissionsByContext.reduce((acc, item) => {
          acc[item._id || "global"] = item.count;
          return acc;
        }, {}),
      };
    }, "UserPermission");
  }

  // ========== MAINTENANCE ==========

  async cleanupOrphanedPermissions(): Promise<number> {
    return DatabaseErrorHandler.handleDeleteOperation(
      async () => {
        // Trouver les permissions dont les utilisateurs n'existent plus
        const orphanedPermissions = await this.userPermissionModel
          .aggregate([
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "user",
              },
            },
            {
              $match: { user: { $size: 0 } },
            },
            {
              $project: { _id: 1 },
            },
          ])
          .exec();

        if (orphanedPermissions.length === 0) {
          return 0;
        }

        const orphanedIds = orphanedPermissions.map((p) => p._id);
        const result = await this.userPermissionModel
          .deleteMany({
            _id: { $in: orphanedIds },
          })
          .exec();

        return result.deletedCount;
      },
      "UserPermission",
      "orphaned-cleanup"
    );
  }

  async archiveOldPermissions(olderThanDays: number): Promise<number> {
    return DatabaseErrorHandler.handleUpdateOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const result = await this.userPermissionModel
          .updateMany(
            {
              granted: false,
              revokedAt: { $lt: cutoffDate },
            },
            {
              $set: {
                "metadata.archived": true,
                "metadata.archivedAt": new Date(),
              },
            }
          )
          .exec();

        return result.modifiedCount;
      },
      "UserPermission",
      "archive-operation"
    );
  }

  async validatePermissionIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    return DatabaseErrorHandler.handleSearchOperation(async () => {
      const issues: string[] = [];

      // Vérifier les permissions sans utilisateur valide
      const invalidUserIds = await this.userPermissionModel
        .aggregate([
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "user",
            },
          },
          {
            $match: { user: { $size: 0 } },
          },
          {
            $count: "count",
          },
        ])
        .exec();

      if (invalidUserIds.length > 0 && invalidUserIds[0].count > 0) {
        issues.push(
          `${invalidUserIds[0].count} permissions avec des utilisateurs invalides`
        );
      }

      // Vérifier les permissions sans grantedBy valide
      const invalidGrantedBy = await this.userPermissionModel
        .aggregate([
          {
            $lookup: {
              from: "users",
              localField: "grantedBy",
              foreignField: "_id",
              as: "grantor",
            },
          },
          {
            $match: { grantor: { $size: 0 } },
          },
          {
            $count: "count",
          },
        ])
        .exec();

      if (invalidGrantedBy.length > 0 && invalidGrantedBy[0].count > 0) {
        issues.push(
          `${invalidGrantedBy[0].count} permissions avec des accordants invalides`
        );
      }

      // Vérifier les permissions révoquées sans revokedBy
      const invalidRevoked = await this.userPermissionModel
        .countDocuments({
          granted: false,
          revokedAt: { $exists: true },
          revokedBy: { $exists: false },
        })
        .exec();

      if (invalidRevoked > 0) {
        issues.push(`${invalidRevoked} permissions révoquées sans revokedBy`);
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    }, "UserPermission");
  }
}
