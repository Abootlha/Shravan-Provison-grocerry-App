# ShravanKirana App Architecture & Flow

This document outlines the high-level technology stack and the structural flow of the three main components of the ShravanKirana application: the Customer Frontend (Mobile/Web), the Backend API, and the Admin Dashboard.

---

## 1. Technology Stack Overview

### Customer Frontend (Mobile & Web)
*   **Framework:** React Native with Expo (cross-platform for Android, iOS, Web)
*   **Navigation:** React Navigation (Stack & Bottom Tabs)
*   **State Management:** Redux Toolkit & React-Redux
*   **UI/Styling:** React Native Paper, React Native Reanimated, React Native Vector Icons
*   **Data Fetching:** Axios
*   **Local Storage:** AsyncStorage

### Backend Server (API)
*   **Framework:** NestJS (Node.js with TypeScript)
*   **Database:** MongoDB with Mongoose
*   **Real-time Features:** Socket.io
*   **Task Queues:** BullMQ & Redis
*   **Auth & Security:** Passport (JWT), Bcrypt, Helmet, Throttler
*   **Validation:** class-validator, class-transformer, Zod

### Admin Dashboard (Web)
*   **Framework:** Astro (with React integrations)
*   **Styling:** Tailwind CSS v4
*   **UI Components:** Radix UI primitives (Dialog, Select, Dropdown, etc.)
*   **Icons:** Lucide React, Iconify

---

## 2. Customer Frontend Flow (Mobile App)

The customer-facing application is organized into distinct screens (`src/screens/`) managed by a central navigator.

### App Flow Sequence:
1.  **Initial Launch**
    *   `SplashScreen`: Loads the app and checks underlying state (e.g., auth tokens).
    *   `LanguageSelectionScreen`: Allows the user to pick their preferred language.
    *   `OnboardingScreen`: Shows a welcome sequence or tutorial to new users.
2.  **Authentication & Location**
    *   `LoginScreen`: Prompts for user credentials (phone number/email).
    *   `OTPScreen`: Verifies the login attempt via a One-Time Password.
    *   `LocationScreen` / `AddAddressScreen`: Determines or asks the user for their delivery location.
3.  **Main Application (Home & Browsing)**
    *   `HomeScreen`: The main landing page showing banners, offers, and featured products.
    *   `SearchScreen`: Allows users to search for specific items.
    *   `CategoriesScreen` & `CategoryScreen`: Lists broad categories and drills down into specific product groups.
    *   `ProductDetailScreen`: Displays detailed information about a single product.
4.  **Cart & Checkout**
    *   `CartScreen`: Shows selected items, quantities, and the subtotal.
    *   `CheckoutScreen`: Finalizes the order, handles payment selection, and confirms the delivery address.
5.  **Post-Order & Profile Management**
    *   `OrderTrackingScreen`: Live tracking of an active order using Socket.io.
    *   `OrdersHistoryScreen`: Lists all past user orders.
    *   `ProfileScreen`: Manages user account details, settings, and addresses.

---

## 3. Backend Architecture & Modules

The backend is built using a modular NestJS architecture (`backend/src/modules/`), where each domain of the application is separated into its own module.

### Core Modules:
*   **`auth`**: Handles login, registration, token generation, and password hashing.
*   **`users`**: Manages user profiles, roles, and address records.
*   **`categories` & `subcategories`**: Manages the classification hierarchy for the grocery store catalog.
*   **`brands` & `item-groups`**: Organizes products by their manufacturer or specific thematic groups.
*   **`products`**: The core catalog module; handles product listing, details, stock, and pricing logic.
*   **`cart`**: Manages temporary shopping sessions before they become confirmed orders.
*   **`orders` & `payments`**: Handles the transition from a cart to an order, manages statuses (Pending, Packed, Out for Delivery), and processes financial transactions.
*   **`settings`**: Manages global application configurations (e.g., delivery fees, store status).
*   **`analytics`**: Gathers data on sales, active users, and other business metrics.

---

## 4. Admin Dashboard Flow (Web Panel)

The admin panel is a web interface tailored for store managers and staff to operate the business (`admin/src/pages/`).

### Base Structure:
*   **`login`**: Authentication gateway for staff and administrators.
*   **`index` (Dashboard)**: The main overview summarizing daily sales, pending orders, and alerts.

### Management Sections:
*   **Catalog Management:**
    *   `categories`, `subcategories`, `item-groups`: Tools to structure the store layout.
    *   `products`: Add, edit, or remove products from the catalog.
*   **Operations:**
    *   `inventory`: Monitor stock levels and update quantities.
    *   `pricing`: Adjust retail prices, discounts, and promotional offers.
*   **Fulfillment:**
    *   `orders`: View incoming orders, update their status, and generate invoices.
    *   `delivery`: Manage delivery personnel, assign orders, and track active deliveries.
*   **CRM & Reporting:**
    *   `customers`: View registered users and their order histories.
    *   `analytics`: Detailed reports on revenue, popular products, etc.
*   **System Configuration:**
    *   `settings`: General store settings, tax configurations, and system preferences.
