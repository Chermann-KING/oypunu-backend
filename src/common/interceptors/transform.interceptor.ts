import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  statusCode: number;
  message: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response: import('express').Response = ctx.getResponse();

    return next.handle().pipe(
      map((data: T) => ({
        data,
        meta:
          typeof data === 'object' && data !== null && 'meta' in data
            ? (data as { meta?: object }).meta
            : undefined, // Accéder en toute sécurité à `meta` s'il existe
        statusCode: response.statusCode,
        message: 'success',
      })),
    );
  }
}
