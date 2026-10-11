export interface CustomerAddress {
    type?: string;
    address: string;
    city?: string;
    pincode?: string;
    isDefault?: boolean;
    latitude?: number;
    longitude?: number;
}

export interface Customer {
    _id: string;
    name?: string;
    phone?: string;
    email?: string;
    profilePicture?: string;
    isActive: boolean;
    addresses?: CustomerAddress[];
    createdAt: string;
    updatedAt: string;
    orderCount: number;
    deliveredCount: number;
    totalSpent: number;
    lastOrderAt: string | null;
}

export interface CustomersResponse {
    customers: Customer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface CustomerOrder {
    _id: string;
    orderId: string;
    orderStatus: string;
    paymentStatus: string;
    paymentMethod: string;
    totalAmount: number;
    itemCount: number;
    createdAt: string;
    deliveryAddress?: { address?: string; city?: string };
}

export interface CustomerDetailResponse {
    customer: Customer;
    addresses: CustomerAddress[];
    recentOrders: CustomerOrder[];
}

/** Sign-up leaves the name as "User" until the customer edits it; treat that as no name. */
export function customerName(c: Pick<Customer, 'name'>): string | null {
    const name = c.name?.trim();
    return name && name.toLowerCase() !== 'user' ? name : null;
}

export const SORTABLE = ['name', 'orderCount', 'totalSpent', 'lastOrderAt', 'createdAt'] as const;
