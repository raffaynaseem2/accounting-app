import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JsonExceptionFilter } from './common/json-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalFilters(new JsonExceptionFilter());
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
