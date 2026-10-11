import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

/** 400 instead of a cast error for route ids that are not ObjectIds. */
@Injectable()
export class MongoIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!Types.ObjectId.isValid(value) || String(value).length !== 24) {
      throw new BadRequestException('Invalid id');
    }
    return value;
  }
}
