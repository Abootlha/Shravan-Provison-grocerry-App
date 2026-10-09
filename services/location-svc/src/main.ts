import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const grpcPort = configService.get<number>('GRPC_PORT', 3007);
  const httpPort =
    configService.get<number>('HTTP_PORT') ||
    configService.get<number>('PORT') ||
    8009;

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors();

  await app.listen(httpPort);
  console.log(`Location Service HTTP running on port ${httpPort}`);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'location',
      protoPath: './proto/location.proto',
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  await app.startAllMicroservices();
  console.log(`Location Service gRPC running on port ${grpcPort}`);
}

bootstrap();
