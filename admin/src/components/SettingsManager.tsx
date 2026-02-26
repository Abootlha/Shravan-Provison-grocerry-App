import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import {
    Settings, Store, Truck, Receipt, FileText, Shield, Bell, Save, Check
} from 'lucide-react';

export default function SettingsManager() {
    const [activeTab, setActiveTab] = useState('general');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Form states
    const [storeSettings, setStoreSettings] = useState({
        storeName: 'ShravanKirana',
        email: 'admin@shravankirana.com',
        phone: '+91 9876543210',
        address: '123 Main Street, City',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
    });

    const [deliverySettings, setDeliverySettings] = useState({
        minOrderValue: '99',
        deliveryFee: '25',
        freeDeliveryAbove: '199',
        maxDeliveryRadius: '5',
        estimatedDeliveryTime: '30',
    });

    const [taxSettings, setTaxSettings] = useState({
        gstNumber: 'GSTIN123456789',
        defaultGst: '18',
        enableGst: true,
    });

    const [returnSettings, setReturnSettings] = useState({
        returnWindow: '7',
        replacementWindow: '24',
        returnPolicy: 'Products can be returned within 7 days of delivery if unopened and in original packaging.',
    });

    const handleSave = async () => {
        setSaving(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                    <p className="text-gray-500 text-sm mt-0.5">Manage your store configuration</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="h-9">
                    {saving ? (
                        <>
                            <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                        </>
                    ) : saved ? (
                        <>
                            <Check className="w-4 h-4 mr-2" />
                            Saved!
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                        </>
                    )}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar Navigation */}
                <div className="lg:col-span-1">
                    <Card className="border-0 shadow-sm sticky top-20">
                        <CardContent className="p-2">
                            <nav className="space-y-1">
                                {[
                                    { id: 'general', label: 'General', icon: Store },
                                    { id: 'delivery', label: 'Delivery', icon: Truck },
                                    { id: 'tax', label: 'Tax & GST', icon: Receipt },
                                    { id: 'returns', label: 'Return Policy', icon: FileText },
                                    { id: 'notifications', label: 'Notifications', icon: Bell },
                                ].map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === item.id
                                                ? 'bg-green-50 text-green-700'
                                                : 'text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </button>
                                ))}
                            </nav>
                        </CardContent>
                    </Card>
                </div>

                {/* Settings Content */}
                <div className="lg:col-span-3 space-y-6">
                    {/* General Settings */}
                    {activeTab === 'general' && (
                        <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-4 border-b">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Store className="w-5 h-5 text-gray-400" />
                                    General Settings
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Store Name</label>
                                        <Input
                                            value={storeSettings.storeName}
                                            onChange={(e) => setStoreSettings({ ...storeSettings, storeName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email</label>
                                        <Input
                                            type="email"
                                            value={storeSettings.email}
                                            onChange={(e) => setStoreSettings({ ...storeSettings, email: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Phone</label>
                                        <Input
                                            value={storeSettings.phone}
                                            onChange={(e) => setStoreSettings({ ...storeSettings, phone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Currency</label>
                                        <select
                                            value={storeSettings.currency}
                                            onChange={(e) => setStoreSettings({ ...storeSettings, currency: e.target.value })}
                                            className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                        >
                                            <option value="INR">INR (₹)</option>
                                            <option value="USD">USD ($)</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Store Address</label>
                                    <textarea
                                        value={storeSettings.address}
                                        onChange={(e) => setStoreSettings({ ...storeSettings, address: e.target.value })}
                                        className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                                        rows={3}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Delivery Settings */}
                    {activeTab === 'delivery' && (
                        <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-4 border-b">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Truck className="w-5 h-5 text-gray-400" />
                                    Delivery Settings
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Minimum Order Value (₹)</label>
                                        <Input
                                            type="number"
                                            value={deliverySettings.minOrderValue}
                                            onChange={(e) => setDeliverySettings({ ...deliverySettings, minOrderValue: e.target.value })}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Minimum order amount to place an order</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Delivery Fee (₹)</label>
                                        <Input
                                            type="number"
                                            value={deliverySettings.deliveryFee}
                                            onChange={(e) => setDeliverySettings({ ...deliverySettings, deliveryFee: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Free Delivery Above (₹)</label>
                                        <Input
                                            type="number"
                                            value={deliverySettings.freeDeliveryAbove}
                                            onChange={(e) => setDeliverySettings({ ...deliverySettings, freeDeliveryAbove: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Max Delivery Radius (km)</label>
                                        <Input
                                            type="number"
                                            value={deliverySettings.maxDeliveryRadius}
                                            onChange={(e) => setDeliverySettings({ ...deliverySettings, maxDeliveryRadius: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Estimated Delivery Time (minutes)</label>
                                        <Input
                                            type="number"
                                            value={deliverySettings.estimatedDeliveryTime}
                                            onChange={(e) => setDeliverySettings({ ...deliverySettings, estimatedDeliveryTime: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Tax Settings */}
                    {activeTab === 'tax' && (
                        <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-4 border-b">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Receipt className="w-5 h-5 text-gray-400" />
                                    Tax & GST Configuration
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-5">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-900">Enable GST</p>
                                        <p className="text-sm text-gray-500">Apply GST to all products</p>
                                    </div>
                                    <button
                                        onClick={() => setTaxSettings({ ...taxSettings, enableGst: !taxSettings.enableGst })}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${taxSettings.enableGst ? 'bg-green-500' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${taxSettings.enableGst ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">GSTIN Number</label>
                                        <Input
                                            value={taxSettings.gstNumber}
                                            onChange={(e) => setTaxSettings({ ...taxSettings, gstNumber: e.target.value })}
                                            placeholder="Enter your GSTIN"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Default GST Rate (%)</label>
                                        <select
                                            value={taxSettings.defaultGst}
                                            onChange={(e) => setTaxSettings({ ...taxSettings, defaultGst: e.target.value })}
                                            className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                        >
                                            <option value="5">5%</option>
                                            <option value="12">12%</option>
                                            <option value="18">18%</option>
                                            <option value="28">28%</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <p className="text-sm text-yellow-800">
                                        <strong>Note:</strong> GST rates can be overridden at the product level. The default rate applies to products without a specific GST setting.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Return Policy Settings */}
                    {activeTab === 'returns' && (
                        <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-4 border-b">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-gray-400" />
                                    Return & Replacement Policy
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Return Window (days)</label>
                                        <Input
                                            type="number"
                                            value={returnSettings.returnWindow}
                                            onChange={(e) => setReturnSettings({ ...returnSettings, returnWindow: e.target.value })}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Days allowed for product return after delivery</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Replacement Window (hours)</label>
                                        <Input
                                            type="number"
                                            value={returnSettings.replacementWindow}
                                            onChange={(e) => setReturnSettings({ ...returnSettings, replacementWindow: e.target.value })}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Hours allowed for requesting replacement</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Return Policy Text</label>
                                    <textarea
                                        value={returnSettings.returnPolicy}
                                        onChange={(e) => setReturnSettings({ ...returnSettings, returnPolicy: e.target.value })}
                                        className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                                        rows={4}
                                        placeholder="Enter your return policy..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">This will be displayed to customers on the app</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Notification Settings */}
                    {activeTab === 'notifications' && (
                        <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-4 border-b">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-gray-400" />
                                    Notification Preferences
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                {[
                                    { id: 'newOrder', label: 'New Order Alerts', desc: 'Get notified when a new order is placed', enabled: true },
                                    { id: 'lowStock', label: 'Low Stock Alerts', desc: 'Get notified when products are running low', enabled: true },
                                    { id: 'orderStatus', label: 'Order Status Updates', desc: 'Get notified on order status changes', enabled: false },
                                    { id: 'dailyReport', label: 'Daily Sales Report', desc: 'Receive daily sales summary via email', enabled: true },
                                ].map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-900">{item.label}</p>
                                            <p className="text-sm text-gray-500">{item.desc}</p>
                                        </div>
                                        <button
                                            className={`relative w-12 h-6 rounded-full transition-colors ${item.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${item.enabled ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
