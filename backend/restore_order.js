const mongoose = require('mongoose');
require('dotenv').config();

async function restoreOrder() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;

        const result = await db.collection('orders').updateOne(
            { orderStatus: 'CANCELLED', cancellationReason: 'AUTO_CANCELLED_STALE' },
            {
                $set: {
                    orderStatus: 'PENDING',
                    updatedAt: new Date(),
                    createdAt: new Date()
                },
                $unset: { cancellationReason: "" }
            }
        );

        console.log(`Restored ${result.modifiedCount} order(s) back to PENDING.`);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

restoreOrder();
