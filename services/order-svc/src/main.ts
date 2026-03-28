import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    const httpPort = configService.get<number>('HTTP_PORT', 8084);

    app.enableCors();

    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    console.log('Attempting to listen on port...');
    const server = await app.listen(httpPort);
    console.log(`Order Service HTTP running on port ${httpPort}`);
    return server;
  } catch (error) {
    console.error('Failed to start Order Service:', error);
    process.exit(1);
  }
}

bootstrap();
