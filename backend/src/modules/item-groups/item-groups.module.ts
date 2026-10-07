import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ItemGroupsController } from './item-groups.controller';
import { ItemGroupsService } from './item-groups.service';
import { ItemGroup, ItemGroupSchema } from './schemas/item-group.schema';
import {
  Subcategory,
  SubcategorySchema,
} from '../subcategories/schemas/subcategory.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ItemGroup.name, schema: ItemGroupSchema },
      { name: Subcategory.name, schema: SubcategorySchema },
    ]),
  ],
  controllers: [ItemGroupsController],
  providers: [ItemGroupsService],
  exports: [ItemGroupsService],
})
export class ItemGroupsModule {}
