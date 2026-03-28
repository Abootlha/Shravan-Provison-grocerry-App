import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'analytics',
      protoPath: './src/proto/analytics.proto',
      url: `0.0.0.0:${process.env.GRPC_PORT || 3011}`,
    },
  });

  app.enableCors();
  await app.startAllMicroservices();
  const httpPort = process.env.HTTP_PORT || process.env.PORT || '8011';
  await app.listen(httpPort);
  console.log(`Analytics Service running on HTTP: ${httpPort}, gRPC: ${process.env.GRPC_PORT || 3011}`);
}
bootstrap();
