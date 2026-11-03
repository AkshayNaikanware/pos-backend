import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = Number(app.get(ConfigService).get<string>('APP_PORT') ?? 3000);
  await app.listen(port);
  console.log(`POS backend running on http://localhost:${port}/api`);
}
bootstrap();
