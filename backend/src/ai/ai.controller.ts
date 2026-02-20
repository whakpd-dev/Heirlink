import { Controller, Post, Body, Get, Param, UseGuards, Res, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AiService } from './ai.service';
import { ChatCompletionDto } from './dto/chat-completion.dto';
import { GenerateImageDto } from './dto/generate-image.dto';
import { GenerateVideoDto } from './dto/generate-video.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ai')
@Throttle({ short: { ttl: 60000, limit: 10 } })
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async chat(
    @Body() dto: ChatCompletionDto,
    @Res() res: Response,
  ) {
    const messages = dto.messages as any[];

    if (dto.stream) {
      await this.aiService.chatCompletionStream(messages, res, {
        model: dto.model,
        temperature: dto.temperature,
      });
      return;
    }

    const result = await this.aiService.chatCompletion(messages, {
      model: dto.model,
      temperature: dto.temperature,
    });
    res.json(result);
  }

  /* ─── Image Generation ─── */

  @Post('generate-image')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async generateImage(@Body() dto: GenerateImageDto) {
    if (dto.image_url) {
      // Edit / style transfer
      const images = await this.aiService.editImage(dto.prompt, dto.image_url, {
        model: dto.model,
        n: dto.n,
        aspect_ratio: dto.aspect_ratio,
      });
      return { images };
    }
    // Text-to-image
    const images = await this.aiService.generateImage(dto.prompt, {
      model: dto.model,
      n: dto.n,
      aspect_ratio: dto.aspect_ratio,
      response_format: dto.response_format,
    });
    return { images };
  }

  /* ─── Video Generation ─── */

  @Post('generate-video')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async generateVideo(@Body() dto: GenerateVideoDto) {
    const result = await this.aiService.generateVideo(dto.prompt, {
      model: dto.model,
      image_url: dto.image_url,
      video_url: dto.video_url,
      duration: dto.duration,
      aspect_ratio: dto.aspect_ratio,
      resolution: dto.resolution,
    });
    return result; // { request_id }
  }

  @Get('video/:requestId')
  @UseGuards(JwtAuthGuard)
  async getVideoResult(@Param('requestId') requestId: string) {
    return this.aiService.getVideoResult(requestId);
  }
}
