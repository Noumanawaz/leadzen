import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import type { AppEnv } from './config/env.validation';

async function bootstrap() {
  // Prisma BigInt (e.g. plan.maxStorageBytes) must be JSON-safe
  (BigInt.prototype as unknown as { toJSON?: () => string }).toJSON = function toJSON() {
    return this.toString();
  };

  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService<AppEnv, true>);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get('FRONTEND_URL', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Lead Management SaaS API')
    .setDescription('Multi-tenant lead management and platform admin API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
}

void bootstrap();
