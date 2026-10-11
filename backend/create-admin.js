/**
 * Create or promote an admin user.
 *
 * Usage:
 *   ADMIN_PASSWORD='<strong password>' node create-admin.js [username] [phone] [name]
 *   node create-admin.js --username admin --phone 9999999999 --password '<strong password>'
 *
 * Values are read from CLI flags first, then positional args, then env vars
 * (ADMIN_USERNAME, ADMIN_PHONE, ADMIN_PASSWORD, ADMIN_NAME). Prefer the env var
 * for the password so it does not end up in shell history.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const MIN_PASSWORD_LENGTH = 12;

function parseArgs(argv) {
    const flags = {};
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const [key, inlineValue] = arg.slice(2).split('=');
            flags[key] = inlineValue !== undefined ? inlineValue : argv[++i];
        } else {
            positional.push(arg);
        }
    }
    return { flags, positional };
}

async function createAdminUser() {
    const { flags, positional } = parseArgs(process.argv.slice(2));

    const username = flags.username || positional[0] || process.env.ADMIN_USERNAME || 'admin';
    const phone = flags.phone || positional[1] || process.env.ADMIN_PHONE;
    const name = flags.name || positional[2] || process.env.ADMIN_NAME || 'Admin User';
    const password = flags.password || process.env.ADMIN_PASSWORD;

    if (!password) {
        console.error('Refusing to run: no password given. Set ADMIN_PASSWORD or pass --password.');
        process.exit(1);
    }
    if (password.length < MIN_PASSWORD_LENGTH || password === 'admin123') {
        console.error(`Refusing to run: password must be at least ${MIN_PASSWORD_LENGTH} characters and not a default value.`);
        process.exit(1);
    }

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

    try {
        const hashedPassword = await bcrypt.hash(password, 12);

        const query = phone ? { $or: [{ username }, { phone }] } : { username };
        let user = await User.findOne(query);

        if (user) {
            user.role = 'admin';
            user.name = name;
            user.username = username;
            user.password = hashedPassword;
            if (phone) user.phone = phone;
            user.isActive = true;
            await user.save();
            console.log('Updated user to admin role');
        } else {
            user = await User.create({
                name,
                username,
                password: hashedPassword,
                ...(phone ? { phone } : {}),
                role: 'admin',
                isActive: true,
            });
            console.log('Created admin user');
        }

        console.log(`Admin username: ${username}${phone ? ` (phone ${phone})` : ''}`);
    } catch (error) {
        console.error('Error:', error.message);
        process.exitCode = 1;
    }

    await mongoose.disconnect();
    console.log('Done!');
}

createAdminUser().catch((error) => {
    console.error(error);
    process.exit(1);
});
