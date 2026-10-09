const mongoose = require('mongoose');

// Assuming you know the DB URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shravankirana'; // Update this if needed

async function testUpdate() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to DB');

    try {
        const orderModel = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
        const order = await orderModel.findOne({ orderStatus: 'CONFIRMED' }).lean();

        if (!order) {
            console.log('No order found');
            return;
        }

        console.log('Found order:', order._id);

        // Attempt the equivalent validation or save
        // but better yet, let's just use the NestJS app ctx
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

testUpdate();
