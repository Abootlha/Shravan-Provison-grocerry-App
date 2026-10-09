import React from 'react';
import Svg, { Path, G, Circle, Line } from 'react-native-svg';

export const HomeSvgIcon = ({ size = 24, color = "currentColor", strokeWidth = 2 }) => (
    <Svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M3.4 12.4C3.4 10.6 4 9.6 5.2 8.6L9.6 5.25C11 4.3 13 4.3 14.4 5.25L18.8 8.6C20 9.6 20.6 10.6 20.6 12.4L20.6 17C20.6 19.2 18.8 21 16.6 21L7.4 21C5.2 21 3.4 19.2 3.4 17L3.4 12.4Z" />
        <G>
            <Path stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M9.6 21L9.6 16.75C9.6 15.9 10.3 15.25 11.2 15.25L12.8 15.25C13.7 15.25 14.4 15.9 14.4 16.75L14.4 21" />
        </G>
    </Svg>
);

export const SearchSvgIcon = ({ size = 24, color = "currentColor", strokeWidth = 2 }) => (
    <Svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
        <G>
            <Circle stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" cx="11" cy="11" r="8" />
            <Path stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M7.9 9.2A4.6 4.6 0 0 1 10.8 7.2" />
        </G>
        <Line stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" x1="16.9" y1="16.9" x2="20.6" y2="20.6" />
    </Svg>
);

export const CategoriesSvgIcon = ({ size = 24, color = "currentColor", strokeWidth = 2 }) => (
    <Svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" cx="7" cy="7" r="3.5" />
        <Circle stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" cx="7" cy="17" r="3.5" />
        <Circle stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" cx="17" cy="17" r="3.5" />
        <G>
            <Path stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M19.8 7L19.4 7L19.3 7.7Q19.2 8.4 19.3 8.57Q19.4 8.75 19.5 9L19.6 9.25L19.2 9.43Q18.8 9.6 18.6 9.6Q18.4 9.6 18.2 9.5Q18 9.4 17.6 9.57Q17.2 9.75 16.45 9.57L15.7 9.4L15.65 9.2Q15.6 9 15.1 8.7Q14.6 8.4 14.35 8.4L14.1 8.4L14.35 7.7Q14.6 7 14.7 6.3Q14.8 5.6 14.7 5.42Q14.6 5.25 14.5 5L14.4 4.75L14.8 4.58Q15.2 4.4 15.4 4.4Q15.6 4.4 15.8 4.5Q16 4.6 16.4 4.42Q16.8 4.25 17.55 4.42L18.3 4.6L18.35 4.8Q18.4 5 18.9 5.3Q19.4 5.6 19.6 6.3L19.8 7Z" />
            <Circle stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" cx="17" cy="7" r="1" />
        </G>
    </Svg>
);

export const ProfileSvgIcon = ({ size = 24, color = "currentColor", strokeWidth = 2 }) => (
    <Svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" cx="12" cy="8.2" r="3.9" />
        <Path stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M12 13.8C8.1 13.8 5.4 16.4 5.4 20L5.4 20.6C5.4 21 5.7 21.3 6.1 21.3L17.9 21.3C18.3 21.3 18.6 21 18.6 20.6L18.6 20C18.6 16.4 15.9 13.8 12 13.8Z" />
    </Svg>
);
