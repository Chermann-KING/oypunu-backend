import { Injectable, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  // Override pour rendre l'authentification optionnelle
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Si une erreur ou pas d'utilisateur, on continue sans authentification
    // (contrairement au JwtAuthGuard qui lance une exception)
    if (err || !user) {
      return null;
    }
    return user;
  }

  // Override pour ne pas lancer d'exception si pas d'authentification
  canActivate(context: ExecutionContext) {
    try {
      return super.canActivate(context);
    } catch (error) {
      // En cas d'erreur d'authentification, on continue sans utilisateur
      return true;
    }
  }
}