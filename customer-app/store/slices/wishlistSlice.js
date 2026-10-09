import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    items: [],
    lastAddedItem: null,
    lastAddedTime: null, // Used to trigger animation in WishlistToast
};

const wishlistSlice = createSlice({
    name: 'wishlist',
    initialState,
    reducers: {
        toggleWishlistItem: (state, action) => {
            const product = action.payload;
            const existingIndex = state.items.findIndex((item) => item.id === product.id);
            if (existingIndex >= 0) {
                state.items.splice(existingIndex, 1);
            } else {
                state.items.push(product);
                state.lastAddedItem = product;
                state.lastAddedTime = Date.now();
            }
        },
    },
});

export const { toggleWishlistItem } = wishlistSlice.actions;
export default wishlistSlice.reducer;
