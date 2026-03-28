async function test() {
    try {
        // 1. Get token
        const loginRes = await fetch('http://localhost:3000/api/v1/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '9696834539', otp: '123456' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token || loginData.access_token || loginData.accessToken;
        // console.log("Login:", token);
        
        // 2. Get orders
        const ordersRes = await fetch('http://localhost:3000/api/v1/admin/orders', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const ordersData = await ordersRes.json();
        // console.log("Orders count:", ordersData.orders?.length);
        if (!ordersData.orders || ordersData.orders.length === 0) { console.log("No orders"); return;}
        
        // 3. Try update
        const order = ordersData.orders[0];
        const targetStatus = order.orderStatus === 'PENDING' ? 'CONFIRMED' : 'PACKED';
        
        console.log(`Trying to update order ${order._id} from ${order.orderStatus} to ${targetStatus}`);
        
        const updateRes = await fetch(`http://localhost:3000/api/v1/admin/orders/${order._id}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: targetStatus, note: 'test admin note' })
        });
        
        console.log("Update status:", updateRes.status);
        console.log("Update response:", await updateRes.text());
    } catch(e) {
        console.error(e);
    }
}

test();
