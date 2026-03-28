import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { useContainer } from 'class-validator';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Get config service
  const configService = app.get(ConfigService);

  // Use Pino logger
  app.useLogger(app.get(Logger));

  // Increase payload size limit for image uploads (10MB)
  app.use(require('body-parser').json({ limit: '10mb' }));
  app.use(require('body-parser').urlencoded({ limit: '10mb', extended: true }));

  // Security middleware
  app.use(helmet());

  // Cookie parser for reading cookies
  app.use(cookieParser());

  // CORS - Allow admin panel, mobile app, and Expo
  app.enableCors({
    origin: true, // Allow all origins for development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Enable DI for class-validator (needed for custom validators)
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  const port = configService.get<number>('port') || 3000;
  // Listen on 0.0.0.0 to accept connections from all network interfaces (needed for mobile testing)
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 ShravanKirana Backend running on: http://0.0.0.0:${port}/api/v1`);
}
bootstrap();
