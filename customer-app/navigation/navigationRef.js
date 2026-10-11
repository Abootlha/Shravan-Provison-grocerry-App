import { createNavigationContainerRef } from '@react-navigation/native';

// Lets non-screen code (session handling) navigate. Passed to <NavigationContainer ref>.
export const navigationRef = createNavigationContainerRef();
