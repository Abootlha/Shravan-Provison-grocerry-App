import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('UserService');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.enableCors();

  const grpcPort = process.env.GRPC_PORT || '3002';
  const httpPort = process.env.HTTP_PORT || process.env.PORT || '8002';

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'user',
      protoPath: './src/proto/user.proto',
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  await app.startAllMicroservices();
  await app.listen(httpPort);
  
  logger.log(`User Service HTTP running on port ${httpPort}`);
  logger.log(`User Service gRPC running on port ${grpcPort}`);
}

bootstrap();
