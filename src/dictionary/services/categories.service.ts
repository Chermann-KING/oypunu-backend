import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    // Vérifier si la catégorie existe déjà dans la même langue
    const existingCategory = await this.categoryModel.findOne({
      name: createCategoryDto.name,
      language: createCategoryDto.language,
    });

    if (existingCategory) {
      throw new BadRequestException(
        `La catégorie "${createCategoryDto.name}" existe déjà dans la langue ${createCategoryDto.language}`,
      );
    }

    // Créer la nouvelle catégorie
    const createdCategory = new this.categoryModel(createCategoryDto);
    return createdCategory.save();
  }

  async findAll(language?: string): Promise<Category[]> {
    if (language) {
      return this.categoryModel.find({ language }).exec();
    }
    return this.categoryModel.find().exec();
  }

  async findOne(id: string): Promise<Category> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de catégorie invalide');
    }

    const category = await this.categoryModel.findById(id);

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
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
    }

    // Mettre à jour la catégorie
    const updatedCategory = await this.categoryModel
      .findByIdAndUpdate(id, updateCategoryDto, { new: true })
      .exec();

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
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new NotFoundException(`Catégorie avec l'ID ${id} non trouvée`);
    }

    // Supprimer la catégorie
    await this.categoryModel.findByIdAndDelete(id);

    return { success: true };
  }
}
