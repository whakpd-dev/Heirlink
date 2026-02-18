import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { SearchService } from './search.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('users')
  @UseGuards(OptionalJwtAuthGuard)
  searchUsers(
    @Query('q') q: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: { user?: { id: string } },
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.searchService.searchUsers(
      q ?? '',
      pageNum,
      limitNum,
      req?.user?.id,
    );
  }

  @Get('posts')
  searchPosts(
    @Query('q') q: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.searchService.searchPosts(q ?? '', pageNum, limitNum);
  }
}
