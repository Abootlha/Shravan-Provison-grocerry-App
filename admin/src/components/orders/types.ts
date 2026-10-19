/** Shapes returned by the admin order endpoints (docs/api/admin-api.md#orders). */

export type OrderStatus =
    | 'PENDING'
    | 'CONFIRMED'
    | 'ASSIGNED'
    | 'PACKED'
    | 'PICKED_UP'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'COD' | 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET';

export interface OrderItem {
    productId?: string | { _id: string; name?: string; image?: string };
    name: string;
    quantity: number;
    price: number;
    image?: string;
    /** Snapshots at order time (pack-size variants carry variantSku). */
    variantSku?: string;
    sku?: string;
    unit?: string;
    mrp?: number;
}

export interface OrderAddress {
    type?: string;
    address?: string;
    city?: string;
    pincode?: string;
    landmark?: string;
    coordinates?: { type?: string; coordinates?: [number, number] };
}

export interface OrderPerson {
    _id: string;
    name?: string;
    phone?: string;
}

export interface OrderRiderRef extends OrderPerson {
    vehicleType?: string;
    status?: string;
}

export interface Order {
    _id: string;
    orderId: string;
    orderStatus: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    itemTotal?: number;
    deliveryFee?: number;
    packagingFee?: number;
    discount?: number;
    totalAmount: number;
    items: OrderItem[];
    deliveryAddress?: OrderAddress;
    deliveryInstructions?: string;
    userId?: OrderPerson | string | null;
    riderId?: OrderRiderRef | string | null;
    requiresManualReview?: boolean;
    manualReviewReason?: string | null;
    cancellationReason?: string | null;
    estimatedDeliveryTime?: string | null;
    actualDeliveryTime?: string | null;
    createdAt: string;
    updatedAt?: string;
}

export interface OrdersResponse {
    orders: Order[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface LatLng {
    latitude: number;
    longitude: number;
}

export interface StatusTimelineEntry {
    previousStatus: OrderStatus | null;
    status: OrderStatus;
    note?: string | null;
    changedBy?: string | null;
    changedByName?: string | null;
    changedByRole?: 'admin' | 'manager' | 'customer' | 'rider' | string | null;
    at: string;
}

export interface OrderDetail extends Order {
    rider?: {
        id: string;
        name?: string;
        phone?: string;
        vehicleType?: string;
        rating?: number;
        totalDeliveries?: number;
        status?: string;
        currentLocation?: LatLng | null;
    } | null;
    customerName?: string;
    customerPhone?: string;
    storeName?: string;
    storePhone?: string;
    storeAddress?: string;
    storeLocation?: LatLng | null;
    tracking?: {
        activeLeg?: 'to_store' | 'to_customer' | null;
        riderLocation?: LatLng | null;
        routeCoordinates?: LatLng[] | null;
        estimatedDeliveryTime?: string | null;
        durationMinutes?: number | null;
        distanceRemaining?: number | null;
        lastLocationUpdateAt?: string | null;
    } | null;
    statusTimeline?: StatusTimelineEntry[];
    riderAssignmentPending?: boolean;
}

export interface AdminRider {
    _id: string;
    name: string;
    phone?: string;
    vehicleType?: string;
    status: 'available' | 'busy' | 'offline' | string;
    isActive: boolean;
    rating?: number;
    totalDeliveries?: number;
    stats?: { activeOrderCount?: number; deliveredToday?: number };
}

export interface AdminRidersResponse {
    riders: AdminRider[];
    summary?: { total: number; active: number; inactive: number; available: number; busy: number };
}

/** Summary payload of `order:new` / `order:updated` on the /orders socket namespace. */
export interface OrderEvent {
    _id: string;
    orderId: string;
    orderStatus: OrderStatus;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    totalAmount: number;
    itemCount?: number;
    userId?: string;
    riderId?: string | null;
    requiresManualReview?: boolean;
    createdAt: string;
    updatedAt?: string;
}
