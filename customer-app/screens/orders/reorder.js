/**
 * reorderAvailable — "Reorder all" for a past order, checked against the live catalogue.
 *
 * Each line is looked up again (GET /products/:id) so the cart gets today's price and only what
 * can actually be bought: unavailable or sold-out lines are skipped, and a line asking for more
 * than the shelf holds is capped at the stock. Nothing is added from the old order's prices.
 *
 * Returns { units, lines, skipped: [name], capped: [name] }.
 */
import { addToCart, incrementQuantity } from '../../store/slices/cartSlice';
import { ProductService } from '../../services/services';
import { getPrice, getProductId, getStock, isInStock, normalizeProduct } from '../../components/product/productUtils';

const lineId = (line) => line.productId?._id || line.productId || line.product?._id || line._id || line.id;

export async function reorderAvailable(dispatch, order, cartItems = []) {
    const lines = (order?.items || []).filter((l) => lineId(l) && l.quantity > 0);
    const fresh = await Promise.all(
        lines.map((l) =>
            ProductService.getProductById(String(lineId(l)))
                .then((p) => p)
                .catch(() => null),
        ),
    );
    const out = { units: 0, lines: 0, skipped: [], capped: [] };
    lines.forEach((line, i) => {
        const p = fresh[i];
        const name = line.name || p?.name || '';
        if (!p || p.isAvailable === false || !isInStock(p) || !(getPrice(p) > 0)) {
            out.skipped.push(name);
            return;
        }
        const id = getProductId(p) || String(lineId(line));
        const inCart = cartItems.find((c) => c.id === id)?.quantity || 0;
        const stock = getStock(p);
        const room = stock == null ? line.quantity : Math.max(0, stock - inCart);
        const qty = Math.min(line.quantity, room);
        if (qty <= 0) {
            out.capped.push(name);
            return;
        }
        if (qty < line.quantity) out.capped.push(name);
        if (inCart) dispatch(incrementQuantity(id));
        else dispatch(addToCart({ ...normalizeProduct(p, p.name), variants: undefined, id }));
        for (let n = 1; n < qty; n += 1) dispatch(incrementQuantity(id));
        out.units += qty;
        out.lines += 1;
    });
    return out;
}

export default reorderAvailable;
