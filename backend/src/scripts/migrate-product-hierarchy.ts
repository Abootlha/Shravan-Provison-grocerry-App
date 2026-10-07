import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Product } from '../modules/products/schemas/product.schema';
import { Category } from '../modules/categories/schemas/category.schema';
import { ItemGroup } from '../modules/item-groups/schemas/item-group.schema';

async function migrateProductHierarchy() {
  console.log('🚀 Starting product hierarchy migration...\n');

  const app = await NestFactory.createApplicationContext(AppModule);

  const productModel = app.get<Model<Product>>(getModelToken(Product.name));
  const categoryModel = app.get<Model<Category>>(getModelToken(Category.name));
  const itemGroupModel = app.get<Model<ItemGroup>>(
    getModelToken(ItemGroup.name),
  );

  try {
    // Find products without complete hierarchy
    const productsToMigrate = await productModel
      .find({
        $or: [
          { subcategoryId: { $exists: false } },
          { subcategoryId: null },
          { itemGroupId: { $exists: false } },
          { itemGroupId: null },
        ],
      })
      .exec();

    console.log(`📊 Found ${productsToMigrate.length} products to migrate\n`);

    if (productsToMigrate.length === 0) {
      console.log('✅ All products already have complete hierarchy!');
      await app.close();
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const product of productsToMigrate) {
      try {
        console.log(`Processing: ${product.name} (${product._id})`);

        // Get the category
        const category = await categoryModel
          .findById(product.categoryId)
          .exec();
        if (!category) {
          console.log(`  ⚠️  Category not found, skipping...`);
          errorCount++;
          continue;
        }

        // Find or create default "Other" subcategory for this category
        let subcategory = await categoryModel
          .findOne({
            type: 'subcategory',
            parentId: category._id,
            name: 'Other',
          })
          .exec();

        if (!subcategory) {
          console.log(`  📁 Creating "Other" subcategory for ${category.name}`);
          subcategory = await categoryModel.create({
            name: 'Other',
            type: 'subcategory',
            parentId: category._id,
            icon: 'noto:package',
            color: '#666666',
            isActive: true,
          });
        }

        // Find or create default "General" item group for this subcategory
        let itemGroup = await itemGroupModel
          .findOne({
            subcategoryId: subcategory._id,
            name: 'General',
          })
          .exec();

        if (!itemGroup) {
          console.log(
            `  📦 Creating "General" item group for ${subcategory.name}`,
          );
          itemGroup = await itemGroupModel.create({
            name: 'General',
            subcategoryId: subcategory._id,
            description: 'Default item group for uncategorized products',
            isActive: true,
          });
        }

        // Update the product
        await productModel.updateOne(
          { _id: product._id },
          {
            $set: {
              subcategoryId: subcategory._id,
              itemGroupId: itemGroup._id,
            },
          },
        );

        console.log(
          `  ✅ Migrated: ${category.name} → ${subcategory.name} → ${itemGroup.name}\n`,
        );
        migratedCount++;
      } catch (error) {
        console.error(
          `  ❌ Error migrating product ${product.name}:`,
          (error as Error).message,
        );
        errorCount++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`  ✅ Successfully migrated: ${migratedCount} products`);
    console.log(`  ❌ Errors: ${errorCount} products`);
    console.log(`  📊 Total processed: ${productsToMigrate.length} products\n`);

    // Verify migration
    const remainingProducts = await productModel.countDocuments({
      $or: [
        { subcategoryId: { $exists: false } },
        { subcategoryId: null },
        { itemGroupId: { $exists: false } },
        { itemGroupId: null },
      ],
    });

    if (remainingProducts === 0) {
      console.log(
        '✅ Migration completed successfully! All products now have complete hierarchy.',
      );
    } else {
      console.log(
        `⚠️  Warning: ${remainingProducts} products still need migration.`,
      );
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await app.close();
  }
}

// Run the migration
migrateProductHierarchy()
  .then(() => {
    console.log('\n🎉 Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });
