import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Request,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CommunitiesService } from '../services/communities.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CreateCommunityDto } from '../dto/create-community.dto';
import { CommunityFiltersDto } from '../dto/community-filters.dto';

// Interface pour représenter la structure de l'utilisateur comme elle vient du JWT
interface JwtUser {
  userId?: string;
  _id?: string;
  username: string;
  email: string;
  role: string;
}

@ApiTags('communities')
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly _communitiesService: CommunitiesService) {}

  // Fonction utilitaire pour extraire l'ID de l'utilisateur de manière sécurisée
  private _getUserId(user: JwtUser): string {
    const userId = user.userId || user._id;
    console.log("Extraction de l'ID utilisateur:", userId, 'depuis:', user);
    // Vérification si l'ID de l'utilisateur est défini
    // et s'il est de type string
    if (!userId) {
      throw new Error('User ID is required for this operation');
    }
    // Si userId est un objet convertir en string
    return typeof userId === 'object'
      ? (userId as { toString: () => string }).toString()
      : String(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle communauté' })
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createCommunityDto: CreateCommunityDto,
    @Request() req: { user: JwtUser },
  ) {
    return this._communitiesService.create(createCommunityDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer les communautés' })
  findAll(@Query() filters: CommunityFiltersDto) {
    return this._communitiesService.findAll(filters);
  }

  @Get('search/tags')
  @ApiOperation({ summary: 'Rechercher des communautés par tags' })
  searchByTags(
    @Query('tags') tags: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this._communitiesService.searchByTags(tags.split(','), page, limit);
  }

  @Get('me/communities')
  @ApiOperation({ summary: "Récupérer les communautés de l'utilisateur" })
  @UseGuards(JwtAuthGuard)
  getUserCommunities(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Request() req: { user: JwtUser },
  ) {
    const userId = this._getUserId(req.user);
    return this._communitiesService.getUserCommunities(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une communauté par son ID' })
  async findOne(@Param('id') id: string) {
    try {
      const community = (await this._communitiesService.findOne(id)) as Record<
        string,
        any
      > | null;
      if (!community || typeof community !== 'object') {
        throw new Error('Community not found or invalid type');
      }
      return community;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to retrieve community: ${errorMessage}`);
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour une communauté' })
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateCommunityDto>,
    @Request() req: { user: JwtUser },
  ) {
    const userId = this._getUserId(req.user);
    return this._communitiesService.update(id, updateData as any, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une communauté' })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  delete(@Param('id') id: string, @Request() req: { user: JwtUser }) {
    const userId = this._getUserId(req.user);
    return this._communitiesService.delete(id, userId);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Rejoindre une communauté' })
  @UseGuards(JwtAuthGuard)
  joinCommunity(@Param('id') id: string, @Request() req: { user: JwtUser }) {
    const userId = this._getUserId(req.user);
    return this._communitiesService.joinCommunity(id, userId);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Quitter une communauté' })
  @UseGuards(JwtAuthGuard)
  leaveCommunity(@Param('id') id: string, @Request() req: { user: JwtUser }) {
    const userId = this._getUserId(req.user);
    return this._communitiesService.leaveCommunity(id, userId);
  }

  @Get(':id/members')
  @ApiOperation({ summary: "Récupérer les membres d'une communauté" })
  getMembers(
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this._communitiesService.getCommunityMembers(id, page, limit);
  }

  @Patch(':id/members/:userId/role')
  @ApiOperation({ summary: "Changer le rôle d'un membre" })
  @UseGuards(JwtAuthGuard)
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body('role') role: 'admin' | 'moderator' | 'member',
    @Request() req: { user: JwtUser },
  ) {
    const adminId = this._getUserId(req.user);
    return this._communitiesService.updateMemberRole(id, userId, role, adminId);
  }

  @Get(':id/is-member')
  @ApiOperation({ summary: "Vérifier si l'utilisateur est membre" })
  @UseGuards(JwtAuthGuard)
  isMember(@Param('id') id: string, @Request() req: { user: JwtUser }) {
    const userId = this._getUserId(req.user);
    return this._communitiesService.isMember(id, userId);
  }

  @Get(':id/role')
  @ApiOperation({
    summary: "Récupérer le rôle de l'utilisateur dans la communauté",
  })
  @UseGuards(JwtAuthGuard)
  getMemberRole(@Param('id') id: string, @Request() req: { user: JwtUser }) {
    const userId = this._getUserId(req.user);
    console.log(
      `Controller - récupération du rôle pour communauté ${id}, utilisateur ${userId}`,
      req.user,
    );
    return this._communitiesService.getMemberRole(id, userId);
  }

  @Get(':id/all-members-debug')
  async getAllMembersDebug(@Param('id') id: string) {
    return this._communitiesService.getAllMembersWithRoles(id);
  }
}
