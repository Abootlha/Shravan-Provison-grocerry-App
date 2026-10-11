// Test-only helper: a tiny in-memory stand-in for a Mongoose model that
// understands the conditional updates the orders code relies on
// (findOneAndUpdate with status filters, $inc/$set/$push, select:false fields).
// Only imported from *.spec.ts files.
import { Types } from 'mongoose';

type Doc = Record<string, any>;

// Runs fn and settles a promise with its result, rejecting if it throws
// (same semantics as an async function with no awaits).
const settle = <T>(fn: () => T): Promise<Awaited<T>> =>
  new Promise((resolve) => resolve(fn() as Awaited<T>));

const idOf = (value: any): string =>
  value === null || value === undefined ? String(value) : String(value);

function valueMatches(actual: any, condition: any): boolean {
  if (
    condition !== null &&
    typeof condition === 'object' &&
    !(condition instanceof Types.ObjectId) &&
    !(condition instanceof Date) &&
    Object.keys(condition).some((k) => k.startsWith('$'))
  ) {
    return Object.entries(condition).every(([op, operand]) => {
      switch (op) {
        case '$ne':
          return !valueMatches(actual, operand);
        case '$lt':
          return actual !== undefined && actual < (operand as any);
        case '$gte':
          return actual !== undefined && actual >= (operand as any);
        case '$exists':
          return operand ? actual !== undefined : actual === undefined;
        case '$in':
          return (operand as any[]).some((v) => valueMatches(actual, v));
        case '$nin':
          return !(operand as any[]).some((v) => valueMatches(actual, v));
        default:
          // Geo and other operators are not simulated: treat as match.
          return true;
      }
    });
  }
  if (condition === null) {
    return actual === null || actual === undefined;
  }
  if (actual === undefined || actual === null) return false;
  return idOf(actual) === idOf(condition);
}

export function docMatches(doc: Doc, filter: Doc = {}): boolean {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === '$or') {
      return (condition as Doc[]).some((sub) => docMatches(doc, sub));
    }
    return valueMatches(doc[key], condition);
  });
}

function applyUpdate(doc: Doc, update: Doc): void {
  const hasOperators = Object.keys(update).some((k) => k.startsWith('$'));
  if (!hasOperators) {
    Object.assign(doc, update);
    return;
  }
  for (const [key, value] of Object.entries(update.$set || {})) {
    doc[key] = value;
  }
  for (const [key, value] of Object.entries(update.$inc || {})) {
    doc[key] = (doc[key] || 0) + (value as number);
  }
  for (const [key, value] of Object.entries(update.$push || {})) {
    doc[key] = [...(doc[key] || []), value];
  }
  for (const key of Object.keys(update.$unset || {})) {
    delete doc[key];
  }
}

export interface FakeModelOptions {
  hiddenFields?: string[];
}

export function createFakeModel(options: FakeModelOptions = {}) {
  const hiddenFields = options.hiddenFields || [];
  const store = new Map<string, Doc>();

  const project = (doc: Doc | undefined, selected: string[]): Doc | null => {
    if (!doc) return null;
    const copy: Doc = { ...doc };
    for (const field of hiddenFields) {
      if (!selected.includes(`+${field}`)) delete copy[field];
    }
    return copy;
  };

  const withSave = (doc: Doc | null): Doc | null => {
    if (!doc) return null;
    return Object.assign(doc, {
      save: jest.fn(() =>
        settle(() => {
          const data: Doc = { ...doc };
          delete data.save;
          store.set(idOf(data._id), { ...store.get(idOf(data._id)), ...data });
          return doc;
        }),
      ),
    });
  };

  const query = (resolve: (selected: string[]) => any) => {
    const selected: string[] = [];
    let lean = false;
    const q: any = {
      select: (spec: string) => {
        if (typeof spec === 'string') selected.push(...spec.split(/\s+/));
        return q;
      },
      populate: () => q,
      sort: () => q,
      skip: () => q,
      limit: () => q,
      lean: () => {
        lean = true;
        return q;
      },
      exec: () =>
        settle(() => {
          const result = resolve(selected);
          if (lean || result === null || Array.isArray(result)) return result;
          return withSave(result);
        }),
      then: (onFulfilled: any, onRejected: any) =>
        q.exec().then(onFulfilled, onRejected),
    };
    return q;
  };

  const findFirst = (filter: Doc) =>
    [...store.values()].find((doc) => docMatches(doc, filter));

  const model: any = jest.fn().mockImplementation((data: Doc) => {
    const doc: Doc = { _id: new Types.ObjectId(), ...data };
    doc.save = jest.fn(() =>
      settle(() => {
        const rest: Doc = { ...doc };
        delete rest.save;
        store.set(idOf(doc._id), rest);
        return doc;
      }),
    );
    return doc;
  });

  model.store = store;
  model.insert = (data: Doc): Doc => {
    const doc = { _id: new Types.ObjectId(), ...data };
    store.set(idOf(doc._id), doc);
    return doc;
  };
  model.get = (id: any): Doc | undefined => store.get(idOf(id));

  model.findById = jest.fn((id: any) =>
    query((selected) => project(store.get(idOf(id)), selected)),
  );
  model.findOne = jest.fn((filter: Doc = {}) =>
    query((selected) => project(findFirst(filter), selected)),
  );
  model.find = jest.fn((filter: Doc = {}) =>
    query((selected) =>
      [...store.values()]
        .filter((doc) => docMatches(doc, filter))
        .map((doc) => project(doc, selected)),
    ),
  );
  model.countDocuments = jest.fn((filter: Doc = {}) =>
    settle(
      () => [...store.values()].filter((doc) => docMatches(doc, filter)).length,
    ),
  );
  model.exists = jest.fn((filter: Doc = {}) =>
    settle(() => (findFirst(filter) ? { _id: findFirst(filter)!._id } : null)),
  );
  model.findOneAndUpdate = jest.fn((filter: Doc, update: Doc, opts: Doc = {}) =>
    query((selected) => {
      const doc = findFirst(filter);
      if (!doc) return null;
      const before = { ...doc };
      applyUpdate(doc, update);
      return project(opts.new ? doc : before, selected);
    }),
  );
  model.updateOne = jest.fn((filter: Doc, update: Doc) => {
    const run = () =>
      settle(() => {
        const doc = findFirst(filter);
        if (!doc) return { matchedCount: 0, modifiedCount: 0 };
        applyUpdate(doc, update);
        return { matchedCount: 1, modifiedCount: 1 };
      });
    const q: any = {
      exec: run,
      then: (onFulfilled: any, onRejected: any) =>
        run().then(onFulfilled, onRejected),
    };
    return q;
  });

  return model;
}

export function buildOrderFixture(overrides: Doc = {}): Doc {
  return {
    orderId: `ORD-20260101-${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
    userId: new Types.ObjectId(),
    items: [
      { productId: new Types.ObjectId(), name: 'Milk', quantity: 2, price: 30 },
    ],
    itemTotal: 60,
    deliveryFee: 25,
    packagingFee: 5,
    discount: 3,
    totalAmount: 87,
    deliveryAddress: {
      type: 'home',
      address: '1 Test Street',
      city: 'Test City',
      pincode: '273001',
      coordinates: { type: 'Point', coordinates: [83.37, 26.75] },
    },
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    orderStatus: 'PENDING',
    timeline: [],
    deliveryOtp: '4321',
    deliveryOtpAttempts: 0,
    stockReleased: false,
    requiresManualReview: false,
    ...overrides,
  };
}

export const fakeStoreSettings = {
  storeName: 'Test Store',
  contactPhone: '9999999999',
  serviceRadiusKm: 5,
  location: { address: 'Store Road', latitude: 26.75, longitude: 83.37 },
};
