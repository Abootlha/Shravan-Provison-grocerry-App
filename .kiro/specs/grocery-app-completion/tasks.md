# Grocery Application - Implementation Tasks

## Phase 0: Category Hierarchy Enforcement (Critical Priority - 3-4 days)

### 0. Category Hierarchy Implementation

#### 0.1 Backend - Schema & Validation Updates
- [x] 0.1.1 Update Product Schema
  - [x] Add subcategoryId field (required, ref: Category)
  - [x] Add itemGroupId field (required, ref: ItemGroup)
  - [x] Update existing indexes to include new fields
  - [x] Add compound index on (categoryId, subcategoryId, itemGroupId)

- [x] 0.1.2 Create Hierarchy Validator
  - [x] Create custom validator class HierarchyValidator
  - [x] Implement validation logic to check subcategory belongs to category
  - [x] Implement validation logic to check item group belongs to subcategory
  - [x] Add proper error messages for validation failures

- [x] 0.1.3 Update Product DTOs
  - [x] Add subcategoryId to CreateProductDto (required)
  - [x] Add itemGroupId to CreateProductDto (required)
  - [x] Add subcategoryId to UpdateProductDto (optional)
  - [x] Add itemGroupId to UpdateProductDto (optional)
  - [x] Apply @ValidateHierarchy() decorator

- [x] 0.1.4 Update Product Service
  - [x] Update create method to validate hierarchy
  - [x] Update update method to validate hierarchy
  - [x] Add populate for subcategoryId and itemGroupId in queries
  - [x] Update cache keys to include hierarchy

- [x] 0.1.5 Add New API Endpoints
  - [x] GET /api/categories/:categoryId/subcategories
  - [x] GET /api/subcategories/:subcategoryId/item-groups
  - [x] Update existing endpoints to return hierarchy data

#### 0.2 Backend - Data Migration
- [x] 0.2.1 Create Migration Script
  - [x] Create migrate-product-hierarchy.ts script
  - [x] Implement logic to find products without hierarchy
  - [x] Create default "Other" subcategories for each category
  - [x] Create default "General" item groups for each subcategory
  - [x] Assign products to default hierarchy

- [x] 0.2.2 Run Migration
  - [x] Backup database before migration
  - [x] Run migration script on development
  - [x] Verify migrated data
  - [x] Document migration results
  - [x] Prepare rollback plan

- [x] 0.2.3 Validate Migration
  - [x] Check all products have subcategoryId
  - [x] Check all products have itemGroupId
  - [x] Verify hierarchy integrity
  - [x] Test API endpoints with migrated data

#### 0.3 Admin Panel - Cascading Dropdowns
- [x] 0.3.1 Update ProductsManager Component
  - [x] Add subcategoryId and itemGroupId to form state
  - [x] Add availableSubcategories state
  - [x] Add availableItemGroups state
  - [x] Implement useEffect to fetch subcategories when category changes
  - [x] Implement useEffect to fetch item groups when subcategory changes

- [x] 0.3.2 Update Product Form UI
  - [x] Change category/unit grid to 3-column layout
  - [x] Add subcategory dropdown (disabled until category selected)
  - [x] Add item group dropdown (disabled until subcategory selected)
  - [x] Add helper text for disabled dropdowns
  - [x] Remove unit dropdown from this section (move to separate row)

- [x] 0.3.3 Add Hierarchy Breadcrumb
  - [x] Create breadcrumb component showing Category > Subcategory > Item Group
  - [x] Display breadcrumb below dropdowns
  - [x] Add ChevronRight icons between levels
  - [x] Style breadcrumb with muted colors

- [x] 0.3.4 Update Product List Display
  - [x] Add hierarchy column to product table
  - [x] Display full path: Category → Subcategory → Item Group
  - [x] Update populate in API calls to include hierarchy
  - [x] Add hierarchy filter options

- [x] 0.3.5 Add API Helper Functions
  - [x] Create getSubcategories(categoryId) function
  - [x] Create getItemGroups(subcategoryId) function
  - [x] Update api.ts with new endpoints
  - [x] Add error handling for API calls

#### 0.4 Mobile App - Hierarchy Navigation
- [ ] 0.4.1 Create New Screens
  - [ ] Create SubcategoriesScreen.js
  - [ ] Create ItemGroupsScreen.js
  - [ ] Update ProductsScreen.js to accept itemGroupId param
  - [ ] Add screens to navigation stack

- [ ] 0.4.2 Update CategoriesScreen
  - [ ] Update onPress to navigate to SubcategoriesScreen
  - [ ] Pass categoryId as navigation param
  - [ ] Update CategoryCard component if needed

- [ ] 0.4.3 Implement SubcategoriesScreen
  - [ ] Fetch subcategories for selected category
  - [ ] Display subcategories in grid/list
  - [ ] Add loading and error states
  - [ ] Navigate to ItemGroupsScreen on subcategory press
  - [ ] Add back button to categories

- [ ] 0.4.4 Implement ItemGroupsScreen
  - [ ] Fetch item groups for selected subcategory
  - [ ] Display item groups in grid/list
  - [ ] Add loading and error states
  - [ ] Navigate to ProductsScreen on item group press
  - [ ] Add back button to subcategories

- [ ] 0.4.5 Create Breadcrumb Component
  - [ ] Create HierarchyBreadcrumb.js component
  - [ ] Display category > subcategory > item group path
  - [ ] Make breadcrumb items clickable for navigation
  - [ ] Style breadcrumb appropriately
  - [ ] Add to all hierarchy screens

- [ ] 0.4.6 Update API Services
  - [ ] Add getSubcategories(categoryId) to services.js
  - [ ] Add getItemGroups(subcategoryId) to services.js
  - [ ] Update getProducts to accept itemGroupId param
  - [ ] Update product queries to include hierarchy

#### 0.5 Testing
- [ ] 0.5.1 Backend Unit Tests
  - [ ] Test HierarchyValidator with valid hierarchy
  - [ ] Test HierarchyValidator with invalid subcategory
  - [ ] Test HierarchyValidator with invalid item group
  - [ ] Test product creation with complete hierarchy
  - [ ] Test product creation without hierarchy (should fail)

- [ ] 0.5.2 Backend Integration Tests
  - [ ] Test GET /api/categories/:id/subcategories
  - [ ] Test GET /api/subcategories/:id/item-groups
  - [ ] Test POST /api/products with valid hierarchy
  - [ ] Test POST /api/products with invalid hierarchy
  - [ ] Test product update with hierarchy change

- [ ] 0.5.3 Admin Panel Tests
  - [ ] Test cascading dropdown behavior
  - [ ] Test subcategory dropdown enables after category selection
  - [ ] Test item group dropdown enables after subcategory selection
  - [ ] Test form reset when category changes
  - [ ] Test breadcrumb display
  - [ ] Test product creation with complete hierarchy

- [ ] 0.5.4 Mobile App Tests
  - [ ] Test navigation from categories to subcategories
  - [ ] Test navigation from subcategories to item groups
  - [ ] Test navigation from item groups to products
  - [ ] Test breadcrumb navigation
  - [ ] Test back button functionality

#### 0.6 Documentation
- [ ] 0.6.1 Update API Documentation
  - [ ] Document new hierarchy endpoints
  - [ ] Update product endpoints with new required fields
  - [ ] Add hierarchy validation examples
  - [ ] Document error responses

- [ ] 0.6.2 Create User Guide
  - [ ] Document category hierarchy structure
  - [ ] Create admin guide for adding products
  - [ ] Document migration process
  - [ ] Add troubleshooting section

- [ ] 0.6.3 Update README
  - [ ] Add hierarchy enforcement section
  - [ ] Document new API endpoints
  - [ ] Add migration instructions
  - [ ] Update architecture diagram

---

## Phase 1: Core Commerce Features (High Priority)

### 1. Payment Integration (5-7 days)

#### 1.1 Backend - Payment Module Setup
- [ ] 1.1.1 Create payment module structure
  - [ ] Generate payment module with NestJS CLI
  - [ ] Create payment schema with Mongoose
  - [ ] Set up payment service
  - [ ] Create payment controller
  - [ ] Add payment module to app.module.ts

- [ ] 1.1.2 Integrate Razorpay SDK
  - [ ] Install razorpay npm package
  - [ ] Add Razorpay credentials to .env
  - [ ] Create Razorpay service wrapper
  - [ ] Implement order creation
  - [ ] Implement payment verification

- [ ] 1.1.3 Implement payment endpoints
  - [ ] POST /api/payments/create-order
  - [ ] POST /api/payments/verify
  - [ ] GET /api/payments/:orderId
  - [ ] POST /api/payments/:paymentId/refund
  - [ ] POST /api/payments/webhook (with signature verification)

- [ ] 1.1.4 Update order flow
  - [ ] Add payment status to order schema
  - [ ] Link payment to order
  - [ ] Update order status on payment success
  - [ ] Handle payment failure scenarios
  - [ ] Implement payment retry logic

#### 1.2 Mobile App - Payment Integration
- [ ] 1.2.1 Install Razorpay React Native SDK
  - [ ] Add react-native-razorpay dependency
  - [ ] Configure iOS/Android native modules
  - [ ] Test basic integration

- [ ] 1.2.2 Create payment screens/components
  - [ ] Payment method selection screen
  - [ ] Razorpay checkout integration
  - [ ] Payment success screen
  - [ ] Payment failure screen
  - [ ] Payment processing loader

- [ ] 1.2.3 Implement payment flow
  - [ ] Call create-order API before checkout
  - [ ] Open Razorpay checkout with order details
  - [ ] Handle payment success callback
  - [ ] Call verify API with payment details
  - [ ] Navigate to order confirmation
  - [ ] Handle payment errors

- [ ] 1.2.4 Update checkout screen
  - [ ] Add payment method selection
  - [ ] Show order summary with payment breakdown
  - [ ] Add COD option
  - [ ] Implement payment retry button

#### 1.3 Admin Panel - Payment Management
- [ ] 1.3.1 Create payment list view
  - [ ] Display all payments with filters
  - [ ] Show payment status
  - [ ] Add search by order ID
  - [ ] Implement pagination

- [ ] 1.3.2 Payment details view
  - [ ] Show complete payment information
  - [ ] Display gateway response
  - [ ] Show refund history
  - [ ] Add refund button

- [ ] 1.3.3 Refund management
  - [ ] Create refund initiation form
  - [ ] Implement refund API call
  - [ ] Show refund status
  - [ ] Add refund confirmation dialog

#### 1.4 Testing & Documentation
- [ ] 1.4.1 Write unit tests
  - [ ] Payment service tests
  - [ ] Payment verification tests
  - [ ] Refund logic tests

- [ ] 1.4.2 Integration testing
  - [ ] Test complete payment flow
  - [ ] Test webhook handling
  - [ ] Test refund flow
  - [ ] Test payment failure scenarios

- [ ] 1.4.3 Documentation
  - [ ] Document payment API endpoints
  - [ ] Create payment flow diagram
  - [ ] Document webhook setup
  - [ ] Add troubleshooting guide

---

### 2. Notifications System (3-5 days)

#### 2.1 Backend - Notification Module
- [ ] 2.1.1 Create notification module structure
  - [ ] Generate notification module
  - [ ] Create notification schema
  - [ ] Create device token schema
  - [ ] Set up notification service

- [ ] 2.1.2 Integrate Firebase Cloud Messaging
  - [ ] Set up Firebase project
  - [ ] Install firebase-admin SDK
  - [ ] Add Firebase credentials to .env
  - [ ] Create FCM service
  - [ ] Implement send notification method

- [ ] 2.1.3 Integrate email service
  - [ ] Install SendGrid/Nodemailer
  - [ ] Add email credentials to .env
  - [ ] Create email service
  - [ ] Create email templates
  - [ ] Implement send email method

- [ ] 2.1.4 Create notification templates
  - [ ] Order placed template
  - [ ] Order confirmed template
  - [ ] Out for delivery template
  - [ ] Order delivered template
  - [ ] Payment success template
  - [ ] Promotional template

- [ ] 2.1.5 Implement notification endpoints
  - [ ] POST /api/notifications/register-device
  - [ ] GET /api/notifications
  - [ ] PATCH /api/notifications/:id/read
  - [ ] POST /api/admin/notifications/send

- [ ] 2.1.6 Integrate with order flow
  - [ ] Send notification on order placed
  - [ ] Send notification on status change
  - [ ] Send notification on payment success
  - [ ] Send notification on delivery

#### 2.2 Mobile App - Push Notifications
- [ ] 2.2.1 Set up Firebase
  - [ ] Add Firebase to React Native project
  - [ ] Configure iOS push certificates
  - [ ] Configure Android FCM
  - [ ] Test basic push notification

- [ ] 2.2.2 Implement notification handling
  - [ ] Request notification permission
  - [ ] Register device token with backend
  - [ ] Handle foreground notifications
  - [ ] Handle background notifications
  - [ ] Handle notification tap
  - [ ] Implement deep linking

- [ ] 2.2.3 Create notifications screen
  - [ ] Display notification list
  - [ ] Mark as read functionality
  - [ ] Clear all notifications
  - [ ] Show unread badge

- [ ] 2.2.4 Update app badge
  - [ ] Show unread count on app icon
  - [ ] Update badge on notification receive
  - [ ] Clear badge on app open

#### 2.3 Admin Panel - Notification Management
- [ ] 2.3.1 Create notification sender
  - [ ] Build notification compose form
  - [ ] Add user targeting options
  - [ ] Implement send notification
  - [ ] Show delivery status

- [ ] 2.3.2 Notification history
  - [ ] Display sent notifications
  - [ ] Show delivery statistics
  - [ ] Add filters and search

#### 2.4 Testing
- [ ] 2.4.1 Test push notifications
  - [ ] Test on iOS device
  - [ ] Test on Android device
  - [ ] Test foreground/background scenarios
  - [ ] Test deep linking

- [ ] 2.4.2 Test email notifications
  - [ ] Test all email templates
  - [ ] Verify email delivery
  - [ ] Test with different email providers

---

### 3. Enhanced Search & Filters (3-4 days)

#### 3.1 Backend - Search Enhancement
- [ ] 3.1.1 Update product schema
  - [ ] Add searchKeywords field
  - [ ] Add popularity field
  - [ ] Add trendingScore field
  - [ ] Create text indexes

- [ ] 3.1.2 Create search service
  - [ ] Implement full-text search
  - [ ] Add fuzzy matching logic
  - [ ] Implement ranking algorithm
  - [ ] Add search suggestions

- [ ] 3.1.3 Create search history
  - [ ] Create search history schema
  - [ ] Track user searches
  - [ ] Implement recent searches API

- [ ] 3.1.4 Implement filter system
  - [ ] Price range filter
  - [ ] Category filter
  - [ ] Brand filter
  - [ ] Dietary filter
  - [ ] Rating filter
  - [ ] In-stock filter

- [ ] 3.1.5 Create search endpoints
  - [ ] GET /api/search/products
  - [ ] GET /api/search/suggestions
  - [ ] GET /api/search/recent
  - [ ] DELETE /api/search/recent/:id
  - [ ] GET /api/products/filters

#### 3.2 Mobile App - Search UI
- [ ] 3.2.1 Enhance search screen
  - [ ] Add search suggestions dropdown
  - [ ] Show recent searches
  - [ ] Implement search debouncing
  - [ ] Add clear search button

- [ ] 3.2.2 Implement filters
  - [ ] Create filter bottom sheet
  - [ ] Add price range slider
  - [ ] Add category checkboxes
  - [ ] Add brand checkboxes
  - [ ] Add dietary filters
  - [ ] Add rating filter
  - [ ] Show applied filters count

- [ ] 3.2.3 Implement sorting
  - [ ] Sort by relevance
  - [ ] Sort by price (low to high)
  - [ ] Sort by price (high to low)
  - [ ] Sort by rating
  - [ ] Sort by popularity

- [ ] 3.2.4 Update search results
  - [ ] Show filter chips
  - [ ] Add remove filter option
  - [ ] Show result count
  - [ ] Implement infinite scroll

#### 3.3 Admin Panel - Search Analytics
- [ ] 3.3.1 Create search analytics dashboard
  - [ ] Show top searches
  - [ ] Show searches with no results
  - [ ] Display search trends
  - [ ] Add date range filter

#### 3.4 Testing
- [ ] 3.4.1 Test search functionality
  - [ ] Test with various queries
  - [ ] Test fuzzy matching
  - [ ] Test filters
  - [ ] Test sorting
  - [ ] Performance test with large dataset

---

### 4. Reviews & Ratings (4-5 days)

#### 4.1 Backend - Review Module
- [ ] 4.1.1 Create review module structure
  - [ ] Generate review module
  - [ ] Create review schema
  - [ ] Create review vote schema
  - [ ] Set up review service

- [ ] 4.1.2 Implement review logic
  - [ ] Verify purchase before review
  - [ ] Calculate average rating
  - [ ] Update product rating aggregate
  - [ ] Implement helpful votes
  - [ ] Implement report functionality

- [ ] 4.1.3 Create review endpoints
  - [ ] POST /api/reviews
  - [ ] GET /api/reviews/product/:productId
  - [ ] PATCH /api/reviews/:id
  - [ ] DELETE /api/reviews/:id
  - [ ] POST /api/reviews/:id/helpful
  - [ ] POST /api/reviews/:id/report

- [ ] 4.1.4 Admin moderation
  - [ ] GET /api/admin/reviews/pending
  - [ ] PATCH /api/admin/reviews/:id/moderate
  - [ ] Implement auto-moderation rules
  - [ ] Add profanity filter

- [ ] 4.1.5 Update product schema
  - [ ] Add rating aggregate fields
  - [ ] Create rating calculation job
  - [ ] Update on review create/update/delete

#### 4.2 Mobile App - Review UI
- [ ] 4.2.1 Product detail enhancements
  - [ ] Display average rating
  - [ ] Show rating distribution
  - [ ] Add "Write Review" button
  - [ ] Show review summary

- [ ] 4.2.2 Create review list screen
  - [ ] Display all product reviews
  - [ ] Show verified purchase badge
  - [ ] Implement helpful button
  - [ ] Add report button
  - [ ] Implement pagination

- [ ] 4.2.3 Create write review screen
  - [ ] Star rating input
  - [ ] Title input
  - [ ] Comment textarea
  - [ ] Image upload (optional)
  - [ ] Submit review

- [ ] 4.2.4 My reviews screen
  - [ ] Show user's reviews
  - [ ] Edit review option
  - [ ] Delete review option

#### 4.3 Admin Panel - Review Management
- [ ] 4.3.1 Create review moderation screen
  - [ ] List pending reviews
  - [ ] Show review details
  - [ ] Approve/reject buttons
  - [ ] Add moderation note

- [ ] 4.3.2 Review analytics
  - [ ] Average rating by product
  - [ ] Review count trends
  - [ ] Most reviewed products
  - [ ] Reported reviews list

#### 4.4 Testing
- [ ] 4.4.1 Test review functionality
  - [ ] Test review creation
  - [ ] Test rating calculation
  - [ ] Test helpful votes
  - [ ] Test moderation flow
  - [ ] Test edge cases

---

## Phase 2: Marketing & Growth Features

### 5. Promotions & Discounts (5-7 days)

#### 5.1 Backend - Coupon Module
- [ ] 5.1.1 Create coupon module structure
  - [ ] Generate coupon module
  - [ ] Create coupon schema
  - [ ] Create coupon usage schema
  - [ ] Set up coupon service

- [ ] 5.1.2 Implement coupon logic
  - [ ] Validate coupon code
  - [ ] Check usage limits
  - [ ] Check user eligibility
  - [ ] Calculate discount
  - [ ] Apply max discount cap
  - [ ] Track coupon usage

- [ ] 5.1.3 Create coupon endpoints
  - [ ] POST /api/coupons/validate
  - [ ] POST /api/coupons/apply
  - [ ] GET /api/coupons/available
  - [ ] POST /api/admin/coupons
  - [ ] GET /api/admin/coupons
  - [ ] PATCH /api/admin/coupons/:id
  - [ ] DELETE /api/admin/coupons/:id
  - [ ] GET /api/admin/coupons/:id/usage

- [ ] 5.1.4 Update order flow
  - [ ] Add coupon field to order
  - [ ] Store discount amount
  - [ ] Update total calculation
  - [ ] Handle coupon removal

#### 5.2 Mobile App - Coupon UI
- [ ] 5.2.1 Cart screen enhancements
  - [ ] Add "Apply Coupon" button
  - [ ] Show applied coupon
  - [ ] Display discount amount
  - [ ] Add remove coupon option

- [ ] 5.2.2 Create coupon list screen
  - [ ] Display available coupons
  - [ ] Show coupon details
  - [ ] Add "Apply" button
  - [ ] Show terms & conditions

- [ ] 5.2.3 Coupon input modal
  - [ ] Coupon code input
  - [ ] Apply button
  - [ ] Show validation errors
  - [ ] Show success message

#### 5.3 Admin Panel - Coupon Management
- [ ] 5.3.1 Create coupon form
  - [ ] Coupon code input
  - [ ] Discount type selector
  - [ ] Value input
  - [ ] Min order value
  - [ ] Max discount
  - [ ] Category/product selection
  - [ ] Usage limits
  - [ ] Date range picker
  - [ ] User restrictions

- [ ] 5.3.2 Coupon list view
  - [ ] Display all coupons
  - [ ] Show active/inactive status
  - [ ] Add edit/delete actions
  - [ ] Show usage statistics

- [ ] 5.3.3 Coupon analytics
  - [ ] Total discount given
  - [ ] Most used coupons
  - [ ] Coupon conversion rate
  - [ ] Revenue impact

#### 5.4 Testing
- [ ] 5.4.1 Test coupon functionality
  - [ ] Test all discount types
  - [ ] Test usage limits
  - [ ] Test min order value
  - [ ] Test max discount
  - [ ] Test expiry
  - [ ] Test edge cases

---

### 6. Wishlist (2-3 days)

#### 6.1 Backend - Wishlist Module
- [ ] 6.1.1 Create wishlist schema
  - [ ] Design wishlist schema
  - [ ] Add notification preferences
  - [ ] Create indexes

- [ ] 6.1.2 Implement wishlist service
  - [ ] Add to wishlist
  - [ ] Remove from wishlist
  - [ ] Get wishlist
  - [ ] Move to cart
  - [ ] Check stock/price changes

- [ ] 6.1.3 Create wishlist endpoints
  - [ ] GET /api/wishlist
  - [ ] POST /api/wishlist/add
  - [ ] DELETE /api/wishlist/remove/:productId
  - [ ] POST /api/wishlist/move-to-cart
  - [ ] PATCH /api/wishlist/:productId/notify

#### 6.2 Mobile App - Wishlist UI
- [ ] 6.2.1 Add wishlist button
  - [ ] Add heart icon to product cards
  - [ ] Add to product detail screen
  - [ ] Toggle wishlist state
  - [ ] Show visual feedback

- [ ] 6.2.2 Create wishlist screen
  - [ ] Display wishlist items
  - [ ] Show out of stock items
  - [ ] Show price changes
  - [ ] Add to cart button
  - [ ] Remove from wishlist

- [ ] 6.2.3 Wishlist notifications
  - [ ] Notify on price drop
  - [ ] Notify on back in stock
  - [ ] Add notification settings

#### 6.3 Testing
- [ ] 6.3.1 Test wishlist functionality
  - [ ] Test add/remove
  - [ ] Test move to cart
  - [ ] Test notifications
  - [ ] Test sync across devices

---

## Phase 3: Operations & Support

### 7. Delivery Management (7-10 days)

#### 7.1 Backend - Delivery Module
- [ ] 7.1.1 Create delivery partner schema
  - [ ] Design partner schema
  - [ ] Add location tracking
  - [ ] Add status fields
  - [ ] Create geospatial indexes

- [ ] 7.1.2 Create delivery schema
  - [ ] Design delivery schema
  - [ ] Add route tracking
  - [ ] Add proof of delivery
  - [ ] Link to order

- [ ] 7.1.3 Implement delivery service
  - [ ] Auto-assign partner logic
  - [ ] Calculate distance
  - [ ] Estimate delivery time
  - [ ] Track delivery status
  - [ ] Handle delivery proof

- [ ] 7.1.4 Create delivery endpoints
  - [ ] POST /api/delivery/assign
  - [ ] GET /api/delivery/:orderId/track
  - [ ] PATCH /api/delivery/:id/status
  - [ ] POST /api/delivery/:id/proof

- [ ] 7.1.5 Delivery partner APIs
  - [ ] POST /api/delivery-partner/login
  - [ ] GET /api/delivery-partner/orders
  - [ ] PATCH /api/delivery-partner/location
  - [ ] PATCH /api/delivery-partner/status

#### 7.2 Mobile App - Delivery Tracking
- [ ] 7.2.1 Order tracking screen enhancements
  - [ ] Show delivery partner details
  - [ ] Display real-time location
  - [ ] Show estimated time
  - [ ] Add call partner button

- [ ] 7.2.2 Map integration
  - [ ] Integrate Google Maps
  - [ ] Show delivery route
  - [ ] Show partner location
  - [ ] Update location in real-time

#### 7.3 Admin Panel - Delivery Management
- [ ] 7.3.1 Delivery partner management
  - [ ] List all partners
  - [ ] Add new partner
  - [ ] Edit partner details
  - [ ] View partner performance

- [ ] 7.3.2 Delivery monitoring
  - [ ] Real-time delivery map
  - [ ] Active deliveries list
  - [ ] Delivery history
  - [ ] Performance metrics

#### 7.4 Delivery Partner App (Optional)
- [ ] 7.4.1 Create basic partner app
  - [ ] Login screen
  - [ ] Order list
  - [ ] Order details
  - [ ] Navigation integration
  - [ ] Status updates
  - [ ] Proof of delivery

#### 7.5 Testing
- [ ] 7.5.1 Test delivery functionality
  - [ ] Test auto-assignment
  - [ ] Test location tracking
  - [ ] Test status updates
  - [ ] Test proof of delivery

---

### 8. Customer Support (5-7 days)

#### 8.1 Backend - Support Module
- [ ] 8.1.1 Create ticket schema
  - [ ] Design support ticket schema
  - [ ] Add priority levels
  - [ ] Add status tracking
  - [ ] Link to user/order

- [ ] 8.1.2 Implement support service
  - [ ] Create ticket
  - [ ] Update ticket status
  - [ ] Add comments
  - [ ] Assign to agent
  - [ ] Close ticket

- [ ] 8.1.3 Create support endpoints
  - [ ] POST /api/support/tickets
  - [ ] GET /api/support/tickets
  - [ ] GET /api/support/tickets/:id
  - [ ] POST /api/support/tickets/:id/comment
  - [ ] PATCH /api/support/tickets/:id/status

#### 8.2 Mobile App - Help & Support
- [ ] 8.2.1 Create help center
  - [ ] FAQ section
  - [ ] Contact us page
  - [ ] Order help
  - [ ] Payment help

- [ ] 8.2.2 Create ticket system
  - [ ] Raise ticket form
  - [ ] My tickets list
  - [ ] Ticket details
  - [ ] Add comment
  - [ ] Track status

#### 8.3 Admin Panel - Support Dashboard
- [ ] 8.3.1 Ticket management
  - [ ] List all tickets
  - [ ] Filter by status/priority
  - [ ] Assign tickets
  - [ ] Add internal notes
  - [ ] Close tickets

- [ ] 8.3.2 Support analytics
  - [ ] Response time metrics
  - [ ] Resolution time
  - [ ] Ticket volume trends
  - [ ] Agent performance

#### 8.4 Testing
- [ ] 8.4.1 Test support functionality
  - [ ] Test ticket creation
  - [ ] Test status updates
  - [ ] Test notifications
  - [ ] Test assignment

---

## Phase 4: Polish & Scale

### 9. Testing & Quality Assurance (7-10 days)

#### 9.1 Backend Testing
- [ ] 9.1.1 Unit tests
  - [ ] Write tests for all services
  - [ ] Test edge cases
  - [ ] Achieve 80%+ coverage

- [ ] 9.1.2 Integration tests
  - [ ] Test all API endpoints
  - [ ] Test authentication
  - [ ] Test authorization
  - [ ] Test error handling

- [ ] 9.1.3 E2E tests
  - [ ] Test complete user flows
  - [ ] Test order flow
  - [ ] Test payment flow
  - [ ] Test delivery flow

#### 9.2 Mobile App Testing
- [ ] 9.2.1 Component tests
  - [ ] Test all components
  - [ ] Test Redux slices
  - [ ] Test navigation

- [ ] 9.2.2 E2E tests
  - [ ] Set up Detox
  - [ ] Test critical flows
  - [ ] Test on iOS
  - [ ] Test on Android

- [ ] 9.2.3 Manual testing
  - [ ] Test on real devices
  - [ ] Test different screen sizes
  - [ ] Test offline scenarios
  - [ ] Test edge cases

#### 9.3 Admin Panel Testing
- [ ] 9.3.1 Component tests
  - [ ] Test all components
  - [ ] Test forms
  - [ ] Test data tables

- [ ] 9.3.2 E2E tests
  - [ ] Set up Playwright
  - [ ] Test admin flows
  - [ ] Test cross-browser

---

### 10. Performance Optimization (5-7 days)

#### 10.1 Backend Optimization
- [ ] 10.1.1 Database optimization
  - [ ] Review and optimize indexes
  - [ ] Optimize slow queries
  - [ ] Implement query caching
  - [ ] Add database connection pooling

- [ ] 10.1.2 API optimization
  - [ ] Implement response compression
  - [ ] Add Redis caching
  - [ ] Optimize payload sizes
  - [ ] Implement pagination everywhere

- [ ] 10.1.3 Load testing
  - [ ] Set up load testing tools
  - [ ] Test API endpoints
  - [ ] Identify bottlenecks
  - [ ] Optimize based on results

#### 10.2 Mobile App Optimization
- [ ] 10.2.1 Bundle optimization
  - [ ] Analyze bundle size
  - [ ] Remove unused dependencies
  - [ ] Implement code splitting
  - [ ] Optimize images

- [ ] 10.2.2 Performance improvements
  - [ ] Implement image lazy loading
  - [ ] Add list virtualization
  - [ ] Optimize re-renders
  - [ ] Reduce API calls

#### 10.3 Admin Panel Optimization
- [ ] 10.3.1 Build optimization
  - [ ] Optimize bundle size
  - [ ] Implement lazy loading
  - [ ] Add code splitting

- [ ] 10.3.2 Runtime optimization
  - [ ] Optimize data tables
  - [ ] Add virtual scrolling
  - [ ] Implement debouncing

---

### 11. Security Hardening (5-7 days)

#### 11.1 Backend Security
- [ ] 11.1.1 Authentication security
  - [ ] Implement rate limiting on auth endpoints
  - [ ] Add account lockout after failed attempts
  - [ ] Implement password policies (if adding password auth)
  - [ ] Add 2FA support (optional)

- [ ] 11.1.2 API security
  - [ ] Implement request validation
  - [ ] Add input sanitization
  - [ ] Implement CORS properly
  - [ ] Add security headers (Helmet)
  - [ ] Implement API rate limiting

- [ ] 11.1.3 Data security
  - [ ] Encrypt sensitive data
  - [ ] Implement data masking
  - [ ] Add audit logging
  - [ ] Implement GDPR compliance

- [ ] 11.1.4 Security testing
  - [ ] Run security audit
  - [ ] Test for SQL injection
  - [ ] Test for XSS
  - [ ] Test for CSRF
  - [ ] Penetration testing

#### 11.2 Mobile App Security
- [ ] 11.2.1 Secure storage
  - [ ] Use secure storage for tokens
  - [ ] Encrypt sensitive data
  - [ ] Implement certificate pinning

- [ ] 11.2.2 Code security
  - [ ] Obfuscate code
  - [ ] Remove console logs
  - [ ] Implement root detection
  - [ ] Add jailbreak detection

#### 11.3 Admin Panel Security
- [ ] 11.3.1 Authentication
  - [ ] Implement session timeout
  - [ ] Add remember me securely
  - [ ] Implement logout on all devices

- [ ] 11.3.2 Authorization
  - [ ] Implement role-based access
  - [ ] Add permission checks
  - [ ] Audit admin actions

---

### 12. Documentation (3-5 days)

#### 12.1 Technical Documentation
- [ ] 12.1.1 API documentation
  - [ ] Document all endpoints
  - [ ] Add request/response examples
  - [ ] Document error codes
  - [ ] Create Postman collection

- [ ] 12.1.2 Architecture documentation
  - [ ] Create system architecture diagram
  - [ ] Document data models
  - [ ] Document integrations
  - [ ] Create deployment guide

- [ ] 12.1.3 Code documentation
  - [ ] Add JSDoc comments
  - [ ] Document complex logic
  - [ ] Create README files
  - [ ] Add inline comments

#### 12.2 User Documentation
- [ ] 12.2.1 User guides
  - [ ] Create user manual
  - [ ] Add screenshots
  - [ ] Create video tutorials
  - [ ] FAQ section

- [ ] 12.2.2 Admin guides
  - [ ] Admin panel guide
  - [ ] Feature documentation
  - [ ] Troubleshooting guide

---

### 13. Deployment & DevOps (5-7 days)

#### 13.1 Infrastructure Setup
- [ ] 13.1.1 Cloud setup
  - [ ] Set up AWS/DigitalOcean account
  - [ ] Configure VPC and security groups
  - [ ] Set up load balancer
  - [ ] Configure auto-scaling

- [ ] 13.1.2 Database setup
  - [ ] Set up MongoDB cluster
  - [ ] Configure backups
  - [ ] Set up Redis cluster
  - [ ] Configure monitoring

- [ ] 13.1.3 Storage setup
  - [ ] Set up S3/Cloudinary
  - [ ] Configure CDN
  - [ ] Set up backup strategy

#### 13.2 CI/CD Pipeline
- [ ] 13.2.1 Set up CI/CD
  - [ ] Configure GitHub Actions
  - [ ] Add linting step
  - [ ] Add testing step
  - [ ] Add build step
  - [ ] Add deployment step

- [ ] 13.2.2 Environment setup
  - [ ] Set up staging environment
  - [ ] Set up production environment
  - [ ] Configure environment variables
  - [ ] Set up secrets management

#### 13.3 Monitoring & Logging
- [ ] 13.3.1 Set up monitoring
  - [ ] Configure application monitoring
  - [ ] Set up error tracking (Sentry)
  - [ ] Configure uptime monitoring
  - [ ] Set up alerts

- [ ] 13.3.2 Set up logging
  - [ ] Configure centralized logging
  - [ ] Set up log aggregation
  - [ ] Create log dashboards
  - [ ] Set up log retention

#### 13.4 Deployment
- [ ] 13.4.1 Deploy backend
  - [ ] Deploy to staging
  - [ ] Run smoke tests
  - [ ] Deploy to production
  - [ ] Verify deployment

- [ ] 13.4.2 Deploy admin panel
  - [ ] Build production bundle
  - [ ] Deploy to hosting
  - [ ] Configure domain
  - [ ] Set up SSL

- [ ] 13.4.3 Deploy mobile app
  - [ ] Build iOS app
  - [ ] Submit to App Store
  - [ ] Build Android app
  - [ ] Submit to Play Store

---

## Summary

**Total Estimated Tasks**: 200+ tasks
**Estimated Timeline**: 2-3 months (single developer)
**Priority Order**: Phase 1 → Phase 2 → Phase 3 → Phase 4

**Critical Path**:
1. Payment Integration (must have for launch)
2. Notifications (essential for user engagement)
3. Search Enhancement (improves user experience)
4. Reviews & Ratings (builds trust)
5. Promotions (drives sales)
6. Testing & Security (ensures quality)
7. Deployment (go live)

**Notes**:
- Tasks can be parallelized if multiple developers
- Some tasks are optional based on business requirements
- Testing should be done continuously, not just in Phase 4
- Documentation should be updated as features are built
