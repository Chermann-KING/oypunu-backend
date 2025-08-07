/**
 * @fileoverview Point d'entrée principal de l'application O'Ypunu Backend
 * 
 * Ce fichier configure et démarre l'application NestJS avec toutes les
 * configurations de sécurité, CORS, validation, Swagger et WebSockets
 * pour le dictionnaire communautaire multilingue O'Ypunu.
 * 
 * @author Équipe O'Ypunu
 * @version 1.0.0
 * @since 2025-01-01
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SecurityHeadersMiddleware } from './auth/security/security-headers.middleware';

/**
 * Fonction de bootstrap de l'application O'Ypunu Backend
 * 
 * Configure et démarre l'application NestJS avec :
 * - Configuration CORS sécurisée (dev/prod)
 * - Middleware de sécurité personnalisé
 * - Validation globale des données
 * - Documentation Swagger interactive
 * - Support WebSocket pour messagerie temps réel
 * - Logging adapté à l'environnement
 * 
 * @async
 * @function bootstrap
 * @returns {Promise<void>}
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production' 
      ? ['error', 'warn'] 
      : ['log', 'debug', 'error', 'verbose', 'warn'],
  });
  
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';

  // 🛡️ Middleware de sécurité personnalisé
  if (app.get(SecurityHeadersMiddleware, { strict: false })) {
    const securityMiddleware = app.get(SecurityHeadersMiddleware);
    app.use(securityMiddleware.use.bind(securityMiddleware));
  }

  // 🔧 CORS Configuration - Utilise production.config.ts si disponible
  const securityConfig = configService.get('security');
  const corsConfig = securityConfig?.cors;

  if (corsConfig) {
    // Utiliser la configuration CORS de production.config.ts
    console.log('🌐 CORS - Configuration sécurisée de production.config.ts');
    console.log('🌐 CORS - Origines autorisées:', corsConfig.origin);
    
    app.enableCors({
      origin: corsConfig.origin,
      methods: corsConfig.methods,
      allowedHeaders: corsConfig.allowedHeaders,
      credentials: corsConfig.credentials,
      maxAge: corsConfig.maxAge,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });
  } else {
    // Fallback vers configuration manuelle pour développement
    const frontendUrl = configService.get('FRONTEND_URL');
    const isDevelopment = configService.get('NODE_ENV') !== 'production';
    
    console.log('⚠️ CORS - Utilisation de la configuration fallback');
    console.log('⚠️ CORS - Recommandé: utiliser production.config.ts pour la sécurité');

    const allowedOrigins = [
      'http://localhost:4200', // Développement Angular
      'http://localhost:3000', // Développement React/Next
      'http://localhost:5173', // Développement Vite
      'https://localhost:4200', // HTTPS local
      'https://localhost:3000', // HTTPS local
      /http:\/\/localhost:\d+/, // Tous les ports localhost pour le développement
    ];

    // Ajouter l'URL de production si elle existe
    if (frontendUrl && frontendUrl.trim() !== '') {
      allowedOrigins.push(frontendUrl);
    }

    // Ajouter des patterns Vercel courants
    allowedOrigins.push('https://*.vercel.app');

    if (isDevelopment) {
      app.enableCors({
        origin: true, // Autoriser toutes les origines en développement
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'Accept',
          'Origin',
          'X-Requested-With',
          'Access-Control-Request-Method',
          'Access-Control-Request-Headers',
        ],
        credentials: true,
      });
      console.log('🔧 CORS: Mode développement - Toutes les origines autorisées');
    } else {
      app.enableCors({
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'Accept',
          'Origin',
          'X-Requested-With',
          'Access-Control-Request-Method',
          'Access-Control-Request-Headers',
        ],
        credentials: true,
        preflightContinue: false,
        optionsSuccessStatus: 204,
      });
      console.log('🌐 CORS: Production - Origines restreintes:', allowedOrigins);
    }
  }

  // Préfixe global pour l'API
  app.setGlobalPrefix('api');

  // Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Configuration Swagger
  const config = new DocumentBuilder()
    .setTitle("O'Ypunu API")
    .setDescription(
      "API pour la plateforme O'Ypunu - Dictionnaire communautaire",
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addServer(
      configService.get('APP_URL') || 'http://localhost:3000',
      'Production',
    )
    .addServer('http://localhost:3000', 'Development')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // Configuration WebSocket avec CORS
  app.useWebSocketAdapter(new IoAdapter(app));

  const port = configService.get('PORT') || 3000;
  await app.listen(port, '0.0.0.0');

  const appUrl = configService.get('APP_URL') || `http://localhost:${port}`;

  console.log(`\n🚀 =================================`);
  console.log(`🌟 OYpunu Backend - Démarrage réussi !`);
  console.log(`📍 Application: ${appUrl}`);
  console.log(`📚 Documentation: ${appUrl}/api-docs`);
  console.log(`🔌 API Routes: ${appUrl}/api/`);
  console.log(`🌐 Frontend URL: ${frontendUrl || 'Non configurée'}`);
  console.log(`🔐 JWT configuré: ${!!configService.get('JWT_SECRET')}`);
  console.log(`📧 Email configuré: ${!!configService.get('MAIL_USER')}`);
  console.log(`🗄️ Database: ${!!configService.get('MONGODB_URI')}`);
  console.log(`🚀 =================================\n`);
}

bootstrap().catch(console.error);
