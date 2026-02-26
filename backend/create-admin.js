const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createAdminUser() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shravankirana';

    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);

    const User = mongoose.model('User', new mongoose.Schema({
        name: String,
        phone: { type: String, unique: true, sparse: true },
        username: { type: String, unique: true, sparse: true },
        password: String,
        email: String,
        role: { type: String, default: 'customer' },
        addresses: Array,
        isActive: { type: Boolean, default: true },
    }, { timestamps: true }));

    const username = 'admin';
    const password = 'admin123';
    const phone = '9999999999';

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Try to find existing user by username or phone
        let user = await User.findOne({ $or: [{ username }, { phone }] });

        if (user) {
            // Update to admin with password
            user.role = 'admin';
            user.name = 'Admin User';
            user.username = username;
            user.password = hashedPassword;
            user.phone = phone;
            await user.save();
            console.log(`Updated user to admin role`);
        } else {
            // Create new admin user
            user = await User.create({
                name: 'Admin User',
                username,
                password: hashedPassword,
                phone,
                role: 'admin',
                isActive: true,
            });
            console.log(`Created admin user`);
        }

        console.log('Admin credentials:');
        console.log(`  Username: ${username}`);
        console.log(`  Password: ${password}`);
        console.log(`  Phone: ${phone}`);
    } catch (error) {
        console.error('Error:', error.message);
    }

    await mongoose.disconnect();
    console.log('Done!');
}

createAdminUser().catch(console.error);
