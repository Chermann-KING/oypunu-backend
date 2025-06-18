import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Request, Response, NextFunction } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.useGlobalPipes(new ValidationPipe());

  // AJOUT DU PRÉFIXE GLOBAL 'api'
  app.setGlobalPrefix("api");

  const config = new DocumentBuilder()
    .setTitle("O'Ypunu API")
    .setDescription(
      "API pour le dictionnaire multilingue de la communauté O'Ypunu"
    )
    .setVersion("1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Documentation disponible sur /api-docs car /api est déjà pris par les routes API
  SwaggerModule.setup("api-docs", app, document);

  // Redirection de la racine vers la documentation
  app.use("/", (req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl === "/") {
      return res.redirect("/api-docs");
    }
    next();
  });

  // Configuration CORS
  app.enableCors({
    origin: ["http://localhost:4200", "https://oypunu.com"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, "0.0.0.0");
  console.log(`L'application fonctionne sur: ${await app.getUrl()}`);
  console.log(
    `Documentation API disponible sur: http://localhost:${port}/api-docs`
  );
  console.log(`Routes API disponibles sur: http://localhost:${port}/api/`);
}
bootstrap().catch((error) => {
  console.error("Erreur lors du démarrage de l'application:", error);
});
