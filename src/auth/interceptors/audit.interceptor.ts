import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AuditService, AuditContext } from '../services/audit.service';
import { AuditAction, AuditSeverity } from '../schemas/audit-log.schema';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    // Extraire les informations de contexte
    const auditContext: AuditContext = {
      userId: request.user?.id || request.user?._id,
      username: request.user?.username,
      userRole: request.user?.role,
      ipAddress: request.ip || request.socket?.remoteAddress,
      userAgent: request.headers['user-agent'],
      sessionId: request.sessionID || this.generateSessionId(request),
      requestPath: request.path,
      requestMethod: request.method,
    };

    // Déterminer l'action d'audit basée sur la route et la méthode
    const auditAction = this.getAuditAction(request);

    return next.handle().pipe(
      tap((data) => {
        // Log en cas de succès
        if (auditAction && this.shouldAudit(request)) {
          const duration = Date.now() - startTime;

          this.auditService.logEvent(
            auditAction,
            auditContext,
            true,
            this.getSeverity(auditAction, request),
            {
              details: {
                responseData: this.sanitizeResponseData(data),
                requestBody: this.sanitizeRequestData(request.body),
                queryParams: request.query,
                params: request.params,
              },
              metadata: {
                duration,
                statusCode: response.statusCode,
              },
            },
          );
        }
      }),
      catchError((error) => {
        // Log en cas d'erreur
        if (auditAction && this.shouldAudit(request)) {
          const duration = Date.now() - startTime;

          this.auditService.logEvent(
            auditAction,
            auditContext,
            false,
            AuditSeverity.HIGH,
            {
              details: {
                errorType: error.name,
                requestBody: this.sanitizeRequestData(request.body),
                queryParams: request.query,
                params: request.params,
              },
              metadata: {
                duration,
                statusCode: error.status || 500,
              },
            },
            error.message,
          );
        }

        return throwError(() => error);
      }),
    );
  }

  /**
   * Détermine l'action d'audit basée sur la route et la méthode HTTP
   */
  private getAuditAction(request: any): AuditAction | null {
    const path = request.path;
    const method = request.method;

    // Routes d'authentification
    if (path.includes('/auth/login') && method === 'POST') {
      return AuditAction.USER_LOGIN;
    }
    if (path.includes('/auth/logout') && method === 'POST') {
      return AuditAction.USER_LOGOUT;
    }
    if (path.includes('/auth/register') && method === 'POST') {
      return AuditAction.USER_REGISTER;
    }
    if (path.includes('/auth/refresh') && method === 'POST') {
      return AuditAction.TOKEN_REFRESH;
    }
    if (path.includes('/auth/reset-password') && method === 'POST') {
      return AuditAction.PASSWORD_RESET;
    }

    // Routes d'administration
    if (path.includes('/admin/')) {
      return AuditAction.ADMIN_ACCESS;
    }

    // Routes des utilisateurs
    if (path.includes('/users/') && method === 'POST') {
      return AuditAction.USER_CREATE;
    }
    if (path.includes('/users/') && method === 'PATCH') {
      return AuditAction.USER_UPDATE;
    }
    if (path.includes('/users/') && method === 'DELETE') {
      return AuditAction.USER_DELETE;
    }

    // Routes des mots
    if (path.includes('/words') && method === 'POST') {
      return AuditAction.WORD_CREATE;
    }
    if (path.includes('/words') && method === 'PATCH') {
      return AuditAction.WORD_UPDATE;
    }
    if (path.includes('/words') && method === 'DELETE') {
      return AuditAction.WORD_DELETE;
    }

    // Par défaut, ne pas auditer
    return null;
  }

  /**
   * Détermine si la requête doit être auditée
   */
  private shouldAudit(request: any): boolean {
    const path = request.path;

    // Ne pas auditer les routes de santé et de monitoring
    const excludedPaths = ['/health', '/metrics', '/favicon.ico', '/api-docs'];

    return !excludedPaths.some((excluded) => path.includes(excluded));
  }

  /**
   * Détermine la sévérité basée sur l'action et le contexte
   */
  private getSeverity(action: AuditAction, request: any): AuditSeverity {
    // Actions critiques
    const criticalActions = [
      AuditAction.USER_DELETE,
      AuditAction.USER_ROLE_CHANGE,
      AuditAction.SYSTEM_CONFIG_CHANGE,
    ];

    // Actions importantes
    const highActions = [
      AuditAction.ADMIN_ACCESS,
      AuditAction.USER_CREATE,
      AuditAction.USER_UPDATE,
      AuditAction.WORD_DELETE,
    ];

    // Actions moyennes
    const mediumActions = [
      AuditAction.USER_LOGIN,
      AuditAction.USER_LOGOUT,
      AuditAction.PASSWORD_RESET,
      AuditAction.WORD_CREATE,
      AuditAction.WORD_UPDATE,
    ];

    if (criticalActions.includes(action)) {
      return AuditSeverity.CRITICAL;
    }
    if (highActions.includes(action)) {
      return AuditSeverity.HIGH;
    }
    if (mediumActions.includes(action)) {
      return AuditSeverity.MEDIUM;
    }

    return AuditSeverity.LOW;
  }

  /**
   * Nettoie les données de requête pour supprimer les informations sensibles
   */
  private sanitizeRequestData(data: any): any {
    if (!data) return data;

    const sanitized = { ...data };

    // Supprimer les champs sensibles
    const sensitiveFields = [
      'password',
      'currentPassword',
      'newPassword',
      'token',
      'refreshToken',
      'accessToken',
    ];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Nettoie les données de réponse pour supprimer les informations sensibles
   */
  private sanitizeResponseData(data: any): any {
    if (!data) return data;

    // Limiter la taille des données loggées
    const stringData = JSON.stringify(data);
    if (stringData.length > 1000) {
      return '[RESPONSE_TOO_LARGE]';
    }

    const sanitized = { ...data };

    // Supprimer les tokens de la réponse
    if (sanitized.tokens) {
      sanitized.tokens = '[REDACTED]';
    }

    return sanitized;
  }

  /**
   * Génère un identifiant de session unique
   */
  private generateSessionId(request: any): string {
    const userAgent = request.headers['user-agent'] || '';
    const ip = request.ip || '';
    const timestamp = Date.now();

    return Buffer.from(`${ip}-${userAgent}-${timestamp}`)
      .toString('base64')
      .substring(0, 16);
  }
}
