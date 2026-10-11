import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './schemas/user.schema';
import { MongoIdPipe } from '../../common/pipes/mongo-id.pipe';
import { AdminCustomersService } from './admin-customers.service';
import { AdminCustomersQueryDto } from './dto/admin-customers.dto';

/** Read-only customer views for admins and managers. */
@Controller('admin/customers')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class AdminCustomersController {
  constructor(private readonly adminCustomers: AdminCustomersService) {}

  @Get()
  list(@Query() query: AdminCustomersQueryDto) {
    return this.adminCustomers.list(query);
  }

  @Get(':id')
  get(@Param('id', MongoIdPipe) id: string) {
    return this.adminCustomers.get(id);
  }
}
