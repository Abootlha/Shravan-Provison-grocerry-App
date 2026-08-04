import React from 'react';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { store } from './store';
import { AppNavigator } from './navigation';

export default function App() {
  return (
    <Provider store={store}>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </Provider>
  );
}


