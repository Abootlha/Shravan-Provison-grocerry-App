import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category } from '../../categories/schemas/category.schema';
import { Subcategory } from '../../subcategories/schemas/subcategory.schema';
import { ItemGroup } from '../../item-groups/schemas/item-group.schema';

@ValidatorConstraint({ name: 'ValidateHierarchy', async: true })
@Injectable()
export class HierarchyValidator implements ValidatorConstraintInterface {
    constructor(
        @InjectModel(Category.name) private categoryModel: Model<Category>,
        @InjectModel(Subcategory.name) private subcategoryModel: Model<Subcategory>,
        @InjectModel(ItemGroup.name) private itemGroupModel: Model<ItemGroup>,
    ) { }

    async validate(value: any, args: ValidationArguments): Promise<boolean> {
        const object = args.object as any;
        const { categoryId, subcategoryId, itemGroupId } = object;

        console.log('🔍 Hierarchy Validation Started:', { categoryId, subcategoryId, itemGroupId });

        // If subcategoryId or itemGroupId is not provided, we consider it valid because they are optional now.
        if (!subcategoryId || !itemGroupId) {
            return true;
        }

        // Category is still required to validate the hierarchy if subcategory is present
        if (!categoryId) {
            console.error('❌ Missing required categoryId field for hierarchy validation:', { categoryId, subcategoryId, itemGroupId });
            return false;
        }

        try {
            // 1. Verify subcategory exists and belongs to category
            const subcategory = await this.subcategoryModel.findById(subcategoryId).exec();
            if (!subcategory) {
                console.error('❌ Subcategory not found:', subcategoryId);
                return false;
            }
            console.log('✅ Subcategory found:', { id: subcategory._id, name: subcategory.name, parentId: subcategory.parentId });

            // Check if subcategory's parentId matches the categoryId
            const subcategoryParentId = subcategory.parentId?.toString();
            const expectedCategoryId = categoryId.toString();
            
            if (!subcategory.parentId || subcategoryParentId !== expectedCategoryId) {
                console.error('❌ Subcategory parentId mismatch:', {
                    subcategoryParentId,
                    expectedCategoryId,
                    match: subcategoryParentId === expectedCategoryId
                });
                return false;
            }
            console.log('✅ Subcategory belongs to category');

            // 2. Verify item group exists and belongs to subcategory
            const itemGroup = await this.itemGroupModel.findById(itemGroupId).exec();
            if (!itemGroup) {
                console.error('❌ Item group not found:', itemGroupId);
                return false;
            }
            console.log('✅ Item group found:', { id: itemGroup._id, name: itemGroup.name, subcategoryId: itemGroup.subcategoryId });

            // Check if item group's subcategoryId matches the subcategoryId
            const itemGroupSubcategoryId = itemGroup.subcategoryId?.toString();
            const expectedSubcategoryId = subcategoryId.toString();
            
            if (!itemGroup.subcategoryId || itemGroupSubcategoryId !== expectedSubcategoryId) {
                console.error('❌ Item group subcategoryId mismatch:', {
                    itemGroupSubcategoryId,
                    expectedSubcategoryId,
                    match: itemGroupSubcategoryId === expectedSubcategoryId
                });
                return false;
            }
            console.log('✅ Item group belongs to subcategory');

            console.log('✅ Hierarchy validation passed!');
            return true;
        } catch (error) {
            console.error('❌ Hierarchy validation error:', error);
            return false;
        }
    }

    defaultMessage(args: ValidationArguments): string {
        return 'Invalid category hierarchy. Please ensure subcategory belongs to the selected category and item group belongs to the selected subcategory.';
    }
}

export function ValidateHierarchy(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: HierarchyValidator,
        });
    };
}
