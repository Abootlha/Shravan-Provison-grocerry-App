import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    items: [],
    totalAmount: 0,
    totalItems: 0,
};

const cartSlice = createSlice({
    name: 'cart',
    initialState,
    reducers: {
        addToCart: (state, action) => {
            const existingItem = state.items.find(
                (item) => item.id === action.payload.id
            );

            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                state.items.push({ ...action.payload, quantity: 1 });
            }

            state.totalItems = state.items.reduce(
                (total, item) => total + item.quantity,
                0
            );
            state.totalAmount = state.items.reduce(
                (total, item) => total + item.price * item.quantity,
                0
            );
        },

        removeFromCart: (state, action) => {
            state.items = state.items.filter((item) => item.id !== action.payload);

            state.totalItems = state.items.reduce(
                (total, item) => total + item.quantity,
                0
            );
            state.totalAmount = state.items.reduce(
                (total, item) => total + item.price * item.quantity,
                0
            );
        },

        incrementQuantity: (state, action) => {
            const item = state.items.find((item) => item.id === action.payload);
            if (item) {
                item.quantity += 1;
            }

            state.totalItems = state.items.reduce(
                (total, item) => total + item.quantity,
                0
            );
            state.totalAmount = state.items.reduce(
                (total, item) => total + item.price * item.quantity,
                0
            );
        },

        decrementQuantity: (state, action) => {
            const item = state.items.find((item) => item.id === action.payload);
            if (item) {
                if (item.quantity === 1) {
                    state.items = state.items.filter((i) => i.id !== action.payload);
                } else {
                    item.quantity -= 1;
                }
            }

            state.totalItems = state.items.reduce(
                (total, item) => total + item.quantity,
                0
            );
            state.totalAmount = state.items.reduce(
                (total, item) => total + item.price * item.quantity,
                0
            );
        },

        clearCart: (state) => {
            state.items = [];
            state.totalAmount = 0;
            state.totalItems = 0;
        },
    },
});

export const {
    addToCart,
    removeFromCart,
    incrementQuantity,
    decrementQuantity,
    clearCart,
} = cartSlice.actions;

export default cartSlice.reducer;
