/**
 * What one cart / order line actually sells: the product itself, or one of its pack-size
 * variants. Shared by the cart, POST /orders/quote and POST /orders so all three price and
 * check stock the same way.
 *
 *   - `variantSku` given  → that active variant (unknown / inactive sku → not sellable).
 *   - no sku, product has active variants → its default variant (isDefault, else the first
 *     active one). Older clients that never send a sku keep working, and the stock they
 *     consume is the default variant's (data-architecture.md §1: when variants exist, stock
 *     lives in the variants).
 *   - no variants → the product, exactly as before.
 *
 * `mirrorsTopLevel`: the product's own price / unit / stock fields are a copy of the default
 * variant (product.schema pre-save). Reserving that variant also moves the top-level `stock`
 * so the copy stays in step.
 */
import { checkoutPriceOf, isProductSellable } from './schemas/product.schema';

export interface SellableLine {
  /** Set when the line is a variant. */
  variantSku?: string;
  /** Snapshot: the SKU sold (variant sku, else the product sku). */
  sku?: string;
  /** Snapshot: pack label ("5 kg"). */
  unit?: string;
  /** Snapshot: MRP for that pack. */
  mrp?: number;
  price: number;
  stock: number;
  mirrorsTopLevel: boolean;
}

const activeVariantsOf = (product: any): any[] =>
  Array.isArray(product?.variants)
    ? product.variants.filter((v: any) => v && v.isActive !== false && v.sku)
    : [];

const positive = (n: any): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;

/**
 * The sellable line for `product` (+ optional `variantSku`), or null when it can't be bought
 * (product unavailable, unknown sku, inactive or unpriced variant).
 */
export function sellableLine(
  product: any,
  variantSku?: string | null,
): SellableLine | null {
  if (!isProductSellable(product)) return null;
  const variants = activeVariantsOf(product);
  const all = Array.isArray(product.variants) ? product.variants : [];
  const defaultVariant = all.find((v: any) => v?.isDefault) || all[0];

  let variant: any = null;
  if (variantSku) {
    variant = variants.find((v) => v.sku === variantSku) || null;
    if (!variant) return null;
  } else if (variants.length) {
    variant = variants.find((v) => v.isDefault) || variants[0];
  }

  if (variant) {
    const price = positive(variant.sellingPrice);
    if (price === null) return null;
    return {
      variantSku: variant.sku,
      sku: variant.sku,
      unit: variant.unit,
      mrp: positive(variant.mrp) ?? price,
      price,
      stock: Number(variant.stock) || 0,
      mirrorsTopLevel: !!defaultVariant && defaultVariant.sku === variant.sku,
    };
  }

  const price = checkoutPriceOf(product) as number;
  return {
    sku: product.sku || undefined,
    unit: product.pack?.unit || product.unit || undefined,
    mrp:
      positive(product.pricing?.mrp) ??
      positive(product.originalPrice) ??
      price,
    price,
    stock: Number(product.stock) || 0,
    mirrorsTopLevel: false,
  };
}

/** A stock reservation / release for one line. */
export interface StockLine {
  productId: string;
  quantity: number;
  variantSku?: string;
  /** Also move the top-level `stock` (the default variant's mirror). */
  mirror?: boolean;
}
