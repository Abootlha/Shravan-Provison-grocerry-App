import { useState } from 'react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { User, Lock, ArrowRight, ShoppingCart } from 'lucide-react';

export default function LoginForm() {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await fetch('http://localhost:3000/api/v1/auth/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                throw new Error('Invalid credentials');
            }

            const data = await response.json();
            
            // Store token and user info in localStorage
            localStorage.setItem('adminToken', data.accessToken);
            localStorage.setItem('adminUser', JSON.stringify(data.user));
            localStorage.setItem('adminRefreshToken', data.refreshToken);
            localStorage.setItem('adminLoginTime', Date.now().toString());
            
            // Redirect to dashboard
            window.location.href = '/';
        } catch (err) {
            setError('Invalid username or password');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30 mb-4">
                        <ShoppingCart className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        ShravanKirana
                    </h1>
                    <p className="text-gray-500 mt-1">Admin Console</p>
                </div>

                <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
                    <CardHeader className="text-center pb-2">
                        <CardTitle className="text-xl">Welcome Back</CardTitle>
                        <CardDescription>Sign in to your admin account</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm font-medium border border-red-100">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Username</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="pl-11 h-12"
                                        placeholder="Enter username"
                                        required
                                        autoComplete="username"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-11 h-12"
                                        placeholder="Enter password"
                                        required
                                        autoComplete="current-password"
                                    />
                                </div>
                            </div>
                            <Button type="submit" disabled={loading} className="w-full h-12 text-base">
                                {loading ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                                ) : (
                                    <>Sign In <ArrowRight className="w-5 h-5 ml-2" /></>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Demo Credentials */}
                <div className="mt-6 p-4 rounded-xl bg-white/60 backdrop-blur border border-gray-100 text-sm">
                    <p className="font-semibold text-gray-700 mb-2">🔐 Default Credentials</p>
                    <div className="space-y-1 text-gray-600">
                        <p><span className="font-medium">Username:</span> admin</p>
                        <p><span className="font-medium">Password:</span> admin123</p>
                        <p className="text-xs text-amber-600 mt-2">⚠️ Please change password after first login</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
