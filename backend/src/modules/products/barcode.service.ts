import { Injectable } from '@nestjs/common';

interface OpenFoodFactsProduct {
  code: string;
  product: {
    product_name?: string;
    brands?: string;
    quantity?: string;
    categories?: string;
    image_url?: string;
    nutriments?: {
      proteins_100g?: number;
      carbohydrates_100g?: number;
      sugars_100g?: number;
      fat_100g?: number;
      'trans-fat_100g'?: number;
    };
  };
  status: number;
}

export interface BarcodeProductData {
  found: boolean;
  barcode: string;
  name?: string;
  brand?: string;
  unit?: string;
  category?: string;
  image?: string;
  nutrition?: {
    protein: number;
    carbs: number;
    sugar: number;
    fat: number;
    transFat: number;
  };
}

@Injectable()
export class BarcodeService {
  private readonly openFoodFactsUrl =
    'https://world.openfoodfacts.org/api/v2/product';

  async lookupBarcode(barcode: string): Promise<BarcodeProductData> {
    try {
      const response = await fetch(`${this.openFoodFactsUrl}/${barcode}.json`);

      if (!response.ok) {
        return { found: false, barcode };
      }

      const data: OpenFoodFactsProduct = await response.json();

      if (data.status !== 1 || !data.product) {
        return { found: false, barcode };
      }

      const product = data.product;

      return {
        found: true,
        barcode,
        name: product.product_name || undefined,
        brand: product.brands?.split(',')[0]?.trim() || undefined,
        unit: product.quantity || undefined,
        category: product.categories?.split(',')[0]?.trim() || undefined,
        image: product.image_url || undefined,
        nutrition: product.nutriments
          ? {
              protein: product.nutriments.proteins_100g || 0,
              carbs: product.nutriments.carbohydrates_100g || 0,
              sugar: product.nutriments.sugars_100g || 0,
              fat: product.nutriments.fat_100g || 0,
              transFat: product.nutriments['trans-fat_100g'] || 0,
            }
          : undefined,
      };
    } catch (error) {
      console.error('Barcode lookup error:', error);
      return { found: false, barcode };
    }
  }
}
