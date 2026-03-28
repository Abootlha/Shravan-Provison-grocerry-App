import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Mail, Lock, ArrowRight, ShoppingCart } from 'lucide-react';

export default function LoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const API_BASE_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:8001';
            const response = await fetch(`${API_BASE_URL}/auth/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Invalid credentials');
            }

            const data = await response.json();
            
            localStorage.setItem('adminToken', data.accessToken);
            localStorage.setItem('adminUser', JSON.stringify(data.user));
            localStorage.setItem('adminRefreshToken', data.refreshToken);
            localStorage.setItem('adminLoginTime', Date.now().toString());
            
            window.location.href = '/';
        } catch (err: any) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div 
                        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-lg mb-4"
                        style={{ background: 'var(--accent-gradient)' }}
                    >
                        <ShoppingCart className="w-8 h-8" style={{ color: 'var(--bg-primary)' }} />
                    </div>
                    <h1 
                        className="text-2xl font-bold"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        ShravanKirana
                    </h1>
                    <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Admin Console</p>
                </div>

                <Card className="shadow-xl" style={{ 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border)' 
                }}>
                    <CardHeader className="text-center pb-2">
                        <CardTitle className="text-xl" style={{ color: 'var(--text-primary)' }}>
                            Admin Login
                        </CardTitle>
                        <CardDescription style={{ color: 'var(--text-muted)' }}>
                            Enter your credentials to access the admin panel
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {error && (
                            <div 
                                className="px-4 py-3 rounded-lg mb-4 text-sm font-medium"
                                style={{ 
                                    background: 'var(--danger-light)', 
                                    color: 'var(--danger)',
                                    border: '1px solid var(--danger)'
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label 
                                    className="text-sm font-medium mb-2 block" 
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    Username / Email
                                </label>
                                <div className="relative">
                                    <Mail 
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" 
                                        style={{ color: 'var(--text-muted)' }} 
                                    />
                                    <Input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="pl-11 h-12"
                                        placeholder="Enter username or email"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label 
                                    className="text-sm font-medium mb-2 block" 
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock 
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" 
                                        style={{ color: 'var(--text-muted)' }} 
                                    />
                                    <Input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-11 h-12"
                                        placeholder="Enter password"
                                        required
                                    />
                                </div>
                            </div>

                            <Button 
                                type="submit" 
                                disabled={loading} 
                                className="w-full h-12 text-base"
                                style={{ 
                                    background: 'var(--accent-gradient)',
                                    color: 'var(--bg-primary)'
                                }}
                            >
                                {loading ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--bg-primary)] border-t-transparent" />
                                ) : (
                                    <>Login <ArrowRight className="w-5 h-5 ml-2" /></>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Demo Credentials */}
                <div 
                    className="mt-6 p-4 rounded-xl text-sm"
                    style={{ 
                        background: 'var(--bg-secondary)', 
                        border: '1px solid var(--border)' 
                    }}
                >
                    <p className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                        Demo Credentials
                    </p>
                    <div className="space-y-1" style={{ color: 'var(--text-muted)' }}>
                        <p><span className="font-medium">Username:</span> admin</p>
                        <p><span className="font-medium">Password:</span> admin123</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
