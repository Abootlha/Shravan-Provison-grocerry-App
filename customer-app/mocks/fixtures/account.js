import { oid, KIND } from './ids';

// GET /settings/store shape (settings.controller.ts).
export const storeSettings = {
    storeName: 'Shravan Kirana',
    location: {
        latitude: 26.6965,
        longitude: 83.4627,
        address: 'Shravan Kirana, Kauriram Road, Gorakhpur, Uttar Pradesh 273016',
    },
    storeTimings: { openTime: '07:00', closeTime: '23:00' },
    contactPhone: '+919876543210',
    serviceRadiusKm: 12,
    estimatedDeliveryMinutes: 10,
    // settings/fees.ts (resolveFees defaults)
    fees: { deliveryFee: 25, freeDeliveryThreshold: 200, packagingFee: 5, discountRate: 0.05 },
    isActive: true,
    // Computed by the backend from storeTimings; the mock store is always open
    // (preview the closed states with ?store=closed, see hooks/useStoreSettings.js).
    isOpen: true,
    nextOpenAt: null,
};

export const MOCK_USER_ID = oid(KIND.user, 1);

// Address subdocuments (users/schemas/user.schema.ts Address).
export const addresses = [
    {
        _id: oid(KIND.address, 1),
        type: 'Home',
        houseNo: 'H.No. 214',
        landmark: 'Hanuman Mandir',
        receiverName: 'Aarav Mishra',
        receiverPhone: '9876501234',
        address: 'Gali No. 3, Shivpuri Colony, Rapti Nagar',
        city: 'Gorakhpur',
        pincode: '273016',
        isDefault: true,
        latitude: 26.7084,
        longitude: 83.4496,
    },
    {
        _id: oid(KIND.address, 2),
        type: 'Work',
        floor: '2',
        address: 'Shubham Complex, Gorakhnath Road, Opp. Union Bank',
        city: 'Gorakhpur',
        pincode: '273015',
        isDefault: false,
        latitude: 26.6878,
        longitude: 83.4772,
    },
];

// Fields returned by GET /users/me (users.controller.ts).
export const user = {
    id: MOCK_USER_ID,
    name: 'Aarav Mishra',
    phone: '9876501234',
    email: 'aarav.mishra@example.com',
    profilePicture: null,
    role: 'customer',
};

// Populated order.riderId (riders schema subset used by buildRealtimeOrderPayload).
export const rider = {
    _id: oid(KIND.rider, 1),
    name: 'Ravi Yadav',
    phone: '+919812345678',
    vehicleType: 'bike',
    vehicleNumber: 'UP 53 DK 4821',
    rating: 4.8,
    totalDeliveries: 1263,
    status: 'busy',
};
