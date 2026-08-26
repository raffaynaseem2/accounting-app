import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { JsonExceptionFilter } from './common/json-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalFilters(new JsonExceptionFilter());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const startedAt = performance.now();

    response.once('finish', () => {
      const durationMs = Math.round(performance.now() - startedAt);
      console.log(`[HTTP] ${request.method} ${request.originalUrl} ${response.statusCode} ${durationMs}ms`);
    });

    next();
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
