import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Store, MapPin, Clock, Truck, Phone, Save, Check, Navigation, Edit3, Loader2, Search } from 'lucide-react';

export default function DeliveryManager() {
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [detecting, setDetecting] = useState(false);
    const [searching, setSearching] = useState(false);
    const [isManual, setIsManual] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [settings, setSettings] = useState({
        storeName: '',
        location: {
            address: 'Jungle Ramgarh Urf Chawri, Gorakhpur, UP - 273010',
            latitude: 26.6965,
            longitude: 83.4627,
        },
        storeTimings: {
            openTime: '08:00',
            closeTime: '22:00',
        },
        contactPhone: '',
        serviceRadiusKm: 4,
        estimatedDeliveryMinutes: 10,
        isActive: true,
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:3000/api/v1/settings/store', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data) {
                setSettings({
                    storeName: data.storeName || '',
                    location: data.location || { address: 'Jungle Ramgarh Urf Chawri, Gorakhpur, UP - 273010', latitude: 26.6965, longitude: 83.4627 },
                    storeTimings: data.storeTimings || { openTime: '08:00', closeTime: '22:00' },
                    contactPhone: data.contactPhone || '',
                    serviceRadiusKm: data.serviceRadiusKm || 4,
                    estimatedDeliveryMinutes: data.estimatedDeliveryMinutes || 10,
                    isActive: data.isActive ?? true,
                });
            }
        } catch (error) {
            console.error('Failed to fetch store settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        setDetecting(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const token = localStorage.getItem('adminToken');
                const res = await fetch(`http://localhost:3000/api/v1/maps/reverse-geocode?latitude=${latitude}&longitude=${longitude}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const data = await res.json();

                let address = '';
                if (data?.results && data.results.length > 0) {
                    address = data.results[0].formatted_address || data.results[0].address || '';
                } else if (data?.response?.address) {
                    address = data.response.address;
                }

                setSettings(prev => ({
                    ...prev,
                    location: {
                        address: address || prev.location.address,
                        latitude,
                        longitude
                    }
                }));
                setIsManual(false);
            } catch (error) {
                console.error('Reverse geocoding failed:', error);
                setSettings(prev => ({
                    ...prev,
                    location: {
                        ...prev.location,
                        latitude,
                        longitude
                    }
                }));
            } finally {
                setDetecting(false);
            }
        }, (error) => {
            console.error('Geolocation error:', error);
            setDetecting(false);
            alert('Could not detect your location. Please check browser permissions.');
        }, { enableHighAccuracy: true, timeout: 10000 });
    };

    const handleSearchAddress = async () => {
        if (!searchQuery || searchQuery.trim().length < 3) return;
        setSearching(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`http://localhost:3000/api/v1/maps/geocode?address=${encodeURIComponent(searchQuery)}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                setSettings(prev => ({
                    ...prev,
                    location: {
                        address: result.formattedAddress || searchQuery,
                        latitude: result.latitude || prev.location.latitude,
                        longitude: result.longitude || prev.location.longitude
                    }
                }));
                setIsManual(true);
            } else {
                alert('Location not found. Please try adding city and state.');
            }
        } catch (error) {
            console.error('Geocoding failed:', error);
            alert('Failed to search location. Please check your network.');
        } finally {
            setSearching(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('http://localhost:3000/api/v1/settings/store', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            }
        } catch (error) {
            console.error('Failed to save store settings:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto animate-slide-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Store Settings</h2>
                    <p className="text-gray-500 text-sm mt-0.5">Manage your store's location, timings, and delivery radius</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={handleSave} disabled={saving} className="h-10 px-6 bg-amber-600 hover:bg-amber-700">
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
                                Save Settings
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* General Info */}
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-4 border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Store className="w-5 h-5 text-gray-400" />
                            General Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-4">
                            <div>
                                <p className="font-medium text-gray-900">Store Status</p>
                                <p className="text-sm text-gray-500">{settings.isActive ? 'Accepting orders' : 'Currently closed'}</p>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, isActive: !settings.isActive })}
                                className={`relative w-12 h-6 rounded-full transition-colors ${settings.isActive ? 'bg-amber-500' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.isActive ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Store Name</label>
                            <Input
                                value={settings.storeName}
                                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Contact Phone</label>
                            <div className="relative">
                                <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                                <Input
                                    className="pl-9"
                                    value={settings.contactPhone}
                                    placeholder="+91 9876543210"
                                    onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Operating Timings */}
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-4 border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="w-5 h-5 text-gray-400" />
                            Operating Timings
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Opening Time</label>
                                <Input
                                    type="time"
                                    value={settings.storeTimings.openTime}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        storeTimings: { ...settings.storeTimings, openTime: e.target.value }
                                    })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Closing Time</label>
                                <Input
                                    type="time"
                                    value={settings.storeTimings.closeTime}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        storeTimings: { ...settings.storeTimings, closeTime: e.target.value }
                                    })}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Location */}
                <Card className="border-0 shadow-sm md:col-span-2">
                    <CardHeader className="pb-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-gray-400" />
                            Store Location & Geography
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant={!isManual ? 'default' : 'outline'}
                                size="sm"
                                onClick={handleDetectLocation}
                                disabled={detecting}
                                className={`gap-2 h-9 ${!isManual ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                            >
                                {detecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                                Detect Live
                            </Button>
                            <Button
                                type="button"
                                variant={isManual ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setIsManual(!isManual)}
                                className={`gap-2 h-9 ${isManual ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                {isManual ? 'Manual Mode' : 'Enter Manually'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {/* Search Bar */}
                        <div className="bg-gray-50 border rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Search Address or Pincode</label>
                                <span className="text-[10px] text-gray-400 bg-white px-2 py-0.5 rounded-full border">Smart Geocoding</span>
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <Input
                                        className="pl-9 h-11 bg-white border-gray-200"
                                        placeholder="E.g. UP 273010 Gorakhpur Jungle ramgarh"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearchAddress()}
                                    />
                                </div>
                                <Button
                                    onClick={handleSearchAddress}
                                    disabled={searching}
                                    className="h-11 px-5 bg-gray-900 hover:bg-black gap-2"
                                >
                                    {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    Find
                                </Button>
                            </div>
                            <p className="text-[11px] text-gray-500 italic">Example: "273010 Gorakhpur" or "Indira Nagar, Lucknow"</p>
                        </div>

                        <div className={`transition-all duration-300 ${!isManual ? 'opacity-80' : 'opacity-100'}`}>
                            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Store Full Address</label>
                            <textarea
                                value={settings.location.address}
                                readOnly={!isManual}
                                onChange={(e) => setSettings({
                                    ...settings,
                                    location: { ...settings.location, address: e.target.value }
                                })}
                                className={`w-full px-4 py-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none ${!isManual ? 'bg-gray-50' : 'bg-white'}`}
                                rows={3}
                                placeholder="E.g. 123 Main Street, New Delhi"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-in fade-in duration-300">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Latitude</label>
                                <Input
                                    type="number"
                                    step="any"
                                    readOnly={!isManual}
                                    value={settings.location.latitude}
                                    className={!isManual ? 'bg-gray-50 border-gray-200' : 'bg-white'}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        location: { ...settings.location, latitude: parseFloat(e.target.value) }
                                    })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Longitude</label>
                                <Input
                                    type="number"
                                    step="any"
                                    readOnly={!isManual}
                                    value={settings.location.longitude}
                                    className={!isManual ? 'bg-gray-50 border-gray-200' : 'bg-white'}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        location: { ...settings.location, longitude: parseFloat(e.target.value) }
                                    })}
                                />
                            </div>
                        </div>

                        {!isManual && (
                            <div className="flex items-center gap-3 text-xs text-blue-700 bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-sm">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                    <Navigation className="w-4 h-4" />
                                </div>
                                <span>Detected Coordinates: <strong>{settings.location.latitude.toFixed(6)}, {settings.location.longitude.toFixed(6)}</strong>. These values are used for calculating delivery distancing.</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Delivery Logistics */}
                <Card className="border-0 shadow-sm md:col-span-2">
                    <CardHeader className="pb-4 border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Truck className="w-5 h-5 text-gray-400" />
                            Delivery Logistics
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Service Radius (km)</label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    value={settings.serviceRadiusKm}
                                    onChange={(e) => setSettings({ ...settings, serviceRadiusKm: parseFloat(e.target.value) })}
                                />
                                <p className="text-xs text-gray-500 mt-1">Maximum distance we deliver to.</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Est. Delivery Minutes</label>
                                <Input
                                    type="number"
                                    value={settings.estimatedDeliveryMinutes}
                                    onChange={(e) => setSettings({ ...settings, estimatedDeliveryMinutes: parseInt(e.target.value, 10) })}
                                />
                                <p className="text-xs text-gray-500 mt-1">Default shown to customers.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
