import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  UseGuards,
  Req,
  NotFoundException,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserDocument } from '../schemas/user.schema';
import { UpdateProfileDto } from '../dto/update-profile.dto';

interface UserResponse {
  id: string;
  email: string;
  username: string;
  isEmailVerified: boolean;
  role: string;
  nativeLanguage: string;
  learningLanguages: string[];
  profilePicture?: string;
  bio?: string;
  location?: string;
  website?: string;
  isProfilePublic: boolean;
  lastActive: Date;
}

interface PublicUserResponse {
  id: string;
  username: string;
  nativeLanguage: string;
  learningLanguages: string[];
  profilePicture?: string;
  bio?: string;
  location?: string;
  website?: string;
  lastActive: Date;
}

interface UserStatsResponse {
  totalWordsAdded: number;
  totalCommunityPosts: number;
  favoriteWordsCount: number;
  joinDate: Date;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private _usersService: UsersService) {}

  @Get('allusers')
  @ApiOperation({
    summary: 'Debug - Voir tous les utilisateurs',
  })
  async getAllUsers(): Promise<any[]> {
    const users = await this._usersService.findAll();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    return users.map(user => ({
      username: user.username,
      role: user.role,
      totalWordsAdded: user.totalWordsAdded || 0,
      lastActive: user.lastActive,
      isActive: user.isActive,
      isRecentlyActive: user.lastActive && user.lastActive >= fiveMinutesAgo,
      isContributor: (user.totalWordsAdded && user.totalWordsAdded > 0) || 
                     ['contributor', 'admin', 'superadmin'].includes(user.role),
      qualifiesAsOnlineContributor: user.isActive && 
                                    user.lastActive && 
                                    user.lastActive >= fiveMinutesAgo && 
                                    (((user.totalWordsAdded && user.totalWordsAdded > 0) || 
                                     ['contributor', 'admin', 'superadmin'].includes(user.role)))
    }));
  }

  @Get('activate-user')
  @ApiOperation({
    summary: 'Debug - Activer tous les utilisateurs superadmin',
  })
  async activateUsers(): Promise<{ message: string; count: number }> {
    const result = await this._usersService.activateSuperAdmins();
    return {
      message: 'Utilisateurs superadmin activés',
      count: result
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: "Récupérer le profil de l'utilisateur connecté" })
  @ApiResponse({
    status: 200,
    description: 'Profil récupéré avec succès',
    type: Object,
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @ApiBearerAuth()
  async getProfile(
    @Req() req: { user: { _id: string } },
  ): Promise<UserResponse> {
    const user = (await this._usersService.findById(
      req.user._id,
    )) as UserDocument;
    if (!user || !user._id) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      isEmailVerified: user.isEmailVerified,
      role: user.role,
      nativeLanguage: user.nativeLanguage || 'fr',
      learningLanguages: user.learningLanguages || [],
      profilePicture: user.profilePicture,
      bio: user.bio,
      location: user.location,
      website: user.website,
      isProfilePublic: user.isProfilePublic,
      lastActive: user.lastActive,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @ApiOperation({
    summary: "Mettre à jour le profil de l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: 'Profil mis à jour avec succès',
    type: Object,
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @ApiBody({
    type: UpdateProfileDto,
    description: 'Données du profil à mettre à jour',
  })
  @ApiBearerAuth()
  async updateProfile(
    @Req() req: { user: { _id: string } },
    @Body() updateData: UpdateProfileDto,
  ): Promise<UserResponse> {
    const updatedUser = (await this._usersService.updateUser(
      req.user._id,
      updateData,
    )) as UserDocument;

    if (!updatedUser || !updatedUser._id) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return {
      id: updatedUser._id.toString(),
      email: updatedUser.email,
      username: updatedUser.username,
      isEmailVerified: updatedUser.isEmailVerified,
      role: updatedUser.role,
      nativeLanguage: updatedUser.nativeLanguage || 'fr',
      learningLanguages: updatedUser.learningLanguages || [],
      profilePicture: updatedUser.profilePicture,
      bio: updatedUser.bio,
      location: updatedUser.location,
      website: updatedUser.website,
      isProfilePublic: updatedUser.isProfilePublic,
      lastActive: updatedUser.lastActive,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/stats')
  @ApiOperation({
    summary: "Récupérer les statistiques de l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques récupérées avec succès',
    type: Object,
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @ApiBearerAuth()
  async getUserStats(
    @Req() req: { user: { _id: string } },
  ): Promise<UserStatsResponse> {
    console.log('getUserStats - req.user:', req.user);
    console.log('getUserStats - userId:', req.user._id);
    return this._usersService.getUserStats(req.user._id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/recent-contributions')
  @ApiOperation({
    summary: "Récupérer les contributions récentes de l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: 'Contributions récentes récupérées avec succès',
    type: [Object],
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiBearerAuth()
  async getUserRecentContributions(
    @Req() req: { user: { _id: string } },
    @Query('limit') limit: string = '5'
  ) {
    const contributions = await this._usersService.getUserRecentContributions(
      req.user._id,
      parseInt(limit)
    );
    
    return {
      contributions,
      count: contributions.length,
      timestamp: new Date().toISOString()
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/recent-consultations')
  @ApiOperation({
    summary: "Récupérer les consultations récentes de l'utilisateur connecté",
  })
  @ApiResponse({
    status: 200,
    description: 'Consultations récentes récupérées avec succès',
    type: [Object],
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiBearerAuth()
  async getUserRecentConsultations(
    @Req() req: { user: { _id: string } },
    @Query('limit') limit: string = '5'
  ) {
    console.log('🎯 API call getUserRecentConsultations pour:', req.user._id, 'limit:', limit);
    
    const consultations = await this._usersService.getUserRecentConsultations(
      req.user._id,
      parseInt(limit)
    );
    
    const response = {
      consultations,
      count: consultations.length,
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 Réponse API consultations:', response);
    
    return response;
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Rechercher des utilisateurs' })
  @ApiResponse({
    status: 200,
    description: 'Utilisateurs trouvés',
    type: [Object],
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiBearerAuth()
  async searchUsers(
    @Query('search') searchQuery: string,
    @Req() req: { user: { _id: string } },
  ): Promise<PublicUserResponse[]> {
    console.log('[UsersController] Requête de recherche reçue');
    console.log('[UsersController] Requête utilisateur:', req.user);
    console.log('[UsersController] Paramètre de recherche:', searchQuery);

    if (!searchQuery || searchQuery.trim().length < 2) {
      console.log('[UsersController] Requête trop courte, retour tableau vide');
      return [];
    }

    console.log('[UsersController] Appel du service de recherche...');
    const users = await this._usersService.searchUsers(
      searchQuery,
      req.user._id,
    );

    console.log(
      '[UsersController] Utilisateurs trouvés par le service:',
      users.length,
    );

    const result = users.map((user) => ({
      id: user._id.toString(),
      username: user.username,
      nativeLanguage: user.nativeLanguage || 'fr',
      learningLanguages: user.learningLanguages || [],
      profilePicture: user.profilePicture,
      bio: user.bio,
      location: user.location,
      website: user.website,
      lastActive: user.lastActive,
    }));

    console.log(
      '[UsersController] Résultat transformé:',
      result.length,
      'utilisateurs',
    );
    return result;
  }

  @Get('analytics/online-contributors')
  @ApiOperation({
    summary: 'Obtenir le nombre de contributeurs en ligne',
  })
  @ApiResponse({
    status: 200,
    description: 'Nombre de contributeurs en ligne récupéré avec succès',
    schema: {
      type: 'object',
      properties: {
        onlineContributors: { type: 'number' },
        activeUsers: { type: 'number' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getOnlineContributorsCount(): Promise<{
    onlineContributors: number;
    activeUsers: number;
    timestamp: string;
  }> {
    const [onlineContributors, activeUsers] = await Promise.all([
      this._usersService.getOnlineContributorsCount(),
      this._usersService.getActiveUsersCount(),
    ]);

    return {
      onlineContributors,
      activeUsers,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('debug/all-users-status')
  @ApiOperation({
    summary: 'Debug - Voir le statut de tous les utilisateurs',
  })
  async debugAllUsersStatus(): Promise<any[]> {
    const users = await this._usersService.findAll();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    return users.map(user => ({
      username: user.username,
      role: user.role,
      totalWordsAdded: user.totalWordsAdded || 0,
      lastActive: user.lastActive,
      isActive: user.isActive,
      isRecentlyActive: user.lastActive && user.lastActive >= fiveMinutesAgo,
      isContributor: (user.totalWordsAdded && user.totalWordsAdded > 0) || 
                     ['contributor', 'admin', 'superadmin'].includes(user.role),
      qualifiesAsOnlineContributor: user.isActive && 
                                    user.lastActive && 
                                    user.lastActive >= fiveMinutesAgo && 
                                    (((user.totalWordsAdded && user.totalWordsAdded > 0) || 
                                     ['contributor', 'admin', 'superadmin'].includes(user.role)))
    }));
  }

  @Get(':username')
  @ApiOperation({
    summary:
      "Récupérer le profil public d'un utilisateur par son nom d'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description: 'Profil public récupéré avec succès',
    type: Object,
  })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  @ApiParam({
    name: 'username',
    description: "Nom d'utilisateur",
    example: 'johndoe',
  })
  async getUserByUsername(
    @Param('username') username: string,
  ): Promise<PublicUserResponse> {
    const user = (await this._usersService.findByUsername(
      username,
    )) as UserDocument;
    if (!user || !user._id) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return {
      id: user._id.toString(),
      username: user.username,
      nativeLanguage: user.nativeLanguage || 'fr',
      learningLanguages: user.learningLanguages || [],
      profilePicture: user.profilePicture,
      bio: user.bio,
      location: user.location,
      website: user.website,
      lastActive: user.lastActive,
    };
  }
}
