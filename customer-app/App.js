import React from 'react';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { store } from './store';
import { AppNavigator } from './navigation';
import { WishlistToast } from './components';

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <NavigationContainer>
          <AppNavigator />
          <WishlistToast />
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}


