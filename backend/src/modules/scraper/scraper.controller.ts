import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { MongoIdPipe } from '../../common/pipes/mongo-id.pipe';
import { ScraperService } from './scraper.service';
import {
  ApproveScrapedProductDto,
  BulkScrapeIdsDto,
  DeclineScrapedProductDto,
  ImportCsvDto,
  ScrapeListQueryDto,
  SubmitScrapeDto,
  UpdateScrapedProductDto,
} from './dto/scraper.dto';

/**
 * Product scraper: staff paste product links, the queue scrapes them into
 * previews (images in R2), and an admin approves each one into the catalogue
 * or declines it. Managers can look; catalogue writes are admin-only.
 */
@Controller('admin/scraper')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class ScraperController {
  constructor(private readonly scraper: ScraperService) {}

  @Get('status')
  status() {
    return this.scraper.status();
  }

  @Get('counts')
  counts() {
    return this.scraper.counts();
  }

  @Get('items')
  list(@Query() query: ScrapeListQueryDto) {
    return this.scraper.list(query);
  }

  @Post('items')
  @Roles(UserRole.ADMIN)
  submit(@Request() req: any, @Body() body: SubmitScrapeDto) {
    return this.scraper.submit(body, req.user?.userId);
  }

  @Post('import-csv')
  @Roles(UserRole.ADMIN)
  importCsv(@Request() req: any, @Body() body: ImportCsvDto) {
    return this.scraper.importCsv(body, req.user?.userId);
  }

  @Post('items/bulk-approve')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  bulkApprove(@Request() req: any, @Body() body: BulkScrapeIdsDto) {
    return this.scraper.bulkApprove(body.ids, body.publishAs, req.user?.userId);
  }

  @Post('items/bulk-decline')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  bulkDecline(@Request() req: any, @Body() body: BulkScrapeIdsDto) {
    return this.scraper.bulkDecline(body.ids, body.reason, req.user?.userId);
  }

  @Get('items/:id')
  get(@Param('id', MongoIdPipe) id: string) {
    return this.scraper.get(id);
  }

  @Patch('items/:id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', MongoIdPipe) id: string,
    @Body() body: UpdateScrapedProductDto,
  ) {
    return this.scraper.update(id, body);
  }

  @Post('items/:id/approve')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  approve(
    @Request() req: any,
    @Param('id', MongoIdPipe) id: string,
    @Body() body: ApproveScrapedProductDto,
  ) {
    return this.scraper.approve(id, body, req.user?.userId);
  }

  @Post('items/:id/decline')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  decline(
    @Request() req: any,
    @Param('id', MongoIdPipe) id: string,
    @Body() body: DeclineScrapedProductDto,
  ) {
    return this.scraper.decline(id, body.reason, req.user?.userId);
  }

  @Post('items/:id/retry')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  retry(@Param('id', MongoIdPipe) id: string) {
    return this.scraper.retry(id);
  }
}
