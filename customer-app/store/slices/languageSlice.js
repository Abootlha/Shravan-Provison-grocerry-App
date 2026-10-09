import { createSlice } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const initialState = {
    currentLanguage: 'en', // 'en' or 'hi'
    isLanguageSelected: false,
};

const languageSlice = createSlice({
    name: 'language',
    initialState,
    reducers: {
        setLanguage: (state, action) => {
            state.currentLanguage = action.payload;
            state.isLanguageSelected = true;
            // Save to AsyncStorage
            AsyncStorage.setItem('userLanguage', action.payload);
        },
        loadLanguage: (state, action) => {
            state.currentLanguage = action.payload || 'en';
            state.isLanguageSelected = true;
        },
    },
});

export const { setLanguage, loadLanguage } = languageSlice.actions;

export default languageSlice.reducer;
