import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PostsModule } from './posts/posts.module';
import { UsersModule } from './users/users.module';
import { CommentsModule } from './comments/comments.module';
import { UploadModule } from './upload/upload.module';
import { StoriesModule } from './stories/stories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { SmartAlbumModule } from './smart-album/smart-album.module';
import { MessagesModule } from './messages/messages.module';
import { AiModule } from './ai/ai.module';
import { CacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    PostsModule,
    UsersModule,
    CommentsModule,
    UploadModule,
    StoriesModule,
    NotificationsModule,
    SearchModule,
    SmartAlbumModule,
    MessagesModule,
    AiModule,
    CacheModule,
    QueueModule,
    GatewayModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
