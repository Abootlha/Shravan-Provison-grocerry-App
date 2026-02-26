// Test script to verify API connectivity from admin panel
const API_BASE_URL = 'http://localhost:3000/api/v1';

async function testAPI() {
    console.log('Testing API connection...');
    
    try {
        // Test item-groups endpoint
        console.log('\n1. Testing /item-groups endpoint...');
        const response = await fetch(`${API_BASE_URL}/item-groups`);
        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Item Groups count:', data.itemGroups?.length || 0);
        console.log('First item group:', data.itemGroups?.[0]?.name || 'None');
        
        // Test subcategories endpoint
        console.log('\n2. Testing /subcategories endpoint...');
        const subResponse = await fetch(`${API_BASE_URL}/subcategories`);
        console.log('Status:', subResponse.status);
        const subData = await subResponse.json();
        console.log('Subcategories count:', subData.subcategories?.length || 0);
        
        console.log('\n✅ API connection successful!');
    } catch (error) {
        console.error('\n❌ API connection failed:', error.message);
    }
}

testAPI();
