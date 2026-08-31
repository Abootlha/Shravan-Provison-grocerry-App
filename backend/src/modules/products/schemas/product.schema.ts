import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

// Enums for structured data
export enum FatProfile {
    NA = 'NA',
    TONED = 'Toned',
    DOUBLE_TONED = 'Double Toned',
    FULL_CREAM = 'Full Cream',
    SKIMMED = 'Skimmed',
}

export enum StorageType {
    AMBIENT = 'Ambient',
    REFRIGERATED = 'Refrigerated',
    FROZEN = 'Frozen',
}

export enum DietaryType {
    VEG = 'Veg',
    NON_VEG = 'Non-Veg',
    VEGAN = 'Vegan',
    GLUTEN_FREE = 'Gluten Free',
    ORGANIC = 'Organic',
}

export enum DisclaimerTemplate {
    DEFAULT = 'DEFAULT',
    PERISHABLE = 'PERISHABLE',
    ALLERGEN = 'ALLERGEN',
    MEDICAL = 'MEDICAL',
}

export enum ReturnPolicyTemplate {
    PERISHABLE_24H = 'PERISHABLE_24H',
    STANDARD_7D = 'STANDARD_7D',
    NO_RETURN = 'NO_RETURN',
}

// Sub-schemas
class Pricing {
    @Prop({ required: true })
    mrp!: number;

    @Prop({ required: true })
    sellingPrice!: number;

    @Prop({ default: 0 })
    gst!: number;
}

class PackInfo {
    @Prop({ required: true })
    unit!: string; // "250ml", "500g", "1L"

    @Prop()
    weight?: number; // In grams for logistics
}

class Attributes {
    @Prop({ type: String, enum: FatProfile, default: FatProfile.NA })
    fatProfile!: FatProfile;

    @Prop({ type: String, enum: StorageType, default: StorageType.AMBIENT })
    storage!: StorageType;

    @Prop({ type: [String], enum: DietaryType, default: [] })
    dietary!: DietaryType[];
}

class Nutrition {
    @Prop({ default: 0 })
    protein!: number;

    @Prop({ default: 0 })
    carbs!: number;

    @Prop({ default: 0 })
    sugar!: number;

    @Prop({ default: 0 })
    fat!: number;

    @Prop({ default: 0 })
    transFat!: number;

    @Prop({ default: '100g' })
    servingSize!: string;
}

class Templates {
    @Prop({ type: String, enum: DisclaimerTemplate, default: DisclaimerTemplate.DEFAULT })
    disclaimerId!: DisclaimerTemplate;

    @Prop({ type: String, enum: ReturnPolicyTemplate, default: ReturnPolicyTemplate.STANDARD_7D })
    returnPolicyId!: ReturnPolicyTemplate;
}

// SKU Variant sub-schema (for Blinkit-style product variants)
@Schema()
export class ProductVariant {
    @Prop({ required: true })
    sku!: string;

    @Prop({ required: true })
    unit!: string; // "250ml", "500ml", "1L"

    @Prop({ required: true })
    mrp!: number;

    @Prop({ required: true })
    sellingPrice!: number;

    @Prop({ default: 0 })
    stock!: number;

    @Prop()
    barcode?: string;

    @Prop({ default: false })
    isDefault!: boolean;

    @Prop({ default: true })
    isActive!: boolean;
}

@Schema({ timestamps: true })
export class Product {
    // Identity
    @Prop({ required: true, text: true })
    name!: string;

    @Prop() // Hindi name field
    nameHi?: string;

    @Prop({ index: true })
    brand?: string;

    @Prop() // Hindi brand field
    brandHi?: string;

    @Prop({ unique: true, sparse: true, index: true })
    barcode?: string; // EAN/UPC (for default variant)

    @Prop()
    sku?: string; // Auto-generated

    // Hierarchy references
    @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
    categoryId!: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Subcategory', required: false, index: true })
    subcategoryId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ItemGroup', required: false, index: true })
    itemGroupId?: Types.ObjectId;

    // Legacy field (kept for backward compatibility)
    @Prop()
    subcategory?: string;

    // Pricing (default/single variant)
    @Prop({ type: Pricing, default: {} })
    pricing!: Pricing;

    // Legacy support - map to pricing
    @Prop()
    price?: number;

    @Prop()
    originalPrice?: number;

    // Pack Info (default/single variant)
    @Prop({ type: PackInfo, default: {} })
    pack!: PackInfo;

    // Legacy support
    @Prop()
    unit?: string;

    // Inventory (default/single variant)
    @Prop({ required: true, default: 0 })
    stock!: number;

    @Prop({ default: false })
    isPerishable!: boolean;

    @Prop({ default: 0 })
    shelfLife!: number; // Days

    // Product Variants (SKUs) - Blinkit style
    @Prop({ type: [ProductVariant], default: [] })
    variants!: ProductVariant[];

    // Structured Attributes
    @Prop({ type: Attributes, default: {} })
    attributes!: Attributes;

    // Nutrition (numeric only)
    @Prop({ type: Nutrition, default: {} })
    nutrition!: Nutrition;

    // Templates
    @Prop({ type: Templates, default: {} })
    templates!: Templates;

    // Media
    @Prop({ type: [String], default: [] })
    images!: string[];

    // Legacy support
    @Prop()
    image?: string;

    @Prop()
    description?: string;

    @Prop() // Hindi description field
    descriptionHi?: string;

    // Status
    @Prop({ default: true, index: true })
    isAvailable!: boolean;

    // Analytics
    @Prop({ default: 0 })
    rating!: number;

    @Prop({ default: 0 })
    reviewCount!: number;

    @Prop({ default: 0 })
    soldCount!: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Indexes for efficient queries
ProductSchema.index({ categoryId: 1, isAvailable: 1 });
ProductSchema.index({ subcategoryId: 1, isAvailable: 1 });
ProductSchema.index({ itemGroupId: 1, isAvailable: 1 });
ProductSchema.index({ categoryId: 1, subcategoryId: 1, itemGroupId: 1 }); // Compound hierarchy index
ProductSchema.index({ name: 'text', brand: 'text' });
ProductSchema.index({ isAvailable: 1, soldCount: -1 }); // For popular products
ProductSchema.index({ isAvailable: 1, createdAt: -1 }); // For new products
ProductSchema.index({ brand: 1, categoryId: 1 }); // For brand filtering

// Virtual for backward compatibility - price from pricing.sellingPrice
ProductSchema.virtual('displayPrice').get(function () {
    return this.pricing?.sellingPrice || this.price || 0;
});

// Virtual for total stock across all variants
ProductSchema.virtual('totalStock').get(function () {
    if (this.variants && this.variants.length > 0) {
        return this.variants.reduce((sum: number, v: any) => sum + (v.stock || 0), 0);
    }
    return this.stock || 0;
});

// Pre-save middleware to sync legacy fields with new structure
ProductSchema.pre('save', function () {
    const doc = this as any;

    // Sync pricing
    if (doc.pricing?.sellingPrice && !doc.price) {
        doc.price = doc.pricing.sellingPrice;
    }
    if (doc.price && !doc.pricing?.sellingPrice) {
        if (!doc.pricing) doc.pricing = {};
        doc.pricing.sellingPrice = doc.price;
        doc.pricing.mrp = doc.originalPrice || doc.price;
    }

    // Sync unit
    if (doc.pack?.unit && !doc.unit) {
        doc.unit = doc.pack.unit;
    }
    if (doc.unit && !doc.pack?.unit) {
        if (!doc.pack) doc.pack = {};
        doc.pack.unit = doc.unit;
    }

    // Sync image
    if (doc.images?.length && !doc.image) {
        doc.image = doc.images[0];
    }
    if (doc.image && (!doc.images || !doc.images.length)) {
        doc.images = [doc.image];
    }

    // Auto-generate SKU if not present
    if (!doc.sku && doc.barcode) {
        doc.sku = `SKU-${doc.barcode}`;
    } else if (!doc.sku) {
        doc.sku = `SKU-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    // Sync stock from default variant if variants exist
    if (doc.variants && doc.variants.length > 0) {
        const defaultVariant = doc.variants.find((v: any) => v.isDefault) || doc.variants[0];
        if (defaultVariant) {
            doc.stock = defaultVariant.stock;
            doc.price = defaultVariant.sellingPrice;
            doc.originalPrice = defaultVariant.mrp;
            doc.unit = defaultVariant.unit;
            doc.barcode = defaultVariant.barcode || doc.barcode;
        }
    }
});
