import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Request, Response, NextFunction } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.useGlobalPipes(new ValidationPipe());

  const config = new DocumentBuilder()
    .setTitle("O'Ypunu API")
    .setDescription(
      "API pour le dictionnaire multilingue de la communauté O'Ypunu"
    )
    .setVersion("1.0")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  // Redirection vers /api
  app.use("/", (req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl === "/") {
      return res.redirect("/api");
    }
    next();
  });

  // Active CORS pour le développement
  // app.enableCors();
  app.enableCors({
    origin: ["http://localhost:4200", "https://oypunu.com"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, "0.0.0.0");
  console.log(`L'application fonctionne sur: ${await app.getUrl()}`);
  console.log(
    `Documentation API disponible sur: http://localhost:${port}/api/docs`
  );
}
bootstrap().catch((error) => {
  console.error("Erreur lors du démarrage de l'application:", error);
});
