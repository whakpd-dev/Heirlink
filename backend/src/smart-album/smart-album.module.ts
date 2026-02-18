import { Module } from '@nestjs/common';
import { SmartAlbumService } from './smart-album.service';
import { SmartAlbumController } from './smart-album.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [SmartAlbumController],
  providers: [SmartAlbumService],
})
export class SmartAlbumModule {}
