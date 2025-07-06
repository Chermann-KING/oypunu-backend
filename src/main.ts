import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { IoAdapter } from "@nestjs/platform-socket.io";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 🔧 CORS Configuration
  const frontendUrl = configService.get("FRONTEND_URL");
  const allowedOrigins = [
    "http://localhost:4200", // Développement Angular
    "http://localhost:3000", // Développement React/Next
    "http://localhost:5173", // Développement Vite
    "https://localhost:4200", // HTTPS local
    "https://localhost:3000", // HTTPS local
    /http:\/\/localhost:\d+/, // Tous les ports localhost pour le développement
  ];

  // Ajouter l'URL de production si elle existe
  if (frontendUrl && frontendUrl.trim() !== "") {
    allowedOrigins.push(frontendUrl);
  }

  // Ajouter des patterns Vercel courants
  allowedOrigins.push("https://*.vercel.app");

  console.log("🌐 CORS - Origines autorisées:", allowedOrigins);

  // En développement, autoriser toutes les origines localhost
  const isDevelopment = configService.get("NODE_ENV") !== "production";
  
  if (isDevelopment) {
    app.enableCors({
      origin: true, // Autoriser toutes les origines en développement
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
      ],
      credentials: true,
    });
    console.log("🔧 CORS: Mode développement - Toutes les origines autorisées");
  } else {
    app.enableCors({
      origin: (origin, callback) => {
        // Autoriser les requêtes sans origin (Postman, apps mobiles, etc.)
        if (!origin) return callback(null, true);

        // Vérifier si l'origin est dans la liste autorisée
        const isAllowed = allowedOrigins.some((allowedOrigin) => {
          if (typeof allowedOrigin === 'string') {
            if (allowedOrigin.includes("*")) {
              // Gestion des wildcards pour Vercel
              const pattern = allowedOrigin.replace("*", ".*");
              const regex = new RegExp(`^${pattern}$`);
              return regex.test(origin);
            }
            return allowedOrigin === origin;
          } else if (allowedOrigin instanceof RegExp) {
            // Gestion des expressions régulières
            return allowedOrigin.test(origin);
          }
          return false;
        });

        if (isAllowed) {
          console.log(`✅ CORS: Origin autorisée - ${origin}`);
          callback(null, true);
        } else {
          console.log(`❌ CORS: Origin rejetée - ${origin}`);
          console.log(`📝 CORS: Origins autorisées:`, allowedOrigins);
          callback(new Error(`Origin ${origin} non autorisée par CORS`));
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
      ],
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });
  }

  // Préfixe global pour l'API
  app.setGlobalPrefix("api");

  // Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Configuration Swagger
  const config = new DocumentBuilder()
    .setTitle("O'Ypunu API")
    .setDescription(
      "API pour la plateforme O'Ypunu - Dictionnaire communautaire"
    )
    .setVersion("1.0")
    .addBearerAuth()
    .addServer(
      configService.get("APP_URL") || "http://localhost:3000",
      "Production"
    )
    .addServer("http://localhost:3000", "Development")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api-docs", app, document);

  // Configuration WebSocket avec CORS
  app.useWebSocketAdapter(new IoAdapter(app));

  const port = configService.get("PORT") || 3000;
  await app.listen(port, "0.0.0.0");

  const appUrl = configService.get("APP_URL") || `http://localhost:${port}`;

  console.log(`\n🚀 =================================`);
  console.log(`🌟 OYpunu Backend - Démarrage réussi !`);
  console.log(`📍 Application: ${appUrl}`);
  console.log(`📚 Documentation: ${appUrl}/api-docs`);
  console.log(`🔌 API Routes: ${appUrl}/api/`);
  console.log(`🌐 Frontend URL: ${frontendUrl || "Non configurée"}`);
  console.log(`🔐 JWT configuré: ${!!configService.get("JWT_SECRET")}`);
  console.log(`📧 Email configuré: ${!!configService.get("MAIL_USER")}`);
  console.log(`🗄️ Database: ${!!configService.get("MONGODB_URI")}`);
  console.log(`🚀 =================================\n`);
}

bootstrap().catch(console.error);
