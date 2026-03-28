const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/shravankirana');
  const userModel = mongoose.model('User', new mongoose.Schema({ phone: String, role: String }));
  const admin = await userModel.findOne({ role: 'admin' });
  if (!admin) throw new Error("No admin found");
  
  const loginRes = await fetch('http://localhost:3000/api/v1/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: admin.phone, otp: '123456' })
  });
  const { token } = await loginRes.json();
  
  const ordersRes = await fetch('http://localhost:3000/api/v1/admin/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
  });
  const { orders } = await ordersRes.json();
  if (!orders || orders.length === 0) throw new Error("No orders found");
  
  const order = orders[0];
  const targetStatus = order.orderStatus === 'PENDING' ? 'CONFIRMED' : 'PACKED';
  
  console.log(`Updating ${order._id} from ${order.orderStatus} to ${targetStatus}`);
  
  const updateRes = await fetch(`http://localhost:3000/api/v1/admin/orders/${order._id}/status`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus, note: 'test' })
  });
  console.log("Status:", updateRes.status);
  console.log("Body:", await updateRes.text());
}

test().catch(console.error).finally(() => process.exit(0));
