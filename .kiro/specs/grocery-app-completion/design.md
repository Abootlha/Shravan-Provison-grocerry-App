# Grocery Application - Completion Design

## 0. Category Hierarchy Enforcement

### 0.1 Overview
The application uses a 4-level product organization hierarchy:
**Category → Subcategory → Item Group → Product**

Currently, products can be added with only a category selection, bypassing the proper hierarchy. This design enforces the complete hierarchy flow.

### 0.2 Data Model Relationships

```typescript
// Category (Level 1)
{
  _id: ObjectId,
  name: String,
  icon: String,
  color: String,
  type: 'beverage' | 'non-beverage',
  isActive: Boolean
}

// Subcategory (Level 2)
{
  _id: ObjectId,
  name: String,
  icon: String,
  color: String,
  type: 'subcategory',
  parentId: ObjectId (ref: Category),  // Required
  isActive: Boolean
}

// Item Group (Level 3)
{
  _id: ObjectId,
  name: String,
  subcategoryId: ObjectId (ref: Category where type='subcategory'),  // Required
  image: String,
  description: String,
  isActive: Boolean
}

// Product (Level 4) - UPDATED
{
  _id: ObjectId,
  name: String,
  categoryId: ObjectId (ref: Category),        // Required
  subcategoryId: ObjectId (ref: Category),     // Required - NEW
  itemGroupId: ObjectId (ref: ItemGroup),      // Required - NEW
  price: Number,
  stock: Number,
  // ... other fields
}
```

### 0.3 Backend Changes

#### Product Schema Update
```typescript
// backend/src/modules/products/schemas/product.schema.ts
@Schema()
export class Product {
  // ... existing fields
  
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;
  
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })  // NEW
  subcategoryId: Types.ObjectId;
  
  @Prop({ type: Types.ObjectId, ref: 'ItemGroup', required: true })  // NEW
  itemGroupId: Types.ObjectId;
}
```

#### Validation Middleware
```typescript
// backend/src/modules/products/dto/create-product.dto.ts
export class CreateProductDto {
  @IsNotEmpty()
  @IsMongoId()
  categoryId: string;
  
  @IsNotEmpty()
  @IsMongoId()
  subcategoryId: string;
  
  @IsNotEmpty()
  @IsMongoId()
  itemGroupId: string;
  
  // Validate hierarchy integrity
  @ValidateHierarchy()  // Custom validator
  hierarchy: { categoryId, subcategoryId, itemGroupId };
}
```

#### Custom Validator
```typescript
// backend/src/modules/products/validators/hierarchy.validator.ts
@ValidatorConstraint({ async: true })
export class HierarchyValidator implements ValidatorConstraintInterface {
  async validate(value: any, args: ValidationArguments) {
    const { categoryId, subcategoryId, itemGroupId } = value;
    
    // 1. Verify subcategory belongs to category
    const subcategory = await Category.findById(subcategoryId);
    if (!subcategory || subcategory.parentId.toString() !== categoryId) {
      return false;
    }
    
    // 2. Verify item group belongs to subcategory
    const itemGroup = await ItemGroup.findById(itemGroupId);
    if (!itemGroup || itemGroup.subcategoryId.toString() !== subcategoryId) {
      return false;
    }
    
    return true;
  }
  
  defaultMessage() {
    return 'Invalid category hierarchy. Please ensure subcategory belongs to category and item group belongs to subcategory.';
  }
}
```

#### API Endpoints Update
```
GET    /api/categories/:categoryId/subcategories     # Get subcategories for a category
GET    /api/subcategories/:subcategoryId/item-groups # Get item groups for a subcategory
POST   /api/products                                  # Create product (now requires all 3 IDs)
PUT    /api/products/:id                              # Update product (validate hierarchy)
```

### 0.4 Admin Panel Changes

#### Cascading Dropdown Component
```typescript
// admin/src/components/ProductsManager.tsx - Updated Form

const [form, setForm] = useState({
  // ... existing fields
  categoryId: '',
  subcategoryId: '',      // NEW
  itemGroupId: '',        // NEW
});

const [availableSubcategories, setAvailableSubcategories] = useState([]);
const [availableItemGroups, setAvailableItemGroups] = useState([]);

// Fetch subcategories when category changes
useEffect(() => {
  if (form.categoryId) {
    api.getSubcategories(form.categoryId).then(data => {
      setAvailableSubcategories(data.subcategories);
      setForm(prev => ({ ...prev, subcategoryId: '', itemGroupId: '' }));
    });
  } else {
    setAvailableSubcategories([]);
    setAvailableItemGroups([]);
  }
}, [form.categoryId]);

// Fetch item groups when subcategory changes
useEffect(() => {
  if (form.subcategoryId) {
    api.getItemGroups(form.subcategoryId).then(data => {
      setAvailableItemGroups(data.itemGroups);
      setForm(prev => ({ ...prev, itemGroupId: '' }));
    });
  } else {
    setAvailableItemGroups([]);
  }
}, [form.subcategoryId]);
```

#### Form UI
```tsx
<div className="grid grid-cols-3 gap-4">
  {/* Category Dropdown */}
  <div>
    <label>Category *</label>
    <select
      value={form.categoryId}
      onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
      required
    >
      <option value="">Select Category</option>
      {categories.map(cat => (
        <option key={cat._id} value={cat._id}>{cat.name}</option>
      ))}
    </select>
  </div>
  
  {/* Subcategory Dropdown - Disabled until category selected */}
  <div>
    <label>Subcategory *</label>
    <select
      value={form.subcategoryId}
      onChange={(e) => setForm({ ...form, subcategoryId: e.target.value })}
      disabled={!form.categoryId}
      required
    >
      <option value="">Select Subcategory</option>
      {availableSubcategories.map(sub => (
        <option key={sub._id} value={sub._id}>{sub.name}</option>
      ))}
    </select>
    {!form.categoryId && (
      <p className="text-xs text-muted">Select a category first</p>
    )}
  </div>
  
  {/* Item Group Dropdown - Disabled until subcategory selected */}
  <div>
    <label>Item Group *</label>
    <select
      value={form.itemGroupId}
      onChange={(e) => setForm({ ...form, itemGroupId: e.target.value })}
      disabled={!form.subcategoryId}
      required
    >
      <option value="">Select Item Group</option>
      {availableItemGroups.map(ig => (
        <option key={ig._id} value={ig._id}>{ig.name}</option>
      ))}
    </select>
    {!form.subcategoryId && (
      <p className="text-xs text-muted">Select a subcategory first</p>
    )}
  </div>
</div>

{/* Hierarchy Breadcrumb Display */}
{form.categoryId && (
  <div className="flex items-center gap-2 text-sm text-muted">
    <span>{getCategoryName(form.categoryId)}</span>
    {form.subcategoryId && (
      <>
        <ChevronRight className="w-4 h-4" />
        <span>{getSubcategoryName(form.subcategoryId)}</span>
      </>
    )}
    {form.itemGroupId && (
      <>
        <ChevronRight className="w-4 h-4" />
        <span>{getItemGroupName(form.itemGroupId)}</span>
      </>
    )}
  </div>
)}
```

#### Product List Display
```tsx
// Show hierarchy path in product table
<td>
  <div className="flex flex-col gap-1">
    <span className="text-xs text-muted">
      {product.categoryId.name} → {product.subcategoryId.name} → {product.itemGroupId.name}
    </span>
  </div>
</td>
```

### 0.5 Mobile App Changes

#### Category Navigation Flow
```typescript
// src/screens/CategoriesScreen.js
// Show main categories
<FlatList
  data={categories}
  renderItem={({ item }) => (
    <CategoryCard
      category={item}
      onPress={() => navigation.navigate('Subcategories', { categoryId: item._id })}
    />
  )}
/>

// src/screens/SubcategoriesScreen.js (NEW)
// Show subcategories for selected category
<FlatList
  data={subcategories}
  renderItem={({ item }) => (
    <SubcategoryCard
      subcategory={item}
      onPress={() => navigation.navigate('ItemGroups', { subcategoryId: item._id })}
    />
  )}
/>

// src/screens/ItemGroupsScreen.js (NEW)
// Show item groups for selected subcategory
<FlatList
  data={itemGroups}
  renderItem={({ item }) => (
    <ItemGroupCard
      itemGroup={item}
      onPress={() => navigation.navigate('Products', { itemGroupId: item._id })}
    />
  )}
/>

// src/screens/ProductsScreen.js (UPDATED)
// Show products for selected item group
<FlatList
  data={products}
  renderItem={({ item }) => <ProductCard product={item} />}
/>
```

#### Breadcrumb Navigation
```tsx
// src/components/HierarchyBreadcrumb.js
export const HierarchyBreadcrumb = ({ category, subcategory, itemGroup }) => (
  <View style={styles.breadcrumb}>
    <TouchableOpacity onPress={() => navigation.navigate('Categories')}>
      <Text>{category?.name}</Text>
    </TouchableOpacity>
    {subcategory && (
      <>
        <ChevronRight />
        <TouchableOpacity onPress={() => navigation.navigate('Subcategories', { categoryId: category._id })}>
          <Text>{subcategory.name}</Text>
        </TouchableOpacity>
      </>
    )}
    {itemGroup && (
      <>
        <ChevronRight />
        <Text style={styles.current}>{itemGroup.name}</Text>
      </>
    )}
  </View>
);
```

### 0.6 Migration Strategy

#### Data Migration Script
```typescript
// backend/src/scripts/migrate-product-hierarchy.ts
async function migrateProducts() {
  const products = await Product.find({ 
    $or: [
      { subcategoryId: { $exists: false } },
      { itemGroupId: { $exists: false } }
    ]
  });
  
  console.log(`Found ${products.length} products to migrate`);
  
  for (const product of products) {
    // Strategy 1: Try to infer from existing data
    // Strategy 2: Assign to default "Uncategorized" item group
    // Strategy 3: Flag for manual review
    
    const category = await Category.findById(product.categoryId);
    if (!category) continue;
    
    // Find or create default subcategory
    let subcategory = await Category.findOne({
      type: 'subcategory',
      parentId: category._id,
      name: 'Other'
    });
    
    if (!subcategory) {
      subcategory = await Category.create({
        name: 'Other',
        type: 'subcategory',
        parentId: category._id,
        icon: 'noto:package',
        color: '#666666',
        isActive: true
      });
    }
    
    // Find or create default item group
    let itemGroup = await ItemGroup.findOne({
      subcategoryId: subcategory._id,
      name: 'General'
    });
    
    if (!itemGroup) {
      itemGroup = await ItemGroup.create({
        name: 'General',
        subcategoryId: subcategory._id,
        isActive: true
      });
    }
    
    // Update product
    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          subcategoryId: subcategory._id,
          itemGroupId: itemGroup._id
        }
      }
    );
    
    console.log(`Migrated product: ${product.name}`);
  }
}
```

### 0.7 Testing Strategy

#### Unit Tests
```typescript
describe('Product Hierarchy Validation', () => {
  it('should reject product without subcategory', async () => {
    const product = { categoryId: 'xxx', itemGroupId: 'yyy' };
    await expect(createProduct(product)).rejects.toThrow();
  });
  
  it('should reject product with invalid hierarchy', async () => {
    // Subcategory doesn't belong to category
    const product = { 
      categoryId: 'cat1', 
      subcategoryId: 'sub2',  // belongs to cat2
      itemGroupId: 'ig1' 
    };
    await expect(createProduct(product)).rejects.toThrow('Invalid category hierarchy');
  });
  
  it('should accept product with valid hierarchy', async () => {
    const product = { 
      categoryId: 'cat1', 
      subcategoryId: 'sub1',  // belongs to cat1
      itemGroupId: 'ig1'      // belongs to sub1
    };
    await expect(createProduct(product)).resolves.toBeDefined();
  });
});
```

#### Integration Tests
```typescript
describe('Cascading Dropdowns', () => {
  it('should load subcategories when category is selected', async () => {
    render(<ProductForm />);
    
    const categorySelect = screen.getByLabelText('Category');
    fireEvent.change(categorySelect, { target: { value: 'cat1' } });
    
    await waitFor(() => {
      expect(screen.getByLabelText('Subcategory')).not.toBeDisabled();
      expect(screen.getAllByRole('option', { name: /sub/i })).toHaveLength(3);
    });
  });
  
  it('should reset subcategory and item group when category changes', async () => {
    render(<ProductForm />);
    
    // Select full hierarchy
    selectCategory('cat1');
    selectSubcategory('sub1');
    selectItemGroup('ig1');
    
    // Change category
    selectCategory('cat2');
    
    // Verify reset
    expect(screen.getByLabelText('Subcategory')).toHaveValue('');
    expect(screen.getByLabelText('Item Group')).toHaveValue('');
  });
});
```

---

## 1. Architecture Overview

### System Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Mobile App     │────▶│   NestJS API     │────▶│   MongoDB       │
│  (React Native) │     │   (Backend)      │     │   (Database)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ├──────▶ Redis (Cache/PubSub)
                               ├──────▶ Payment Gateway (Razorpay)
                               ├──────▶ Cloud Storage (S3/Cloudinary)
                               ├──────▶ FCM (Push Notifications)
                               └──────▶ Email Service (SendGrid)

┌─────────────────┐
│  Admin Panel    │────▶ Same NestJS API
│  (Astro+React)  │
└─────────────────┘
```

### Technology Stack
- **Backend**: NestJS, TypeScript, MongoDB, Redis, Socket.io
- **Mobile**: React Native, Expo, Redux Toolkit
- **Admin**: Astro, React, TypeScript
- **Infrastructure**: AWS S3, Firebase, Razorpay, SendGrid

---

## 2. Phase 1: Payment Integration

### 2.1 Payment Gateway Architecture

#### Components
1. **Payment Module** (Backend)
   - Payment service
   - Payment controller
   - Payment schema
   - Webhook handler

2. **Payment Methods**
   - UPI
   - Credit/Debit Card
   - Wallets (Paytm, PhonePe)
   - Cash on Delivery (COD)

#### Data Models

**Payment Schema**
```typescript
{
  _id: ObjectId,
  orderId: ObjectId (ref: Order),
  userId: ObjectId (ref: User),
  amount: Number,
  currency: String (default: 'INR'),
  method: Enum ['UPI', 'CARD', 'WALLET', 'COD'],
  status: Enum ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED'],
  gatewayOrderId: String,
  gatewayPaymentId: String,
  gatewaySignature: String,
  metadata: Object,
  failureReason: String,
  refundId: String,
  refundAmount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

#### API Endpoints

```
POST   /api/payments/create-order          # Create payment order
POST   /api/payments/verify                # Verify payment
POST   /api/payments/webhook               # Payment gateway webhook
GET    /api/payments/:orderId              # Get payment details
POST   /api/payments/:paymentId/refund     # Initiate refund
```

#### Payment Flow
1. User places order → Order created with status PENDING
2. Frontend calls `/payments/create-order` with orderId
3. Backend creates Razorpay order, returns order details
4. Frontend opens Razorpay checkout
5. User completes payment
6. Frontend calls `/payments/verify` with payment details
7. Backend verifies signature, updates order status
8. Webhook receives confirmation (backup verification)

---

## 3. Phase 1: Notifications System

### 3.1 Notification Architecture

#### Components
1. **Notification Module** (Backend)
   - Notification service
   - FCM service
   - Email service
   - SMS service (already exists for OTP)
   - Notification templates

2. **Notification Types**
   - Order status updates
   - Promotional offers
   - Low stock alerts (admin)
   - Payment confirmations
   - Delivery updates

#### Data Models

**Notification Schema**
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  type: Enum ['ORDER', 'PROMO', 'ALERT', 'PAYMENT', 'DELIVERY'],
  title: String,
  body: String,
  data: Object,
  channels: Array ['PUSH', 'EMAIL', 'SMS'],
  status: Enum ['PENDING', 'SENT', 'FAILED', 'READ'],
  sentAt: Date,
  readAt: Date,
  createdAt: Date
}
```

**User Device Token Schema**
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  deviceToken: String,
  platform: Enum ['IOS', 'ANDROID', 'WEB'],
  isActive: Boolean,
  lastUsed: Date,
  createdAt: Date
}
```

#### API Endpoints
```
POST   /api/notifications/register-device   # Register FCM token
GET    /api/notifications                   # Get user notifications
PATCH  /api/notifications/:id/read          # Mark as read
POST   /api/notifications/send              # Send notification (admin)
```

#### Notification Templates

```typescript
// Order Status Templates
ORDER_PLACED: {
  title: "Order Placed Successfully!",
  body: "Your order #{orderId} has been placed. Total: ₹{amount}"
}

ORDER_CONFIRMED: {
  title: "Order Confirmed",
  body: "Your order #{orderId} is confirmed and being prepared"
}

ORDER_OUT_FOR_DELIVERY: {
  title: "Out for Delivery",
  body: "Your order #{orderId} is on the way! Expected by {time}"
}

ORDER_DELIVERED: {
  title: "Order Delivered",
  body: "Your order #{orderId} has been delivered. Enjoy!"
}
```

---

## 4. Phase 1: Enhanced Search & Filters

### 4.1 Search Architecture

#### Components
1. **Search Service** (Backend)
   - Full-text search using MongoDB text indexes
   - Fuzzy matching
   - Search suggestions
   - Recent searches tracking

2. **Filter System**
   - Price range
   - Categories/Subcategories
   - Brands
   - Dietary preferences
   - In stock only
   - Ratings

#### Data Models

**Search History Schema**
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  query: String,
  resultCount: Number,
  clickedProductId: ObjectId,
  createdAt: Date
}
```

**Product Index Enhancement**
```typescript
// Add to Product schema
{
  searchKeywords: [String],  // Auto-generated from name, brand, category
  popularity: Number,         // Based on views, orders
  trendingScore: Number,      // Time-weighted popularity
}
```

#### API Endpoints
```
GET    /api/search/products                 # Search products
GET    /api/search/suggestions              # Get search suggestions
GET    /api/search/recent                   # Get recent searches
DELETE /api/search/recent/:id               # Delete search history
GET    /api/products/filters                # Get available filters
```

#### Search Algorithm
1. **Text Search**: MongoDB $text with weights
2. **Fuzzy Matching**: Levenshtein distance for typos
3. **Ranking**: Combine relevance + popularity + availability
4. **Filters**: Applied after search, with faceted counts

---

## 5. Phase 1: Reviews & Ratings

### 5.1 Review System Architecture

#### Components
1. **Review Module** (Backend)
   - Review service
   - Review controller
   - Review moderation
   - Rating aggregation

#### Data Models

**Review Schema**
```typescript
{
  _id: ObjectId,
  productId: ObjectId (ref: Product),
  userId: ObjectId (ref: User),
  orderId: ObjectId (ref: Order),
  rating: Number (1-5),
  title: String,
  comment: String,
  images: [String],
  isVerifiedPurchase: Boolean,
  helpfulCount: Number,
  reportCount: Number,
  status: Enum ['PENDING', 'APPROVED', 'REJECTED'],
  moderatedBy: ObjectId (ref: User),
  moderatedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Review Vote Schema**
```typescript
{
  _id: ObjectId,
  reviewId: ObjectId (ref: Review),
  userId: ObjectId (ref: User),
  voteType: Enum ['HELPFUL', 'REPORT'],
  createdAt: Date
}
```

**Product Rating Aggregate** (embedded in Product)
```typescript
{
  averageRating: Number,
  totalReviews: Number,
  ratingDistribution: {
    5: Number,
    4: Number,
    3: Number,
    2: Number,
    1: Number
  }
}
```

#### API Endpoints
```
POST   /api/reviews                         # Create review
GET    /api/reviews/product/:productId      # Get product reviews
PATCH  /api/reviews/:id                     # Update review
DELETE /api/reviews/:id                     # Delete review
POST   /api/reviews/:id/helpful             # Mark helpful
POST   /api/reviews/:id/report              # Report review
GET    /api/admin/reviews/pending           # Get pending reviews (admin)
PATCH  /api/admin/reviews/:id/moderate      # Moderate review (admin)
```

#### Review Rules
- Only verified purchasers can review
- One review per product per user
- Reviews can be edited within 30 days
- Admin moderation for reported reviews
- Auto-approve reviews with rating ≥ 4 and no profanity

---

## 6. Phase 2: Promotions & Discounts

### 6.1 Promotion System Architecture

#### Components
1. **Promotion Module** (Backend)
   - Coupon service
   - Discount calculator
   - Promotion validator
   - Usage tracker

#### Data Models

**Coupon Schema**
```typescript
{
  _id: ObjectId,
  code: String (unique, uppercase),
  type: Enum ['PERCENTAGE', 'FLAT', 'BOGO', 'FREE_DELIVERY'],
  value: Number,
  description: String,
  
  // Conditions
  minOrderValue: Number,
  maxDiscount: Number,
  applicableCategories: [ObjectId],
  applicableProducts: [ObjectId],
  excludedProducts: [ObjectId],
  
  // Usage limits
  usageLimit: Number,
  usagePerUser: Number,
  usedCount: Number,
  
  // User restrictions
  newUsersOnly: Boolean,
  applicableUsers: [ObjectId],
  
  // Validity
  startDate: Date,
  endDate: Date,
  isActive: Boolean,
  
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

**Coupon Usage Schema**
```typescript
{
  _id: ObjectId,
  couponId: ObjectId (ref: Coupon),
  userId: ObjectId (ref: User),
  orderId: ObjectId (ref: Order),
  discountAmount: Number,
  usedAt: Date
}
```

#### API Endpoints
```
POST   /api/coupons/validate                # Validate coupon
POST   /api/coupons/apply                   # Apply coupon to cart
GET    /api/coupons/available               # Get available coupons
POST   /api/admin/coupons                   # Create coupon (admin)
GET    /api/admin/coupons                   # List coupons (admin)
PATCH  /api/admin/coupons/:id               # Update coupon (admin)
DELETE /api/admin/coupons/:id               # Delete coupon (admin)
GET    /api/admin/coupons/:id/usage         # Get usage stats (admin)
```

#### Discount Calculation Flow
1. User enters coupon code
2. Validate coupon (active, not expired, usage limits)
3. Check user eligibility
4. Calculate cart total
5. Check min order value
6. Apply discount (respect max discount)
7. Return breakdown: subtotal, discount, delivery, total

---

## 7. Phase 2: Wishlist

### 7.1 Wishlist Architecture

#### Data Models

**Wishlist Schema**
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  items: [{
    productId: ObjectId (ref: Product),
    addedAt: Date,
    notifyOnDiscount: Boolean,
    notifyOnStock: Boolean
  }],
  updatedAt: Date
}
```

#### API Endpoints
```
GET    /api/wishlist                        # Get user wishlist
POST   /api/wishlist/add                    # Add to wishlist
DELETE /api/wishlist/remove/:productId      # Remove from wishlist
POST   /api/wishlist/move-to-cart           # Move items to cart
PATCH  /api/wishlist/:productId/notify      # Update notification prefs
```

---

## 8. Phase 3: Delivery Management

### 8.1 Delivery System Architecture

#### Components
1. **Delivery Module** (Backend)
   - Delivery partner management
   - Order assignment
   - Route optimization
   - Real-time tracking

#### Data Models

**Delivery Partner Schema**
```typescript
{
  _id: ObjectId,
  name: String,
  phone: String,
  email: String,
  vehicleType: Enum ['BIKE', 'SCOOTER', 'CAR'],
  vehicleNumber: String,
  status: Enum ['AVAILABLE', 'BUSY', 'OFFLINE'],
  currentLocation: {
    type: 'Point',
    coordinates: [Number, Number]
  },
  rating: Number,
  totalDeliveries: Number,
  isActive: Boolean,
  createdAt: Date
}
```

**Delivery Schema**
```typescript
{
  _id: ObjectId,
  orderId: ObjectId (ref: Order),
  partnerId: ObjectId (ref: DeliveryPartner),
  
  pickupLocation: {
    address: String,
    coordinates: [Number, Number]
  },
  
  deliveryLocation: {
    address: String,
    coordinates: [Number, Number]
  },
  
  status: Enum ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED'],
  
  estimatedTime: Date,
  actualPickupTime: Date,
  actualDeliveryTime: Date,
  
  distance: Number,
  route: [[Number, Number]],
  
  deliveryProof: {
    image: String,
    signature: String,
    otp: String
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

#### API Endpoints
```
POST   /api/delivery/assign                 # Auto-assign delivery partner
GET    /api/delivery/:orderId/track         # Track delivery
PATCH  /api/delivery/:id/status             # Update delivery status
POST   /api/delivery/:id/proof              # Upload delivery proof

# Delivery Partner App APIs
POST   /api/delivery-partner/login          # Partner login
GET    /api/delivery-partner/orders         # Get assigned orders
PATCH  /api/delivery-partner/location       # Update location
PATCH  /api/delivery-partner/status         # Update availability
```

---

## 9. Database Indexes

### Critical Indexes
```typescript
// Products
db.products.createIndex({ name: "text", brand: "text" })
db.products.createIndex({ categoryId: 1, isAvailable: 1 })
db.products.createIndex({ "averageRating": -1 })
db.products.createIndex({ popularity: -1 })

// Orders
db.orders.createIndex({ userId: 1, createdAt: -1 })
db.orders.createIndex({ orderStatus: 1, createdAt: -1 })
db.orders.createIndex({ orderId: 1 }, { unique: true })

// Reviews
db.reviews.createIndex({ productId: 1, status: 1, createdAt: -1 })
db.reviews.createIndex({ userId: 1, productId: 1 }, { unique: true })

// Payments
db.payments.createIndex({ orderId: 1 })
db.payments.createIndex({ gatewayOrderId: 1 })

// Notifications
db.notifications.createIndex({ userId: 1, createdAt: -1 })
db.notifications.createIndex({ status: 1, createdAt: 1 })

// Delivery
db.deliveries.createIndex({ orderId: 1 })
db.deliveries.createIndex({ partnerId: 1, status: 1 })
db.deliveryPartners.createIndex({ currentLocation: "2dsphere" })
```

---

## 10. Security Considerations

### Authentication & Authorization
- JWT tokens with short expiry (15 min)
- Refresh tokens with rotation
- Role-based access control (Customer, Admin, DeliveryPartner)
- API rate limiting per user

### Payment Security
- Never store card details
- Use Razorpay's PCI-compliant checkout
- Verify webhook signatures
- Log all payment attempts

### Data Protection
- Encrypt sensitive data at rest
- Use HTTPS for all communications
- Sanitize user inputs
- Implement CORS properly
- Hide stack traces in production

---

## 11. Performance Optimization

### Caching Strategy
```typescript
// Redis caching
- Product catalog: 1 hour TTL
- Categories: 24 hours TTL
- User cart: Session-based
- Search results: 15 minutes TTL
- Promotional banners: 1 hour TTL
```

### Database Optimization
- Use projection to fetch only required fields
- Implement pagination everywhere
- Use aggregation pipelines for analytics
- Denormalize frequently accessed data

### Mobile App Optimization
- Image lazy loading
- Infinite scroll for lists
- Debounce search inputs
- Cache API responses
- Optimize bundle size

---

## 12. Monitoring & Logging

### Metrics to Track
- API response times
- Error rates
- Payment success rate
- Order completion rate
- User engagement metrics
- Server resource usage

### Logging Strategy
- Structured logging with Pino
- Log levels: ERROR, WARN, INFO, DEBUG
- Centralized log aggregation
- Alert on critical errors
- Track user actions for analytics

---

## 13. Testing Strategy

### Backend Testing
- Unit tests for services (Jest)
- Integration tests for APIs (Supertest)
- E2E tests for critical flows
- Load testing for scalability

### Mobile Testing
- Component tests (Jest + React Native Testing Library)
- E2E tests (Detox)
- Manual testing on real devices

### Admin Testing
- Component tests (Vitest)
- E2E tests (Playwright)
- Cross-browser testing

---

## 14. Deployment Strategy

### Environments
- **Development**: Local development
- **Staging**: Pre-production testing
- **Production**: Live environment

### CI/CD Pipeline
1. Code push to Git
2. Run linting and tests
3. Build Docker images
4. Deploy to staging
5. Run smoke tests
6. Manual approval
7. Deploy to production
8. Health checks

### Rollback Plan
- Keep previous 3 versions
- Feature flags for new features
- Database migration rollback scripts
- Quick rollback procedure documented

---

## 15. Mobile App Enhancements

### Offline Support
- Cache product catalog
- Offline cart management
- Queue orders when offline
- Sync when connection restored

### Push Notification Handling
- Request permission on first launch
- Handle notification taps
- Deep linking to order details
- Badge count for unread notifications

### Performance
- Code splitting
- Image optimization
- Reduce bundle size
- Lazy load screens

---

## 16. Admin Panel Enhancements

### New Features
- Bulk product upload (CSV)
- Advanced analytics dashboard
- Customer management
- Delivery partner management
- Coupon management
- Review moderation
- Real-time order monitoring

### UI Improvements
- Toast notifications
- Confirmation dialogs
- Better error handling
- Loading states
- Keyboard shortcuts

---

This design document provides the technical architecture and implementation details for completing the grocery application. Each phase builds upon the existing foundation while maintaining code quality and scalability.
