import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderTrackingManager from './OrderTrackingManager';
import { api } from '../lib/api';

// Mock the API
vi.mock('../lib/api', () => ({
    api: {
        getOrders: vi.fn(),
        getAvailableRiders: vi.fn(),
        updateOrderStatus: vi.fn(),
        assignRider: vi.fn(),
    }
}));

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
    io: vi.fn(() => ({
        on: vi.fn(),
        emit: vi.fn(),
        disconnect: vi.fn(),
        connected: false,
    }))
}));

// Mock the map component
vi.mock('./RiderTrackingMap', () => ({
    default: () => <div data-testid="rider-map">Map</div>
}));

const mockOrders = [
    {
        _id: '1',
        orderId: 'ORD-001',
        userId: { _id: 'u1', name: 'John Doe', phone: '1234567890' },
        items: [{ productId: { name: 'Product 1' }, name: 'Product 1', quantity: 2, price: 100 }],
        totalAmount: 200,
        orderStatus: 'PENDING',
        createdAt: new Date().toISOString(),
        deliveryAddress: {
            type: 'home',
            address: '123 Main St',
            city: 'Delhi',
            pincode: '110001',
            coordinates: { type: 'Point', coordinates: [77.2090, 28.6139] }
        }
    },
    {
        _id: '2',
        orderId: 'ORD-002',
        userId: { _id: 'u2', name: 'Jane Smith', phone: '0987654321' },
        items: [{ productId: { name: 'Product 2' }, name: 'Product 2', quantity: 1, price: 150 }],
        totalAmount: 150,
        orderStatus: 'CONFIRMED',
        createdAt: new Date().toISOString(),
        deliveryAddress: {
            type: 'office',
            address: '456 Park Ave',
            city: 'Mumbai',
            pincode: '400001',
            coordinates: { type: 'Point', coordinates: [72.8777, 19.0760] }
        }
    },
    {
        _id: '3',
        orderId: 'ORD-003',
        userId: { _id: 'u3', name: 'Bob Johnson', phone: '5555555555' },
        items: [{ productId: { name: 'Product 3' }, name: 'Product 3', quantity: 3, price: 50 }],
        totalAmount: 150,
        orderStatus: 'OUT_FOR_DELIVERY',
        createdAt: new Date().toISOString(),
        deliveryAddress: {
            type: 'home',
            address: '789 Oak Rd',
            city: 'Bangalore',
            pincode: '560001',
            coordinates: { type: 'Point', coordinates: [77.5946, 12.9716] }
        }
    }
];

const mockRiders = [
    {
        _id: 'r1',
        name: 'Rider One',
        phone: '1111111111',
        isAvailable: true,
        isOnline: true,
        currentLocation: {
            type: 'Point',
            coordinates: [77.2090, 28.6139]
        }
    },
    {
        _id: 'r2',
        name: 'Rider Two',
        phone: '2222222222',
        isAvailable: true,
        isOnline: false,
        currentLocation: {
            type: 'Point',
            coordinates: [72.8777, 19.0760]
        }
    }
];

describe('OrderTrackingManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (api.getOrders as any).mockResolvedValue({
            orders: mockOrders,
            pagination: { pages: 1 }
        });
        (api.getAvailableRiders as any).mockResolvedValue({
            riders: mockRiders
        });
    });

    describe('Order Filtering', () => {
        it('should display all orders by default', async () => {
            render(<OrderTrackingManager />);

            await waitFor(() => {
                expect(screen.getByText('ORD-001')).toBeInTheDocument();
                expect(screen.getByText('ORD-002')).toBeInTheDocument();
                expect(screen.getByText('ORD-003')).toBeInTheDocument();
            });
        });

        it('should filter orders by status when status filter is clicked', async () => {
            const user = userEvent.setup();
            (api.getOrders as any).mockResolvedValueOnce({
                orders: mockOrders,
                pagination: { pages: 1 }
            }).mockResolvedValueOnce({
                orders: mockOrders.filter(o => o.orderStatus === 'PENDING'),
                pagination: { pages: 1 }
            });

            render(<OrderTrackingManager />);

            await waitFor(() => {
                expect(screen.getByText('ORD-001')).toBeInTheDocument();
            });

            // Click on PENDING filter
            const pendingButton = screen.getByRole('button', { name: /Pending/i });
            await user.click(pendingButton);

            await waitFor(() => {
                expect(api.getOrders).toHaveBeenCalledWith({ page: 1, status: 'PENDING' });
            });
        });

        it('should filter orders by search term', async () => {
            const user = userEvent.setup();
            render(<OrderTrackingManager />);

            await waitFor(() => {
                expect(screen.getByText('ORD-001')).toBeInTheDocument();
            });

            // Search for specific order
            const searchInput = screen.getByPlaceholderText(/Search by order ID or customer/i);
            await user.type(searchInput, 'ORD-002');

            await waitFor(() => {
                expect(screen.getByText('ORD-002')).toBeInTheDocument();
                expect(screen.queryByText('ORD-001')).not.toBeInTheDocument();
                expect(screen.queryByText('ORD-003')).not.toBeInTheDocument();
            });
        });

        it('should filter orders by customer name', async () => {
            const user = userEvent.setup();
            render(<OrderTrackingManager />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });

            // Search for customer name
            const searchInput = screen.getByPlaceholderText(/Search by order ID or customer/i);
            await user.type(searchInput, 'Jane');

            await waitFor(() => {
                expect(screen.getByText('Jane Smith')).toBeInTheDocument();
                expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
                expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
            });
        });

        it('should show correct status counts', async () => {
            render(<OrderTrackingManager />);

            await waitFor(() => {
                // Check that the All button contains both "All" and "3"
                const allButton = screen.getByRole('button', { name: /All/i });
                expect(allButton).toBeInTheDocument();
                expect(allButton.textContent).toContain('3');
                
                // Check that Pending button exists and contains "1"
                const pendingButton = screen.getByRole('button', { name: /Pending/i });
                expect(pendingButton).toBeInTheDocument();
                expect(pendingButton.textContent).toContain('1');
            });
        });

        it('should reset to page 1 when changing filters', async () => {
            const user = userEvent.setup();
            render(<OrderTrackingManager />);

            await waitFor(() => {
                expect(screen.getByText('ORD-001')).toBeInTheDocument();
            });

            // Click on CONFIRMED filter
            const confirmedButton = screen.getByRole('button', { name: /Confirmed/i });
            await user.click(confirmedButton);

            await waitFor(() => {
                expect(api.getOrders).toHaveBeenCalledWith({ page: 1, status: 'CONFIRMED' });
            });
        });
    });

    describe('Admin Actions', () => {
        it('should call API to update order status', async () => {
            const user = userEvent.setup();
            (api.updateOrderStatus as any).mockResolvedValue({ order: { ...mockOrders[0], orderStatus: 'CONFIRMED' } });

            render(<OrderTrackingManager />);

            await waitFor(() => {
                expect(screen.getByText('ORD-001')).toBeInTheDocument();
            });

            // Click on order to open detail drawer
            const viewButton = screen.getAllByRole('button', { name: /view/i })[0];
            await user.click(viewButton);

            await waitFor(() => {
                expect(screen.getByText('Order ORD-001')).toBeInTheDocument();
            });

            // Click on CONFIRMED status button in the drawer (use getAllByRole and get the last one)
            const confirmedButtons = screen.getAllByRole('button', { name: /Confirmed/i });
            const confirmedButton = confirmedButtons[confirmedButtons.length - 1];
            await user.click(confirmedButton);

            await waitFor(() => {
                expect(api.updateOrderStatus).toHaveBeenCalledWith('1', 'CONFIRMED');
            });
        });

        it('should call API to assign rider to order', async () => {
            const user = userEvent.setup();
            (api.assignRider as any).mockResolvedValue({ order: { ...mockOrders[0], riderId: mockRiders[0] } });

            render(<OrderTrackingManager />);

            await waitFor(() => {
                expect(screen.getByText('ORD-001')).toBeInTheDocument();
            });

            // Click on order to open detail drawer
            const viewButton = screen.getAllByRole('button', { name: /view/i })[0];
            await user.click(viewButton);

            await waitFor(() => {
                expect(screen.getByText('Order ORD-001')).toBeInTheDocument();
            });

            // Click on rider to assign
            const riderButton = screen.getByText('Rider One');
            await user.click(riderButton);

            await waitFor(() => {
                expect(api.assignRider).toHaveBeenCalledWith('1', 'r1');
            });
        });

        it('should refresh orders when refresh button is clicked', async () => {
            const user = userEvent.setup();
            render(<OrderTrackingManager />);

            await waitFor(() => {
                expect(screen.getByText('ORD-001')).toBeInTheDocument();
            });

            // Clear previous calls
            vi.clearAllMocks();

            // Click refresh button
            const refreshButton = screen.getByRole('button', { name: /Refresh/i });
            await user.click(refreshButton);

            await waitFor(() => {
                expect(api.getOrders).toHaveBeenCalled();
                expect(api.getAvailableRiders).toHaveBeenCalled();
            });
        });

        it('should not show rider assignment for delivered orders', async () => {
            const user = userEvent.setup();
            const deliveredOrder = { ...mockOrders[2], orderStatus: 'DELIVERED' };
            (api.getOrders as any).mockResolvedValue({
                orders: [deliveredOrder],
                pagination: { pages: 1 }
            });

            render(<OrderTrackingManager />);

            await waitFor(() => {
                expect(screen.getByText('ORD-003')).toBeInTheDocument();
            });

            // Click on order to open detail drawer
            const viewButton = screen.getByRole('button', { name: /view/i });
            await user.click(viewButton);

            await waitFor(() => {
                expect(screen.getByText('Order ORD-003')).toBeInTheDocument();
            });

            // Should not show "Assign Rider" section
            expect(screen.queryByText('Assign Rider')).not.toBeInTheDocument();
        });

        it('should not show status update controls for delivered orders', async () => {
            const user = userEvent.setup();
            const deliveredOrder = { ...mockOrders[2], orderStatus: 'DELIVERED' };
            (api.getOrders as any).mockResolvedValue({
                orders: [deliveredOrder],
                pagination: { pages: 1 }
            });

            render(<OrderTrackingManager />);

            await waitFor(() => {
                expect(screen.getByText('ORD-003')).toBeInTheDocument();
            });

            // Click on order to open detail drawer
            const viewButton = screen.getByRole('button', { name: /view/i });
            await user.click(viewButton);

            await waitFor(() => {
                expect(screen.getByText('Order ORD-003')).toBeInTheDocument();
            });

            // Should not show "Update Status" section
            expect(screen.queryByText('Update Status')).not.toBeInTheDocument();
        });
    });
});
