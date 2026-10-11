import { oid, KIND } from './ids';
import { products } from './catalog';
import { addresses, MOCK_USER_ID, rider } from './account';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

const byName = (fragment) => products.find((p) => p.name.includes(fragment));

const line = (fragment, quantity) => {
    const p = byName(fragment);
    return { productId: p._id, name: p.name, quantity, price: p.price, image: p.image };
};

const toDeliveryAddress = (addr) => ({
    type: addr.type,
    address: addr.address,
    city: addr.city,
    pincode: addr.pincode,
    coordinates: { type: 'Point', coordinates: [addr.longitude, addr.latitude] },
});

const STATUS_FLOW = ['PENDING', 'CONFIRMED', 'ASSIGNED', 'PACKED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];

/** Timeline entries for every step up to `status`, spaced `stepMs` apart from `start`. */
export const buildTimeline = (status, start, stepMs = 2 * MIN) => {
    if (status === 'CANCELLED') {
        return [
            { status: 'PENDING', timestamp: new Date(start).toISOString(), changedBy: MOCK_USER_ID },
            { status: 'CANCELLED', timestamp: new Date(start + 3 * MIN).toISOString(), changedBy: MOCK_USER_ID },
        ];
    }
    const upto = STATUS_FLOW.indexOf(status);
    return STATUS_FLOW.slice(0, upto + 1).map((s, i) => ({
        status: s,
        timestamp: new Date(start + i * stepMs).toISOString(),
        changedBy: i >= 4 ? rider._id : MOCK_USER_ID,
    }));
};

const totals = (items, { deliveryFee = 0, packagingFee = 5, discount = 0 } = {}) => {
    const itemTotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
    return { itemTotal, deliveryFee, packagingFee, discount, totalAmount: itemTotal + deliveryFee + packagingFee - discount };
};

const orderNumber = (date, seq) => {
    const d = new Date(date);
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `ORD-${ymd}-${String(seq).padStart(4, '0')}`;
};

/**
 * Raw order documents (orders/schemas/order.schema.ts) relative to `now`, so
 * the active order is always "live" whenever the app starts.
 * `_mock` holds mock-only metadata and is stripped from responses.
 */
export const buildSeedOrders = (now = Date.now()) => {
    const home = addresses[0];
    const work = addresses[1];

    const specs = [
        {
            n: 1, status: 'OUT_FOR_DELIVERY', ago: 6 * MIN, addr: home, method: 'UPI', paid: 'COMPLETED', riderAssigned: true,
            items: [line('Taaza Toned', 2), line('Whole Wheat Bread', 1), line('White Eggs', 1), line('Banana', 1), line('Aloo Bhujia', 1)],
            fees: { deliveryFee: 0, discount: 20 }, instructions: 'Call on arrival',
            live: true,
        },
        {
            n: 2, status: 'CONFIRMED', ago: 1 * MIN, addr: work, method: 'COD', paid: 'PENDING', riderAssigned: false,
            items: [line('Tata Tea Gold', 1), line('Parle-G', 1), line('Maggi', 2)],
            fees: { deliveryFee: 25 },
        },
        {
            n: 3, status: 'DELIVERED', ago: 1 * DAY + 3 * 60 * MIN, addr: home, method: 'COD', paid: 'COMPLETED', riderAssigned: true,
            items: [line('Shudh Chakki Atta', 1), line('Toor Dal', 1), line('Sunflower Oil', 1), line('Tata Salt', 1), line('Onion', 2), line('Potato', 1)],
            fees: { deliveryFee: 0, discount: 40 },
        },
        {
            n: 4, status: 'DELIVERED', ago: 4 * DAY + 5 * 60 * MIN, addr: work, method: 'CARD', paid: 'COMPLETED', riderAssigned: true,
            items: [line('Coca-Cola', 2), line("Magic Masala", 4), line('Good Day', 2)],
            fees: { deliveryFee: 25 },
        },
        {
            n: 5, status: 'CANCELLED', ago: 8 * DAY, addr: home, method: 'UPI', paid: 'REFUNDED', riderAssigned: false,
            items: [line('Surf Excel Easy Wash', 1), line('Vim Lemon Dishwash Bar', 1), line('Harpic', 1)],
            fees: { deliveryFee: 0 }, cancellationReason: 'Ordered by mistake',
        },
    ];

    return specs.map((s) => {
        const createdAt = now - s.ago;
        const t = totals(s.items, s.fees);
        const deliveredAt = s.status === 'DELIVERED' ? createdAt + 14 * MIN : null;
        return {
            _id: oid(KIND.order, s.n),
            orderId: orderNumber(createdAt, 1040 + s.n),
            userId: MOCK_USER_ID,
            items: s.items,
            ...t,
            deliveryAddress: toDeliveryAddress(s.addr),
            paymentMethod: s.method,
            paymentStatus: s.paid,
            orderStatus: s.status,
            timeline: buildTimeline(s.status, createdAt, s.live ? 1 * MIN : 2 * MIN),
            riderId: s.riderAssigned ? rider._id : null,
            deliveryInstructions: s.instructions || '',
            estimatedDeliveryTime: new Date(s.live ? now + 8 * MIN : createdAt + 12 * MIN).toISOString(),
            actualDeliveryTime: deliveredAt ? new Date(deliveredAt).toISOString() : undefined,
            cancellationReason: s.cancellationReason,
            deliveryOtp: '4821',
            createdAt: new Date(createdAt).toISOString(),
            updatedAt: new Date(deliveredAt || createdAt + 3 * MIN).toISOString(),
            _mock: s.live ? { outForDeliveryAt: now, loop: true } : {},
        };
    });
};

export { toDeliveryAddress, totals, orderNumber };
