/**
 * @fileoverview Décorateur de rôles pour contrôle d'accès O'Ypunu
 * 
 * Ce décorateur simple permet de définir les rôles requis pour
 * accéder à un endpoint ou une méthode. Il stocke les rôles dans
 * les métadonnées qui seront lues par les guards d'autorisation.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { SetMetadata } from '@nestjs/common';

/**
 * Clé de métadonnée pour stockage des rôles requis
 * 
 * @constant {string} ROLES_KEY
 */
export const ROLES_KEY = 'roles';

/**
 * Décorateur pour spécifier les rôles requis sur les endpoints
 * 
 * Ce décorateur permet de définir simplement les rôles autorisés
 * pour accéder à un endpoint. Il est utilisé conjointement avec
 * les guards de rôles (RoleGuard) pour l'autorisation.
 * 
 * @function Roles
 * @param {...string[]} roles - Liste des rôles autorisés
 * @returns {MethodDecorator} Décorateur de méthode NestJS
 * 
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, RoleGuard)
 * @Roles('admin', 'superadmin')
 * @Post('admin-action')
 * async adminAction() {
 *   // Seuls les admins et superadmins peuvent accéder
 * }
 * 
 * @Roles('contributor')
 * @Post('contribute')
 * async contribute() {
 *   // Contributors, admins et superadmins peuvent accéder
 *   // (grâce à la hiérarchie des rôles)
 * }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
