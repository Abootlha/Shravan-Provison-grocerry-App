import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const grpcPort = configService.get<number>('GRPC_PORT', 3010);
  const httpPort =
    configService.get<number>('HTTP_PORT') ||
    configService.get<number>('PORT') ||
    8008;
  const rabbitmqUrl = configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'notification',
      protoPath: './src/proto/notification.proto',
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'notification.push',
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'notification.sms',
      queueOptions: { durable: true },
      noAck: false,
    },
  });

  await app.startAllMicroservices();
  await app.listen(httpPort);
  console.log(`Notification Service - HTTP on port ${httpPort}, gRPC on port ${grpcPort}`);
}

bootstrap();
