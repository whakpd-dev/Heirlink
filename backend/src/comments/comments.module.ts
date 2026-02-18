import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PostCommentsController, CommentController } from './comments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PostCommentsController, CommentController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
