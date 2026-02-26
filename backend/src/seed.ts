import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function seed() {
    const app = await NestFactory.createApplicationContext(AppModule);

    // Get models
    const categoryModel = app.get(getModelToken('Category'));
    const productModel = app.get(getModelToken('Product'));
    const userModel = app.get(getModelToken('User'));

    console.log('🌱 Starting seed...');

    // Clear existing data
    await categoryModel.deleteMany({});
    await productModel.deleteMany({});

    console.log('✅ Cleared existing data');

    // Create categories
    const categories = await categoryModel.insertMany([
        { name: 'Fruits & Vegetables', icon: 'fruit-watermelon', color: '#4CAF50', isActive: true, sortOrder: 1 },
        { name: 'Dairy & Breakfast', icon: 'egg', color: '#FFC107', isActive: true, sortOrder: 2 },
        { name: 'Munchies', icon: 'cookie', color: '#FF9800', isActive: true, sortOrder: 3 },
        { name: 'Cold Drinks & Juices', icon: 'bottle-soda', color: '#2196F3', isActive: true, sortOrder: 4 },
        { name: 'Instant & Frozen Food', icon: 'food-fork-drink', color: '#9C27B0', isActive: true, sortOrder: 5 },
        { name: 'Tea, Coffee & Health', icon: 'coffee', color: '#795548', isActive: true, sortOrder: 6 },
        { name: 'Bakery & Biscuits', icon: 'bread-slice', color: '#E91E63', isActive: true, sortOrder: 7 },
        { name: 'Sweet Tooth', icon: 'candy', color: '#F44336', isActive: true, sortOrder: 8 },
        { name: 'Atta, Rice & Dal', icon: 'sack', color: '#8BC34A', isActive: true, sortOrder: 9 },
        { name: 'Masala & Dry Fruits', icon: 'leaf', color: '#FF5722', isActive: true, sortOrder: 10 },
        { name: 'Cleaning Essentials', icon: 'spray-bottle', color: '#00BCD4', isActive: true, sortOrder: 11 },
        { name: 'Personal Care', icon: 'face-woman', color: '#673AB7', isActive: true, sortOrder: 12 },
    ]);
    console.log(`✅ Created ${categories.length} categories`);

    // Create products for each category
    const productTemplates = [
        // Fruits & Vegetables
        { name: 'Fresh Bananas', price: 45, originalPrice: 55, unit: '1 dozen', stock: 100, rating: 4.5, image: 'https://via.placeholder.com/150' },
        { name: 'Red Apples', price: 180, originalPrice: 200, unit: '1 kg', stock: 50, rating: 4.3, image: 'https://via.placeholder.com/150' },
        { name: 'Fresh Tomatoes', price: 35, originalPrice: 40, unit: '500 g', stock: 80, rating: 4.2, image: 'https://via.placeholder.com/150' },
        { name: 'Green Capsicum', price: 60, originalPrice: 70, unit: '250 g', stock: 40, rating: 4.0, image: 'https://via.placeholder.com/150' },
        { name: 'Onions', price: 30, originalPrice: 35, unit: '1 kg', stock: 150, rating: 4.4, image: 'https://via.placeholder.com/150' },
        // Dairy
        { name: 'Amul Milk', price: 30, originalPrice: 32, unit: '500 ml', stock: 200, rating: 4.8, image: 'https://via.placeholder.com/150' },
        { name: 'Amul Butter', price: 55, originalPrice: 58, unit: '100 g', stock: 100, rating: 4.7, image: 'https://via.placeholder.com/150' },
        { name: 'Curd', price: 40, originalPrice: 45, unit: '400 g', stock: 80, rating: 4.5, image: 'https://via.placeholder.com/150' },
        { name: 'Paneer', price: 90, originalPrice: 100, unit: '200 g', stock: 60, rating: 4.6, image: 'https://via.placeholder.com/150' },
        { name: 'Eggs', price: 75, originalPrice: 80, unit: '6 pcs', stock: 120, rating: 4.4, image: 'https://via.placeholder.com/150' },
        // Munchies
        { name: 'Lays Chips', price: 20, originalPrice: 20, unit: '52 g', stock: 200, rating: 4.3, image: 'https://via.placeholder.com/150' },
        { name: 'Kurkure', price: 20, originalPrice: 20, unit: '90 g', stock: 180, rating: 4.2, image: 'https://via.placeholder.com/150' },
        { name: 'Haldirams Bhujia', price: 85, originalPrice: 90, unit: '200 g', stock: 100, rating: 4.5, image: 'https://via.placeholder.com/150' },
        { name: 'Pringles', price: 150, originalPrice: 160, unit: '107 g', stock: 50, rating: 4.6, image: 'https://via.placeholder.com/150' },
        // Cold Drinks
        { name: 'Coca Cola', price: 40, originalPrice: 40, unit: '750 ml', stock: 150, rating: 4.5, image: 'https://via.placeholder.com/150' },
        { name: 'Pepsi', price: 40, originalPrice: 40, unit: '750 ml', stock: 140, rating: 4.4, image: 'https://via.placeholder.com/150' },
        { name: 'Real Mango Juice', price: 90, originalPrice: 99, unit: '1 L', stock: 80, rating: 4.3, image: 'https://via.placeholder.com/150' },
        { name: 'Red Bull', price: 125, originalPrice: 125, unit: '250 ml', stock: 60, rating: 4.5, image: 'https://via.placeholder.com/150' },
        // Instant Food
        { name: 'Maggi Noodles', price: 14, originalPrice: 14, unit: '70 g', stock: 300, rating: 4.7, image: 'https://via.placeholder.com/150' },
        { name: 'MTR Ready to Eat', price: 85, originalPrice: 95, unit: '300 g', stock: 60, rating: 4.2, image: 'https://via.placeholder.com/150' },
        // Tea & Coffee
        { name: 'Tata Tea Gold', price: 180, originalPrice: 195, unit: '250 g', stock: 80, rating: 4.6, image: 'https://via.placeholder.com/150' },
        { name: 'Nescafe Classic', price: 350, originalPrice: 375, unit: '200 g', stock: 50, rating: 4.5, image: 'https://via.placeholder.com/150' },
        // Bakery
        { name: 'Britannia Bread', price: 45, originalPrice: 45, unit: '400 g', stock: 100, rating: 4.3, image: 'https://via.placeholder.com/150' },
        { name: 'Parle-G Biscuits', price: 10, originalPrice: 10, unit: '80 g', stock: 250, rating: 4.8, image: 'https://via.placeholder.com/150' },
        // Atta & Rice
        { name: 'Aashirvaad Atta', price: 280, originalPrice: 300, unit: '5 kg', stock: 40, rating: 4.7, image: 'https://via.placeholder.com/150' },
        { name: 'India Gate Basmati', price: 450, originalPrice: 480, unit: '5 kg', stock: 30, rating: 4.6, image: 'https://via.placeholder.com/150' },
        { name: 'Toor Dal', price: 160, originalPrice: 175, unit: '1 kg', stock: 60, rating: 4.4, image: 'https://via.placeholder.com/150' },
        // Masala
        { name: 'MDH Garam Masala', price: 85, originalPrice: 90, unit: '100 g', stock: 80, rating: 4.5, image: 'https://via.placeholder.com/150' },
        { name: 'Almonds', price: 250, originalPrice: 280, unit: '200 g', stock: 40, rating: 4.7, image: 'https://via.placeholder.com/150' },
        { name: 'Cashews', price: 320, originalPrice: 350, unit: '200 g', stock: 35, rating: 4.6, image: 'https://via.placeholder.com/150' },
        // Cleaning
        { name: 'Surf Excel', price: 260, originalPrice: 280, unit: '1 kg', stock: 70, rating: 4.5, image: 'https://via.placeholder.com/150' },
        { name: 'Vim Dishwash', price: 95, originalPrice: 100, unit: '500 ml', stock: 90, rating: 4.3, image: 'https://via.placeholder.com/150' },
        // Personal Care
        { name: 'Colgate Toothpaste', price: 110, originalPrice: 120, unit: '150 g', stock: 100, rating: 4.6, image: 'https://via.placeholder.com/150' },
        { name: 'Dettol Soap', price: 45, originalPrice: 48, unit: '125 g', stock: 120, rating: 4.4, image: 'https://via.placeholder.com/150' },
    ];

    // Assign products to categories (distribute them)
    const products = [];
    let catIndex = 0;
    for (const template of productTemplates) {
        products.push({
            ...template,
            categoryId: categories[catIndex % categories.length]._id,
            isAvailable: true,
            reviewCount: Math.floor(Math.random() * 500) + 50,
            soldCount: Math.floor(Math.random() * 1000) + 100,
        });
        catIndex++;
    }

    await productModel.insertMany(products);
    console.log(`✅ Created ${products.length} products`);

    // Create or update admin user
    await userModel.findOneAndUpdate(
        { phone: '9999999999' },
        {
            name: 'Admin User',
            phone: '9999999999',
            email: 'admin@shravankirana.com',
            role: 'admin',
            addresses: [{
                type: 'office',
                address: '123 Admin Street',
                city: 'Mumbai',
                pincode: '400001',
                isDefault: true,
            }],
        },
        { upsert: true, new: true }
    );
    console.log('✅ Admin user ready (phone: 9999999999, role: admin)');

    console.log('\n🎉 Seed completed successfully!');
    console.log('Admin login: Phone 9999999999, any 6-digit OTP');

    await app.close();
}

seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
