const mongoose = require('mongoose');
require('dotenv').config();

async function checkOrders() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const db = mongoose.connection.db;
        const orders = await db.collection('orders').find({}).toArray();

        console.log(`Found ${orders.length} total orders in DB.`);

        if (orders.length > 0) {
            console.log('\n--- Status Breakdown ---');
            const statusCounts = {};
            orders.forEach(o => {
                statusCounts[o.orderStatus] = (statusCounts[o.orderStatus] || 0) + 1;
            });
            console.log(statusCounts);

            console.log('\n--- Sample Order ---');
            console.log(JSON.stringify(orders[0], null, 2));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkOrders();
