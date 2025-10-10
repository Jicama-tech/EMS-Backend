import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module";
import * as path from "path";
import * as express from "express";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  async function getAllowedDomains(): Promise<string[]> {
    return ["https://eventsh.com", "https://thefoxsg.com"]; // sample static list, replace with DB call
  }

  app.enableCors({
    origin: async (origin, callback) => {
      if (!origin) {
        // allow server-to-server or curl/fetch w/o origin
        return callback(null, true);
      }

      const allowedDomains = await getAllowedDomains();
      if (allowedDomains.includes(origin)) {
        callback(null, true);
      } else {
        callback(
          new Error(`CORS policy: The origin '${origin}' is not allowed.`)
        );
      }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  });

  // rest of your setup code
  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Server running at http://localhost:${port}`);
}

bootstrap();
