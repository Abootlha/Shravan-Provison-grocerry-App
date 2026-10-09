const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb+srv://Shravan-store:cAYSMJFWDVVmbmeV@cluster0.lgexhhq.mongodb.net/test');
  const userModel = mongoose.model('User', new mongoose.Schema({ phone: String, role: String }));
  const admin = await userModel.findOne({ role: 'admin' });
  
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
  
  const order = orders.find(o => o.orderStatus === 'CONFIRMED') || orders[0];
  const targetStatus = order.orderStatus === 'PENDING' ? 'CONFIRMED' : 'PACKED';
  
  const updateRes = await fetch(`http://localhost:3000/api/v1/admin/orders/${order._id}/status`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus, note: 'test' })
  });
  
  const text = await updateRes.text();
  console.log("Status:", updateRes.status);
  console.log("Body:", text);
}

test().catch(console.error).finally(() => process.exit(0));
