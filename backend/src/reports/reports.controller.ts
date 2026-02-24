import { Controller, Post, Body, Get, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateReportDto, @Request() req: { user: { id: string } }) {
    return this.reportsService.create(req.user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.reportsService.findAll(status, page ? +page : 1, limit ? +limit : 20);
  }
}
