import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    currentLocation: null, // GPS-based location
    selectedAddress: null,
    savedAddresses: [],
    isLocationEnabled: false,
    isLoading: false,
    error: null,
};

const locationSlice = createSlice({
    name: 'location',
    initialState,
    reducers: {
        setCurrentLocation: (state, action) => {
            state.currentLocation = action.payload;
            state.isLocationEnabled = true;
        },
        setSelectedAddress: (state, action) => {
            state.selectedAddress = action.payload;
        },
        setSavedAddresses: (state, action) => {
            state.savedAddresses = action.payload;
        },
        addSavedAddress: (state, action) => {
            state.savedAddresses.push(action.payload);
        },
        updateSavedAddress: (state, action) => {
            const index = state.savedAddresses.findIndex(
                addr => addr.id === action.payload.id
            );
            if (index !== -1) {
                state.savedAddresses[index] = action.payload;
            }
        },
        removeSavedAddress: (state, action) => {
            state.savedAddresses = state.savedAddresses.filter(
                addr => addr.id !== action.payload
            );
        },
        setDefaultAddress: (state, action) => {
            state.savedAddresses = state.savedAddresses.map(addr => ({
                ...addr,
                isDefault: addr.id === action.payload,
            }));
            state.selectedAddress = state.savedAddresses.find(
                addr => addr.id === action.payload
            );
        },
        setLocationEnabled: (state, action) => {
            state.isLocationEnabled = action.payload;
        },
        setLoading: (state, action) => {
            state.isLoading = action.payload;
        },
        setError: (state, action) => {
            state.error = action.payload;
        },
        clearLocation: (state) => {
            state.currentLocation = null;
            state.isLocationEnabled = false;
        },
    },
});

export const {
    setCurrentLocation,
    setSelectedAddress,
    setSavedAddresses,
    addSavedAddress,
    updateSavedAddress,
    removeSavedAddress,
    setDefaultAddress,
    setLocationEnabled,
    setLoading,
    setError,
    clearLocation,
} = locationSlice.actions;

export default locationSlice.reducer;
