export interface IUser {
  _id: string;
  phone: string;
  name: string;
  email: string;
  role: 'customer' | 'rider' | 'admin';
  addresses: IAddress[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAddress {
  label: string;
  street: string;
  city: string;
  postalCode: string;
  coordinates: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface ICreateUser {
  phone: string;
  name: string;
  email: string;
  role?: 'customer' | 'rider' | 'admin';
}

export interface IUpdateUser {
  name?: string;
  email?: string;
  role?: 'customer' | 'rider' | 'admin';
}

export interface IAddAddress {
  label: string;
  street: string;
  city: string;
  postalCode: string;
  longitude: number;
  latitude: number;
}

export interface IUpdateAddress {
  label?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  longitude?: number;
  latitude?: number;
}
