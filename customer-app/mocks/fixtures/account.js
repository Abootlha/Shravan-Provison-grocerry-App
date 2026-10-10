import { oid, KIND } from './ids';

// GET /settings/store shape (settings.controller.ts).
export const storeSettings = {
    storeName: 'Shravan Provision Store',
    location: {
        latitude: 26.6965,
        longitude: 83.4627,
        address: 'Shravan Provision Store, Kauriram Road, Gorakhpur, Uttar Pradesh 273016',
    },
    storeTimings: { openTime: '07:00', closeTime: '23:00' },
    contactPhone: '+919876543210',
    serviceRadiusKm: 12,
    estimatedDeliveryMinutes: 10,
    isActive: true,
};

export const MOCK_USER_ID = oid(KIND.user, 1);

// Address subdocuments (users/schemas/user.schema.ts Address).
export const addresses = [
    {
        type: 'Home',
        address: 'H.No. 214, Gali No. 3, Shivpuri Colony, Near Hanuman Mandir, Rapti Nagar',
        city: 'Gorakhpur',
        pincode: '273016',
        isDefault: true,
        latitude: 26.7084,
        longitude: 83.4496,
    },
    {
        type: 'Work',
        address: '2nd Floor, Shubham Complex, Gorakhnath Road, Opp. Union Bank',
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
