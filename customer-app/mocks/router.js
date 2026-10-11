// Mock implementation of the backend REST API (backend/src/modules/*).
// Response bodies mirror the Nest controllers exactly (no global envelope;
// only /payments/* wraps in { success, data }).
import { categories, subcategories, itemGroups, brands, products, banners } from './fixtures/catalog';
import { oid, KIND } from './fixtures/ids';
import { orderNumber } from './fixtures/orders';
import { db, persist, findOrder, liveTracking, tick } from './db';
import { distanceMeters } from './geo';

const ok = (body, status = 200) => ({ status, body });
const fail = (status, message) => ({
    status,
    body: {
        statusCode: status,
        message,
        error: { 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found' }[status] || 'Error',
    },
});

const categoryById = Object.fromEntries(categories.map((c) => [c._id, c]));
const subById = Object.fromEntries(subcategories.map((s) => [s._id, s]));
const groupById = Object.fromEntries(itemGroups.map((g) => [g._id, g]));

const publicCategory = ({ key, ...c }) => c;
const publicSub = ({ key, ...s }) => s;

// Mirrors .populate('categoryId', 'name type').populate('subcategoryId', 'name parentId')...
const populateProduct = (p) => {
    const cat = categoryById[p.categoryId];
    const sub = subById[p.subcategoryId];
    const grp = groupById[p.itemGroupId];
    return {
        ...p,
        categoryId: cat ? { _id: cat._id, name: cat.name, type: cat.type } : p.categoryId,
        subcategoryId: sub ? { _id: sub._id, name: sub.name, parentId: sub.parentId } : p.subcategoryId,
        itemGroupId: grp ? { _id: grp._id, name: grp.name, subcategoryId: grp.subcategoryId } : p.itemGroupId,
    };
};

const toInt = (v, fallback) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

const listProducts = (q) => {
    let list = products;
    if (q.categoryId) list = list.filter((p) => p.categoryId === q.categoryId);
    if (q.subcategoryId) list = list.filter((p) => p.subcategoryId === q.subcategoryId);
    if (q.itemGroupId) list = list.filter((p) => p.itemGroupId === q.itemGroupId);
    if (q.search) {
        const terms = String(q.search).toLowerCase().split(/\s+/).filter(Boolean);
        list = list.filter((p) => {
            const hay = `${p.name} ${p.brand} ${p.subcategory} ${categoryById[p.categoryId]?.name}`.toLowerCase();
            return terms.some((t) => hay.includes(t));
        });
    }
    const page = Math.min(toInt(q.page, 1), 10000);
    const limit = Math.min(toInt(q.limit, 20), 100);
    const total = list.length;
    return {
        products: list.slice((page - 1) * limit, page * limit).map(populateProduct),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};

// ---------- orders ----------

const stripMock = ({ _mock, deliveryOtp, ...rest }) => rest;

const riderView = (location) => ({
    id: db.rider._id,
    name: db.rider.name,
    phone: db.rider.phone,
    vehicleType: db.rider.vehicleType,
    vehicleNumber: db.rider.vehicleNumber,
    rating: db.rider.rating,
    totalDeliveries: db.rider.totalDeliveries,
    status: db.rider.status,
    currentLocation: location ? { latitude: location.latitude, longitude: location.longitude } : null,
});

/** Order list item: riderId populated with 'name phone' (findByUserId). */
export const listOrderView = (order) => {
    tick(order);
    const base = stripMock(order);
    return {
        ...base,
        riderId: order.riderId ? { _id: db.rider._id, name: db.rider.name, phone: db.rider.phone } : null,
    };
};

/** GET /orders/:id payload (OrdersService.buildRealtimeOrderPayload). */
export const trackingOrderView = (order, { includeDeliveryOtp = true } = {}) => {
    const tracking = liveTracking(order);
    const loc = tracking.riderLocation;
    const base = stripMock(order);
    return {
        ...base,
        userId: { _id: db.profile.id, name: db.profile.name, phone: db.profile.phone },
        riderId: order.riderId
            ? {
                ...db.rider,
                currentLocation: loc ? { type: 'Point', coordinates: [loc.longitude, loc.latitude] } : undefined,
                lastLocationUpdate: tracking.lastLocationUpdateAt,
            }
            : null,
        ...(includeDeliveryOtp ? { deliveryOtp: order.deliveryOtp } : {}),
        rider: order.riderId ? riderView(loc) : null,
        estimatedDeliveryTime: tracking.estimatedDeliveryTime || order.estimatedDeliveryTime,
        customerName: db.profile.name || 'Customer',
        customerPhone: db.profile.phone || '',
        storeName: db.settings.storeName,
        storePhone: db.settings.contactPhone,
        storeAddress: db.settings.location.address,
        storeLocation: { latitude: db.settings.location.latitude, longitude: db.settings.location.longitude },
        tracking,
    };
};

const createOrder = (body) => {
    if (!Array.isArray(body?.items) || body.items.length === 0) return fail(400, 'Order must contain at least one item');
    const addr = body.deliveryAddress || {};
    if (!addr.address || !addr.city || !addr.pincode) return fail(400, 'deliveryAddress.address, city and pincode are required');

    // CheckoutScreen drops lat/lng from saved addresses; fall back to the
    // matching saved address, then the default one, so tracking has a destination.
    const saved = db.addresses.find((a) => a.address === addr.address) || db.addresses.find((a) => a.isDefault) || db.addresses[0];
    const lat = Number(addr.latitude ?? saved?.latitude ?? db.settings.location.latitude + 0.012);
    const lng = Number(addr.longitude ?? saved?.longitude ?? db.settings.location.longitude - 0.013);

    const now = Date.now();
    const n = db.orders.filter((o) => o._mock?.created).length + 100;
    const items = body.items.map((it) => ({
        productId: it.productId,
        name: it.name,
        quantity: Number(it.quantity) || 1,
        price: Number(it.price) || 0,
        image: it.image,
    }));
    const itemTotal = Number(body.itemTotal) || items.reduce((s, it) => s + it.price * it.quantity, 0);
    const order = {
        _id: oid(KIND.order, 0x1000 + n),
        orderId: orderNumber(now, 2000 + n),
        userId: db.profile.id,
        items,
        itemTotal,
        deliveryFee: Number(body.deliveryFee) || 0,
        packagingFee: Number(body.packagingFee) || 0,
        discount: Number(body.discount) || 0,
        totalAmount: Number(body.totalAmount) || itemTotal,
        deliveryAddress: {
            type: addr.type || 'Home',
            address: addr.address,
            city: addr.city,
            pincode: String(addr.pincode),
            coordinates: { type: 'Point', coordinates: [lng, lat] },
        },
        paymentMethod: body.paymentMethod || 'COD',
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING',
        timeline: [{ status: 'PENDING', timestamp: new Date(now).toISOString(), changedBy: db.profile.id }],
        riderId: null,
        deliveryInstructions: body.instructions || body.deliveryInstructions || '',
        estimatedDeliveryTime: new Date(now + 12 * 60000).toISOString(),
        deliveryOtp: String(1000 + Math.floor(Math.random() * 9000)),
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        _mock: { created: true, paymentPolls: 0 },
    };
    if (order.paymentMethod === 'COD') {
        order.orderStatus = 'CONFIRMED';
        order.timeline.push({ status: 'CONFIRMED', timestamp: new Date(now).toISOString(), changedBy: db.profile.id });
    }
    db.orders.unshift(order);
    persist();
    return ok({ order: listOrderView(order) }, 201);
};

const getOrder = (id) => {
    const order = findOrder(id);
    if (!order) return fail(404, 'Order not found');
    // Online payments: the first poll sees PENDING, the next one COMPLETED.
    if (order._mock?.created && order.paymentMethod !== 'COD' && order.paymentStatus === 'PENDING') {
        order._mock.paymentPolls = (order._mock.paymentPolls || 0) + 1;
        if (order._mock.paymentPolls >= 2) {
            order.paymentStatus = 'COMPLETED';
            order.paymentConfirmedAt = new Date().toISOString();
            order.orderStatus = 'CONFIRMED';
            order.timeline.push({ status: 'CONFIRMED', timestamp: order.paymentConfirmedAt, changedBy: db.profile.id });
        }
        persist();
    }
    return ok({ order: trackingOrderView(order) });
};

// tick() first so the list shows the same time-driven status as GET /orders/:id
const userOrders = () => db.orders
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((o) => listOrderView(tick(o)));

// ---------- maps ----------

const PLACES = [
    ['Golghar', 'Golghar, Gorakhpur, Uttar Pradesh 273001', 26.7606, 83.3731, '273001'],
    ['Rapti Nagar', 'Rapti Nagar Phase 4, Gorakhpur, Uttar Pradesh 273016', 26.7084, 83.4496, '273016'],
    ['Gorakhnath Mandir', 'Gorakhnath Temple Road, Gorakhpur, Uttar Pradesh 273015', 26.7489, 83.3619, '273015'],
    ['Shahpur', 'Shahpur, Gorakhpur, Uttar Pradesh 273006', 26.7344, 83.3889, '273006'],
    ['Kauriram Road', 'Kauriram Road, Gorakhpur, Uttar Pradesh 273016', 26.6965, 83.4627, '273016'],
    ['Taramandal', 'Taramandal Road, Gorakhpur, Uttar Pradesh 273016', 26.7339, 83.4089, '273016'],
    ['Medical College Road', 'Medical College Road, Gorakhpur, Uttar Pradesh 273013', 26.7922, 83.3952, '273013'],
    ['Gorakhpur Junction', 'Railway Station Road, Gorakhpur, Uttar Pradesh 273012', 26.7588, 83.3807, '273012'],
];

const storeLoc = () => ({ latitude: db.settings.location.latitude, longitude: db.settings.location.longitude });

const placeResult = ([name, formattedAddress, latitude, longitude, pincode], i) => ({
    placeId: `mock-place-${i + 1}`,
    name,
    formattedAddress,
    latitude,
    longitude,
    distanceKm: Math.round(distanceMeters(storeLoc(), { latitude, longitude }) / 100) / 10,
    city: 'Gorakhpur',
    state: 'Uttar Pradesh',
    pincode,
    type: 'locality',
});

const searchPlaces = (q) => {
    const query = String(q.query || q.q || '').toLowerCase().trim();
    // Like MapsService.searchPlaces: only places inside the delivery radius, nearest first.
    const results = PLACES
        .map(placeResult)
        .filter((p) => !query || p.name.toLowerCase().includes(query) || p.formattedAddress.toLowerCase().includes(query))
        .filter((p) => p.distanceKm <= db.settings.serviceRadiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    return ok({ responseCode: 200, results });
};

// Address of the nearest known place, at the requested coordinates.
const geocodeResult = (latitude, longitude) => {
    const nearest = PLACES.map(placeResult).sort((a, b) => (
        distanceMeters(a, { latitude, longitude }) - distanceMeters(b, { latitude, longitude })
    ))[0];
    return {
        formattedAddress: nearest.formattedAddress,
        houseNumber: '',
        HOUSE_NAME: '',
        street: nearest.name,
        area: nearest.name,
        city: 'Gorakhpur',
        district: 'Gorakhpur',
        state: 'Uttar Pradesh',
        pincode: nearest.pincode,
        country: 'India',
        lat: latitude,
        lng: longitude,
        latitude,
        longitude,
    };
};

// ---------- auth ----------

const issueTokens = () => {
    const stamp = Date.now().toString(36);
    return {
        accessToken: `mock-access-${stamp}`,
        refreshToken: `mock-refresh-${stamp}`,
    };
};

const sessionUser = () => ({ id: db.profile.id, name: db.profile.name, phone: db.profile.phone, role: 'customer' });

const profileView = () => ({
    id: db.profile.id,
    name: db.profile.name,
    phone: db.profile.phone,
    email: db.profile.email,
    profilePicture: db.profile.profilePicture,
    role: 'customer',
    addresses: db.addresses,
});

const addressIndex = (raw) => {
    const i = parseInt(raw, 10);
    return Number.isInteger(i) && i >= 0 && i < db.addresses.length ? i : -1;
};

const normalizeAddress = (body, prev = {}) => {
    const next = { ...prev };
    ['type', 'address', 'city', 'pincode', 'isDefault', 'latitude', 'longitude'].forEach((k) => {
        if (body?.[k] !== undefined) next[k] = body[k];
    });
    if (next.isDefault) db.addresses.forEach((a) => { a.isDefault = false; });
    return next;
};

// ---------- cart (CartService shape; the app keeps its cart in Redux) ----------

const cartView = () => {
    const items = db.cart.map((it) => {
        const p = products.find((x) => x._id === it.productId);
        return { productId: it.productId, quantity: it.quantity, price: it.price, name: p?.name, image: p?.image, unit: p?.unit, isAvailable: p?.isAvailable ?? false };
    });
    return {
        userId: db.profile.id,
        items,
        itemCount: items.reduce((s, it) => s + it.quantity, 0),
        total: items.reduce((s, it) => s + it.price * it.quantity, 0),
    };
};

// ---------- route table ----------

const PUBLIC = [/^\/auth\/(send-otp|verify-otp|refresh)$/, /^\/(products|categories|subcategories|item-groups|brands|settings|maps|banners)(\/|$)/];

const routes = [
    // auth
    ['POST', /^\/auth\/send-otp$/, ({ body }) => {
        if (!/^\+?\d{10,13}$/.test(String(body?.phone || '').replace(/\s/g, ''))) return fail(400, 'Please enter a valid phone number');
        return ok({ message: 'OTP sent successfully (mock mode: any 4-digit OTP works)', sessionId: `mock-${Date.now()}` });
    }],
    ['POST', /^\/auth\/verify-otp$/, ({ body }) => {
        if (!/^\d{4,6}$/.test(String(body?.otp || ''))) return fail(400, 'Invalid OTP');
        if (body?.phone) db.profile.phone = String(body.phone).replace(/^\+91/, '');
        persist();
        return ok({ user: sessionUser(), ...issueTokens(), message: 'Login successful' });
    }],
    ['POST', /^\/auth\/refresh$/, ({ body }) => {
        if (!body?.refreshToken) return fail(401, 'Refresh token is required');
        return ok({ user: sessionUser(), ...issueTokens(), message: 'Tokens refreshed' });
    }],
    ['POST', /^\/auth\/logout$/, () => ok({ message: 'Logged out successfully' })],

    // users
    ['GET', /^\/users\/me$/, () => ok(profileView())],
    ['PUT', /^\/users\/me$/, ({ body }) => {
        ['name', 'email', 'profilePicture'].forEach((k) => { if (body?.[k] !== undefined) db.profile[k] = body[k]; });
        persist();
        return ok(profileView());
    }],
    ['POST', /^\/users\/addresses$/, ({ body }) => {
        if (!body?.address || !body?.city || !body?.pincode || !body?.type) return fail(400, 'type, address, city and pincode are required');
        db.addresses.push(normalizeAddress(body, { isDefault: false }));
        persist();
        return ok({ addresses: db.addresses }, 201);
    }],
    ['PUT', /^\/users\/addresses\/([^/]+)$/, ({ params, body }) => {
        const i = addressIndex(params[0]);
        if (i < 0) return fail(400, 'Invalid address index');
        db.addresses[i] = normalizeAddress(body, db.addresses[i]);
        persist();
        return ok({ addresses: db.addresses });
    }],
    ['DELETE', /^\/users\/addresses\/([^/]+)$/, ({ params }) => {
        const i = addressIndex(params[0]);
        if (i < 0) return fail(400, 'Invalid address index');
        db.addresses.splice(i, 1);
        persist();
        return ok({ addresses: db.addresses });
    }],

    // settings
    ['GET', /^\/settings\/store$/, () => ok({ ...db.settings })],
    ['GET', /^\/settings\/check-serviceability$/, ({ query }) => {
        const lat = parseFloat(query.latitude);
        const lon = parseFloat(query.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return ok({ isServiceable: false, message: 'Invalid coordinates provided' });
        const km = distanceMeters(storeLoc(), { latitude: lat, longitude: lon }) / 1000;
        const isServiceable = km <= db.settings.serviceRadiusKm;
        return ok({
            isServiceable,
            distanceKm: Math.round(km * 10) / 10,
            serviceRadiusKm: db.settings.serviceRadiusKm,
            message: isServiceable
                ? 'Great! We deliver to your location.'
                : `We are not serviceable at this location. Please select a location within ${db.settings.serviceRadiusKm}km.`,
        });
    }],

    // catalog
    ['GET', /^\/categories$/, () => ok({ categories: categories.map(publicCategory) })],
    ['GET', /^\/categories\/nested$/, () => ok({
        categories: categories.map((c) => ({ ...publicCategory(c), subcategories: subcategories.filter((s) => s.parentId === c._id).map(publicSub) })),
    })],
    ['GET', /^\/categories\/([^/]+)\/subcategories$/, ({ params }) => ok({ subcategories: subcategories.filter((s) => s.parentId === params[0]).map(publicSub) })],
    ['GET', /^\/categories\/([^/]+)$/, ({ params }) => {
        const c = categoryById[params[0]];
        return c ? ok({ category: publicCategory(c) }) : fail(404, 'Category not found');
    }],
    ['GET', /^\/subcategories$/, ({ query }) => ok({
        subcategories: subcategories.filter((s) => !query.parentId || s.parentId === query.parentId).map(publicSub),
    })],
    ['GET', /^\/subcategories\/([^/]+)$/, ({ params }) => {
        const s = subById[params[0]];
        return s ? ok({ subcategory: publicSub(s) }) : fail(404, 'Subcategory not found');
    }],
    ['GET', /^\/item-groups$/, ({ query }) => ok({
        itemGroups: itemGroups.filter((g) => !query.subcategoryId || g.subcategoryId === query.subcategoryId),
    })],
    ['GET', /^\/item-groups\/([^/]+)$/, ({ params }) => {
        const g = groupById[params[0]];
        return g ? ok({ itemGroup: g }) : fail(404, 'Item group not found');
    }],
    ['GET', /^\/brands$/, () => ok({ brands })],
    ['GET', /^\/brands\/([^/]+)$/, ({ params }) => {
        const b = brands.find((x) => x._id === params[0]);
        return b ? ok({ brand: b }) : fail(404, 'Brand not found');
    }],
    ['GET', /^\/products$/, ({ query }) => ok(listProducts(query))],
    ['GET', /^\/products\/barcode\/([^/]+)$/, ({ params }) => {
        const p = products.find((x) => x.barcode === params[0]);
        return p ? ok({ product: populateProduct(p), source: 'database' }) : fail(404, 'Product not found');
    }],
    ['GET', /^\/products\/([^/]+)$/, ({ params }) => {
        const p = products.find((x) => x._id === params[0]);
        return p ? ok({ product: populateProduct(p) }) : fail(404, 'Product not found');
    }],
    ['GET', /^\/banners$/, () => ok({ banners })],

    // cart
    ['GET', /^\/cart$/, () => ok(cartView())],
    ['POST', /^\/cart\/add$/, ({ body }) => {
        const p = products.find((x) => x._id === body?.productId);
        if (!p) return fail(404, 'Product not found');
        const existing = db.cart.find((it) => it.productId === p._id);
        if (existing) existing.quantity += Number(body.quantity) || 1;
        else db.cart.push({ productId: p._id, quantity: Number(body.quantity) || 1, price: p.price });
        persist();
        return ok(cartView());
    }],
    ['PUT', /^\/cart\/update$/, ({ body }) => {
        const existing = db.cart.find((it) => it.productId === body?.productId);
        if (!existing) return fail(404, 'Item not in cart');
        existing.quantity = Number(body.quantity) || 0;
        db.cart = db.cart.filter((it) => it.quantity > 0);
        persist();
        return ok(cartView());
    }],
    ['DELETE', /^\/cart\/remove\/([^/]+)$/, ({ params }) => {
        db.cart = db.cart.filter((it) => it.productId !== params[0]);
        persist();
        return ok(cartView());
    }],
    ['DELETE', /^\/cart\/clear$/, () => {
        db.cart = [];
        persist();
        return ok({ message: 'Cart cleared' });
    }],

    // orders
    ['POST', /^\/orders$/, ({ body }) => createOrder(body)],
    ['GET', /^\/orders$/, ({ query }) => {
        const all = userOrders();
        const page = toInt(query.page, 1);
        const limit = toInt(query.limit, 10);
        return ok({ orders: all.slice((page - 1) * limit, page * limit), total: all.length, page, limit, totalPages: Math.ceil(all.length / limit) });
    }],
    // Backend: rider-only endpoints.
    ['GET', /^\/orders\/(available|current)$/, () => fail(403, 'Only riders can access active rider orders')],
    ['GET', /^\/orders\/user\/([^/]+)$/, () => ok({ orders: userOrders() })],
    ['GET', /^\/orders\/([^/]+)\/status$/, ({ params }) => {
        const o = findOrder(params[0]);
        if (!o) return fail(404, 'Order not found');
        tick(o);
        return ok({ orderId: params[0], status: o.orderStatus });
    }],
    ['GET', /^\/orders\/([^/]+)\/history$/, ({ params }) => {
        const o = findOrder(params[0]);
        if (!o) return fail(404, 'Order not found');
        tick(o);
        let prev = null;
        const history = (o.timeline || []).map((t) => {
            const entry = { previousStatus: prev, newStatus: t.status, note: undefined, createdAt: t.timestamp };
            prev = t.status;
            return entry;
        });
        return ok({ history });
    }],
    ['GET', /^\/orders\/([^/]+)$/, ({ params }) => getOrder(params[0])],
    // Backend forbids customers from changing status (incl. cancelling).
    ['PATCH', /^\/orders\/([^/]+)\/status$/, () => fail(403, 'Customers cannot update order status')],

    // payments
    ['POST', /^\/payments\/seamless-hash$/, ({ body }) => {
        const o = findOrder(body?.orderId);
        if (!o) return fail(404, 'Order not found');
        if (o.paymentStatus === 'COMPLETED') return fail(400, 'Order is already paid');
        return ok({
            success: true,
            data: {
                key: 'MOCKKEY',
                txnid: o.orderId,
                amount: Number(o.totalAmount).toFixed(2),
                productinfo: `Order ${o.orderId}`,
                firstname: db.profile.name,
                email: db.profile.email || 'customer@example.com',
                phone: db.profile.phone,
                surl: 'http://localhost:3000/api/v1/payments/success',
                furl: 'http://localhost:3000/api/v1/payments/failure',
                hash: 'mockhash0000000000000000000000000000000000000000000000000000000000',
                environment: '1',
                ...(body.pg ? { pg: body.pg } : {}),
                ...(body.bankcode ? { bankcode: body.bankcode } : {}),
                mockPayment: true,
            },
        });
    }],

    // maps proxy (called with fetch() from services/locationService.js)
    ['GET', /^\/maps\/search$/, ({ query }) => searchPlaces(query)],
    ['GET', /^\/maps\/geocode$/, ({ query }) => {
        const match = PLACES.find(([name]) => String(query.address || '').toLowerCase().includes(name.toLowerCase())) || PLACES[1];
        return ok({ responseCode: 200, results: [geocodeResult(match[2], match[3])] });
    }],
    ['GET', /^\/maps\/reverse-geocode$/, ({ query }) => {
        const lat = parseFloat(query.latitude);
        const lng = parseFloat(query.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail(400, 'latitude and longitude are required');
        return ok({ responseCode: 200, results: [geocodeResult(lat, lng)] });
    }],
];

/**
 * @param {{ method: string, path: string, query: object, body: any, authorization?: string }} req
 * @returns {{ status: number, body: any }}
 */
export const handle = ({ method, path, query = {}, body, authorization }) => {
    const isPublic = PUBLIC.some((re) => re.test(path));
    if (!isPublic && !/^Bearer\s+\S+/.test(authorization || '')) {
        return fail(401, 'Unauthorized');
    }
    for (const [m, re, fn] of routes) {
        if (m !== method) continue;
        const match = path.match(re);
        if (match) return fn({ params: match.slice(1).map(decodeURIComponent), query, body });
    }
    return fail(404, `Mock API: no handler for ${method} ${path}`);
};
