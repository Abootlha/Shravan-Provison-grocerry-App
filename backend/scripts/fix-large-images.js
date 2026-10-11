/**
 * Script to identify and fix subcategories with large base64 images
 * Read-only: reports offenders, does not modify data.
 * Run from backend/: MONGODB_URI=<uri> node scripts/fix-large-images.js
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set. Example: MONGODB_URI=mongodb://localhost:27017/shravankirana node scripts/fix-large-images.js');
    process.exit(1);
}

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

// Define Subcategory schema
const SubcategorySchema = new mongoose.Schema({
    name: String,
    icon: String,
    color: String,
    parentId: mongoose.Schema.Types.ObjectId,
    isActive: Boolean,
    sortOrder: Number,
    description: String,
}, { timestamps: true });

const Subcategory = mongoose.model('Subcategory', SubcategorySchema);

async function fixLargeImages() {
    try {
        console.log('\n🔍 Scanning for subcategories with large base64 images...\n');

        const subcategories = await Subcategory.find({});
        let foundIssues = 0;

        for (const subcat of subcategories) {
            if (subcat.icon && subcat.icon.startsWith('data:image/')) {
                const sizeKB = Math.round(subcat.icon.length / 1024);
                
                if (sizeKB > 100) {
                    foundIssues++;
                    console.log(`⚠️  ${subcat.name}`);
                    console.log(`   ID: ${subcat._id}`);
                    console.log(`   Size: ${sizeKB}KB (${subcat.icon.length} characters)`);
                    console.log(`   Status: TOO LARGE - React Native cannot handle this`);
                    console.log(`   Solution: Replace with URL or upload smaller image\n`);
                }
            }
        }

        if (foundIssues === 0) {
            console.log('✅ No issues found! All images are within acceptable size limits.\n');
        } else {
            console.log(`\n📋 Summary: Found ${foundIssues} subcategory(ies) with large images\n`);
            console.log('🔧 To fix:');
            console.log('   1. Open the admin panel > Subcategories');
            console.log('   2. Edit the subcategory listed above');
            console.log('   3. Either:');
            console.log('      - Switch to "Image URL" tab and paste a URL');
            console.log('      - Upload a new smaller image (will auto-compress)');
            console.log('   4. Save changes\n');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('👋 Disconnected from MongoDB');
    }
}

// Run the script
fixLargeImages();
