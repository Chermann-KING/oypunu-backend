import { Controller, Get } from '@nestjs/common';
import { HomeService, FeaturedWord } from './home.service';

@Controller('home')
export class HomeController {
  constructor(private readonly _homeService: HomeService) {}

  @Get('featured-words')
  async getFeaturedWords(): Promise<FeaturedWord[]> {
    return this._homeService.getFeaturedWords();
  }

  @Get('statistics')
  async getStatistics() {
    return this._homeService.getStatistics();
  }
}
