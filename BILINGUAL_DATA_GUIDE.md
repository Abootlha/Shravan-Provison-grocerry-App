# Bilingual Data Support - Implementation Guide

## ✅ What's Been Implemented

### Backend Schemas Updated
All schemas now support Hindi fields:

1. **Category Schema** (`backend/src/modules/categories/schemas/category.schema.ts`)
   - `nameHi` - Hindi category name
   - `descriptionHi` - Hindi description

2. **Subcategory Schema** (`backend/src/modules/subcategories/schemas/subcategory.schema.ts`)
   - `nameHi` - Hindi subcategory name
   - `descriptionHi` - Hindi description

3. **Product Schema** (`backend/src/modules/products/schemas/product.schema.ts`)
   - `nameHi` - Hindi product name
   - `brandHi` - Hindi brand name
   - `descriptionHi` - Hindi description

### Mobile App Updated
- **Language Helper** (`src/utils/languageHelper.js`)
  - `getLocalizedName()` - Returns Hindi name if language is 'hi' and nameHi exists
  - `getLocalizedDescription()` - Returns Hindi description
  - `getLocalizedBrand()` - Returns Hindi brand

- **HomeScreen** - Now uses `getLocalizedName()` for categories and products

## 📝 How to Add Hindi Data

### Step 1: Restart Backend Server
```bash
cd backend
npm run start:dev
```

### Step 2: Add Hindi Names in Admin Panel

#### For Categories:
1. Go to `http://192.168.1.7:4321/categories`
2. Edit each category
3. Add fields:
   - **Name (Hindi)**: हिंदी नाम
   - **Description (Hindi)**: हिंदी विवरण

#### For Subcategories:
1. Go to `http://192.168.1.7:4321/subcategories`
2. Edit each subcategory
3. Add Hindi name and description

#### For Products:
1. Go to `http://192.168.1.7:4321/products`
2. Edit each product
3. Add:
   - **Name (Hindi)**: उत्पाद का हिंदी नाम
   - **Brand (Hindi)**: ब्रांड का हिंदी नाम
   - **Description (Hindi)**: हिंदी विवरण

## 🔧 Admin Panel Updates Needed

The admin panel forms need to be updated to include Hindi input fields. Here's what needs to be added:

### CategoriesManager.tsx
```tsx
// Add these fields to the form
<div>
    <label>Category Name (Hindi)</label>
    <Input
        value={form.nameHi}
        onChange={(e) => setForm({ ...form, nameHi: e.target.value })}
        placeholder="श्रेणी का नाम"
    />
</div>

<div>
    <label>Description (Hindi)</label>
    <textarea
        value={form.descriptionHi}
        onChange={(e) => setForm({ ...form, descriptionHi: e.target.value })}
        placeholder="विवरण"
    />
</div>
```

### SubcategoriesManager.tsx
Same as above - add `nameHi` and `descriptionHi` fields

### ProductsManager.tsx
```tsx
// Add these fields
<div>
    <label>Product Name (Hindi)</label>
    <Input
        value={form.nameHi}
        onChange={(e) => setForm({ ...form, nameHi: e.target.value })}
        placeholder="उत्पाद का नाम"
    />
</div>

<div>
    <label>Brand (Hindi)</label>
    <Input
        value={form.brandHi}
        onChange={(e) => setForm({ ...form, brandHi: e.target.value })}
        placeholder="ब्रांड"
    />
</div>

<div>
    <label>Description (Hindi)</label>
    <textarea
        value={form.descriptionHi}
        onChange={(e) => setForm({ ...form, descriptionHi: e.target.value })}
        placeholder="विवरण"
    />
</div>
```

## 🎯 How It Works

1. **User selects Hindi** in language selection screen
2. **Redux stores** language preference as 'hi'
3. **Mobile app** calls `getLocalizedName(item, 'hi')`
4. **Helper function** checks:
   - If language is 'hi' AND `item.nameHi` exists → return `item.nameHi`
   - Otherwise → return `item.name` (English)

## 📱 Screens That Need Updates

To use localized names in other screens, import and use the helper:

```javascript
import { getLocalizedName, getLocalizedDescription } from '../utils/languageHelper';
import { useTranslation } from '../hooks/useTranslation';

const MyScreen = () => {
    const { currentLanguage } = useTranslation();
    
    // Use in render
    <Text>{getLocalizedName(product, currentLanguage)}</Text>
    <Text>{getLocalizedDescription(product, currentLanguage)}</Text>
};
```

### Screens to Update:
- ✅ HomeScreen (Done)
- ⏳ CategoryScreen
- ⏳ ProductDetailScreen
- ⏳ CartScreen
- ⏳ SearchScreen
- ⏳ CategoriesScreen

## 🔄 Migration Script (Optional)

If you want to bulk-add Hindi names, create a migration script:

```javascript
// backend/src/scripts/add-hindi-names.ts
const categories = [
    { name: 'Bakery & Biscuits', nameHi: 'बेकरी और बिस्कुट' },
    { name: 'Cleaning & Essentials', nameHi: 'सफाई और आवश्यक सामान' },
    { name: 'Tea, Coffee & Milk', nameHi: 'चाय, कॉफी और दूध' },
    // ... more
];

// Update each category with Hindi name
for (const cat of categories) {
    await categoryModel.updateOne(
        { name: cat.name },
        { $set: { nameHi: cat.nameHi } }
    );
}
```

## ✨ Example Hindi Translations

### Categories:
- Bakery & Biscuits → बेकरी और बिस्कुट
- Cleaning & Essentials → सफाई और आवश्यक सामान
- Tea, Coffee & Milk → चाय, कॉफी और दूध
- Personal Care → व्यक्तिगत देखभाल
- Fruits & Vegetables → फल और सब्जियां
- Dairy Products → डेयरी उत्पाद

### Products:
- Britannia Treat Jim Jam → ब्रिटानिया ट्रीट जिम जैम
- Toned Milk → टोन्ड दूध
- Atta (Wheat Flour) → आटा (गेहूं का आटा)
- Basmati Rice → बासमती चावल

## 🚀 Testing

1. Select Hindi in language selection
2. Navigate to Home screen
3. Categories and products should show Hindi names (if added in admin panel)
4. If Hindi name not available, English name will be shown as fallback

## 📌 Important Notes

- Hindi fields are **optional** - if not provided, English names will be used
- The app gracefully falls back to English if Hindi data is missing
- You can add Hindi data gradually - no need to translate everything at once
- Backend restart is required after schema changes
