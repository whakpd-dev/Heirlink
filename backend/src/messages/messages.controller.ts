import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  getConversations(
    @Request() req: { user: { id: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.messagesService.getConversations(req.user.id, pageNum, limitNum);
  }

  @Get('with/:userId')
  getMessagesWith(
    @Request() req: { user: { id: string } },
    @Param('userId') otherUserId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.messagesService.getMessagesWith(
      req.user.id,
      otherUserId,
      pageNum,
      limitNum,
    );
  }

  @Post()
  send(
    @Request() req: { user: { id: string } },
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.send(
      req.user.id,
      dto.recipientId,
      dto.text.trim(),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMessage(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    await this.messagesService.deleteMessage(id, req.user.id);
  }
}
