import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { MongoIdPipe } from '../../common/pipes/mongo-id.pipe';
import { TeamService } from './team.service';
import { CreateTeamMemberDto, UpdateTeamMemberDto } from './dto/team.dto';

/** Staff accounts (admin | manager). Admin only. */
@Controller('admin/team')
@UseGuards(JwtAuthGuard, AdminGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  list() {
    return this.teamService.list();
  }

  @Post()
  async create(@Body() body: CreateTeamMemberDto) {
    return { member: await this.teamService.create(body) };
  }

  @Patch(':id')
  async update(
    @Request() req: any,
    @Param('id', MongoIdPipe) id: string,
    @Body() body: UpdateTeamMemberDto,
  ) {
    return {
      member: await this.teamService.update(id, body, req.user.userId),
    };
  }
}
