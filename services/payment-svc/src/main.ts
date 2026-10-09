import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const httpPort = parseInt(process.env.HTTP_PORT || '8089', 10);
  const grpcPort = parseInt(process.env.GRPC_PORT || '3009', 10);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'payment',
      protoPath: join(__dirname, '../proto/payment.proto'),
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  app.enableShutdownHooks();

  await app.startAllMicroservices();
  await app.listen(httpPort);

  logger.log(`Payment service running on HTTP ${httpPort} and gRPC ${grpcPort}`);
}

bootstrap();
