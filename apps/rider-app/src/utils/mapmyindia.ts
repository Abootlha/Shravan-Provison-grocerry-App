import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

interface MapMyIndiaRouteParams {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  vehicleType?: 'bike' | 'car' | 'walk';
}

export const openMapMyIndiaNavigation = async ({
  startLat,
  startLng,
  endLat,
  endLng,
  vehicleType = 'bike',
}: MapMyIndiaRouteParams): Promise<void> => {
  const travelMode = vehicleType === 'walk' ? 'walking' : 'driving';
  const googleMapsAppUrl = Platform.OS === 'ios'
    ? `comgooglemaps://?saddr=${startLat},${startLng}&daddr=${endLat},${endLng}&directionsmode=${travelMode}`
    : `google.navigation:q=${endLat},${endLng}&mode=${vehicleType === 'walk' ? 'w' : 'd'}`;
  const googleMapsWebUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${endLat},${endLng}&travelmode=${travelMode}`;
  const appleMapsUrl = `http://maps.apple.com/?saddr=${startLat},${startLng}&daddr=${endLat},${endLng}&dirflg=${vehicleType === 'walk' ? 'w' : 'd'}`;

  const canOpenGoogleApp = await Linking.canOpenURL(googleMapsAppUrl);
  if (canOpenGoogleApp) {
    await Linking.openURL(googleMapsAppUrl);
    return;
  }

  if (Platform.OS === 'ios') {
    const canOpenAppleMaps = await Linking.canOpenURL(appleMapsUrl);
    if (canOpenAppleMaps) {
      await Linking.openURL(appleMapsUrl);
      return;
    }
  }

  await Linking.openURL(googleMapsWebUrl);
};

export const openMapMyIndiaDirections = async (
  latitude: number,
  longitude: number,
  label?: string
): Promise<void> => {
  const googleMapsAppUrl = Platform.OS === 'ios'
    ? `comgooglemaps://?q=${latitude},${longitude}${label ? `(${encodeURIComponent(label)})` : ''}`
    : `geo:${latitude},${longitude}?q=${latitude},${longitude}${label ? `(${encodeURIComponent(label)})` : ''}`;
  const googleMapsWebUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const appleMapsUrl = `http://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(label || 'Destination')}`;

  const canOpenGoogleApp = await Linking.canOpenURL(googleMapsAppUrl);
  if (canOpenGoogleApp) {
    await Linking.openURL(googleMapsAppUrl);
    return;
  }

  if (Platform.OS === 'ios') {
    const canOpenAppleMaps = await Linking.canOpenURL(appleMapsUrl);
    if (canOpenAppleMaps) {
      await Linking.openURL(appleMapsUrl);
      return;
    }
  }

  await Linking.openURL(googleMapsWebUrl);
};

export const formatMapMyIndiaCoords = (
  latitude: number,
  longitude: number
): string => {
  return `${latitude},${longitude}`;
};
