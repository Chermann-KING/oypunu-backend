import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { Category } from '../schemas/category.schema';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { ICategoryRepository } from '../../repositories/interfaces/category.repository.interface';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject('ICategoryRepository') private categoryRepository: ICategoryRepository,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    // Vérifier si la catégorie existe déjà dans la même langue
    const existsAlready = await this.categoryRepository.existsByName(createCategoryDto.name);

    if (existsAlready) {
      throw new BadRequestException(
        `La catégorie "${createCategoryDto.name}" existe déjà`,
      );
    }

    // Créer la nouvelle catégorie
    return this.categoryRepository.create(createCategoryDto, 'system');
  }

  async findAll(language?: string): Promise<Category[]> {
    const result = await this.categoryRepository.findAll({
      includeInactive: false,
      sortBy: 'name',
      sortOrder: 'asc',
    });
    
    if (language) {
      // Filtrer par langue si spécifiée
      return result.categories.filter((cat: any) => cat.language === language);
    }
    
    return result.categories;
  }

  async findOne(id: string): Promise<Category> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de catégorie invalide');
    }

    const category = await this.categoryRepository.findById(id);

    if (!category) {
      throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
    }

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de catégorie invalide');
    }

    // Vérifier si la catégorie existe
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
    }

    // Mettre à jour la catégorie
    const updatedCategory = await this.categoryRepository.update(id, updateCategoryDto);

    if (!updatedCategory) {
      throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
    }

    return updatedCategory;
  }

  async remove(id: string): Promise<{ success: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de catégorie invalide');
    }

    // Vérifier si la catégorie existe
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
    }

    // Supprimer la catégorie
    const deleted = await this.categoryRepository.delete(id);

    return { success: deleted };
  }
}
