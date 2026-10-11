import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Origins allowed in development only (admin dev server, Expo web, LAN testing).
const DEV_ORIGIN_PATTERN =
  /^(https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?|exp:\/\/.+)$/;

function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const hops = Number(value);
  return Number.isInteger(hops) ? hops : value;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Get config service
  const configService = app.get(ConfigService);
  const isProduction = process.env.NODE_ENV === 'production';

  // Use Pino logger
  app.useLogger(app.get(Logger));

  // Behind a reverse proxy / load balancer: derive req.ip from X-Forwarded-For
  // so rate limiting is applied per real client instead of per proxy.
  app.set(
    'trust proxy',
    parseTrustProxy(configService.get<string>('http.trustProxy') || '1'),
  );

  // Body size limits. Admin catalogue routes accept base64 images (each capped
  // at ~1.5MB by the DTOs), everything else is small JSON.
  app.use(
    [
      '/api/v1/products',
      '/api/v1/categories',
      '/api/v1/subcategories',
      '/api/v1/item-groups',
    ],
    bodyParser.json({ limit: '8mb' }),
  );
  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));

  // Security middleware
  app.use(helmet());

  // Cookie parser for reading cookies
  app.use(cookieParser());

  // CORS: explicit allowlist (CORS_ORIGINS). Native mobile requests send no
  // Origin header and are allowed. In development, localhost/LAN/Expo origins
  // are allowed too.
  const allowedOrigins = new Set(
    configService.get<string[]>('cors.origins') || [],
  );
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      if (!isProduction && DEV_ORIGIN_PATTERN.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
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

  console.log(
    `🚀 ShravanKirana Backend running on: http://0.0.0.0:${port}/api/v1`,
  );
}
bootstrap();
