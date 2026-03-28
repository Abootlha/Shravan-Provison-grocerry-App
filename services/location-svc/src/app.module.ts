import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LocationModule } from './location.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LocationModule,
  ],
})
export class AppModule {}
