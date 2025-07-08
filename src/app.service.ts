import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return "Bienvenu sur le serveur de l'application O'Ypunu!";
  }
}
