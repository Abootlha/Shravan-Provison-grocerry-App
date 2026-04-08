import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { MAPMYINDIA_APP_ID, MAPMYINDIA_APP_CODE } from './constants';

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
  const scheme = 'maps.mapmyindia.com';
  const path = `route/${vehicleType}/${startLat},${startLng};${endLat},${endLng}`;

  const url = Linking.createURL(path, {
    scheme,
    queryParams: {
      ref: `ridersdk://order?appId=${MAPMYINDIA_APP_ID}&appCode=${MAPMYINDIA_APP_CODE}`,
    },
  });

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    const googleMapsUrl = Platform.OS === 'ios'
      ? `http://maps.apple.com/?saddr=${startLat},${startLng}&daddr=${endLat},${endLng}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${endLat},${endLng}&travelmode=driving`;

    const fallbackUrl = `https://www.mapmyindia.com/secure-web/Route/${startLat},${startLng}/${endLat},${endLng}/${vehicleType}`;

    const canOpenGoogle = await Linking.canOpenURL(googleMapsUrl);
    await Linking.openURL(canOpenGoogle ? googleMapsUrl : fallbackUrl);
  }
};

export const openMapMyIndiaDirections = async (
  latitude: number,
  longitude: number,
  label?: string
): Promise<void> => {
  const url = Linking.createURL('', {
    scheme: 'maps.mapmyindia.com',
    queryParams: {
      q: `${latitude},${longitude}`,
      ref: label || 'RiderApp',
    },
  });

  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    const webUrl = `https://www.mapmyindia.com/mobile/geo/${latitude},${longitude}`;
    await Linking.openURL(webUrl);
  }
};

export const formatMapMyIndiaCoords = (
  latitude: number,
  longitude: number
): string => {
  return `${latitude},${longitude}`;
};
