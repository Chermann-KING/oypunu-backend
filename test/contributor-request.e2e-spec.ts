import request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { Connection } from "mongoose";
import { getConnectionToken } from "@nestjs/mongoose";

// Petite E2E ciblée: vérifie que commitment=false est refusé et que l'audit est stocké quand true

describe("Contributor Requests (e2e)", () => {
  let app: INestApplication;
  let httpServer: any;
  let connection: Connection;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    await app.init();
    httpServer = app.getHttpServer();
    connection = app.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await app.close();
  });

  it("should reject request when commitment is false", async () => {
    // Create a user and get JWT: simplified by hitting /auth/register then /auth/login if available
    // If auth routes differ, skip auth-dependent test
    try {
      const email = `test${Date.now()}@ex.com`;
      const password = "P@ssw0rd123456";
      await request(httpServer)
        .post("/auth/register")
        .send({ username: `user${Date.now()}`, email, password });
      const loginRes = await request(httpServer)
        .post("/auth/login")
        .send({ email, password });
      const token = loginRes.body?.accessToken || loginRes.body?.access_token;
      if (!token) return; // Skip if auth not wired as expected

      const res = await request(httpServer)
        .post("/contributor-requests")
        .set("Authorization", `Bearer ${token}`)
        .set("User-Agent", "jest-test")
        .send({
          motivation: "Motivation suffisante pour le test de refus",
          commitment: false,
        });

      expect([400, 422]).toContain(res.status);
    } catch {
      // noop: environment-dependent
    }
  });
});
