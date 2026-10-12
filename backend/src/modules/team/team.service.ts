import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  STAFF_ROLES,
  User,
  UserDocument,
  UserRole,
} from '../users/schemas/user.schema';
import { SessionRevokerService } from '../auth/session-revoker.service';
import { CreateTeamMemberDto, UpdateTeamMemberDto } from './dto/team.dto';

const BCRYPT_ROUNDS = 12;
const PUBLIC_FIELDS = 'name username role isActive email createdAt updatedAt';
// The internal account used for automated status changes is not a team member.
const NOT_SYSTEM = { phone: { $ne: 'SYSTEM' } };

@Injectable()
export class TeamService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly sessionRevoker: SessionRevokerService,
  ) {}

  async list() {
    const members = await this.userModel
      .find({ role: { $in: STAFF_ROLES }, ...NOT_SYSTEM })
      .select(PUBLIC_FIELDS)
      .sort({ role: 1, name: 1 })
      .lean()
      .exec();
    return { members };
  }

  async create(dto: CreateTeamMemberDto) {
    const username = dto.username;
    const taken = await this.userModel.exists({ username });
    if (taken) throw new ConflictException('Username is already taken');

    const user = await this.userModel.create({
      name: dto.name.trim(),
      username,
      password: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      role: dto.role,
      isActive: dto.isActive ?? true,
      ...(dto.email ? { email: dto.email.trim() } : {}),
    });
    return this.get(user._id.toString());
  }

  private async get(id: string) {
    const member = await this.userModel
      .findById(id)
      .select(PUBLIC_FIELDS)
      .lean()
      .exec();
    if (!member) throw new NotFoundException('Team member not found');
    return member;
  }

  private async activeAdminCount(excludingId: string): Promise<number> {
    return this.userModel.countDocuments({
      _id: { $ne: new Types.ObjectId(excludingId) },
      role: UserRole.ADMIN,
      isActive: { $ne: false },
      ...NOT_SYSTEM,
    });
  }

  async update(id: string, dto: UpdateTeamMemberDto, actorId: string) {
    const member = await this.userModel
      .findOne({ _id: new Types.ObjectId(id), role: { $in: STAFF_ROLES } })
      .select('role isActive phone')
      .lean()
      .exec();
    if (!member || member.phone === 'SYSTEM') {
      throw new NotFoundException('Team member not found');
    }

    const isSelf = id === actorId;
    const roleChanges = dto.role !== undefined && dto.role !== member.role;
    const deactivates = dto.isActive === false && member.isActive !== false;
    if (isSelf && (roleChanges || deactivates)) {
      throw new BadRequestException(
        'You cannot change your own role or deactivate yourself',
      );
    }
    // Keep at least one active admin, or nobody could manage the team.
    if (member.role === UserRole.ADMIN && (roleChanges || deactivates)) {
      if ((await this.activeAdminCount(id)) === 0) {
        throw new ConflictException('At least one active admin is required');
      }
    }

    const $set: Record<string, any> = {};
    if (dto.name !== undefined) $set.name = dto.name.trim();
    if (dto.email !== undefined) $set.email = dto.email.trim();
    if (dto.role !== undefined) $set.role = dto.role;
    if (dto.isActive !== undefined) $set.isActive = dto.isActive;
    if (dto.password !== undefined) {
      $set.password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }
    if (Object.keys($set).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    await this.userModel.updateOne({ _id: member._id }, { $set }).exec();

    // Sessions are stored per role, so revoke under the role they signed in with.
    if (roleChanges || deactivates || dto.password !== undefined) {
      await this.sessionRevoker.revokeAll(id, member.role);
    }
    return this.get(id);
  }
}
