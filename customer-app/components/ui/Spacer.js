/**
 * Spacer — explicit whitespace from the spacing scale.
 *
 * Props
 *   size        space key ('xs'|'sm'|'md'|'lg'|'xl'|'2xl'|'3xl'...) or number (default 'lg')
 *   horizontal  boolean — horizontal gap instead of vertical
 *   flex        boolean — flex: 1 (push siblings apart)
 *
 * Example
 *   <Spacer size="2xl" />
 *   <View style={{ flexDirection: 'row' }}><Text>Left</Text><Spacer flex /><Text>Right</Text></View>
 *
 * Prefer `gap` on the parent for uniform spacing; use Spacer for one-off rhythm breaks.
 */
import React from 'react';
import { View } from 'react-native';
import { space } from '../../constants/theme';

export function Spacer({ size = 'lg', horizontal = false, flex = false }) {
    if (flex) return <View style={{ flex: 1 }} />;
    const v = typeof size === 'number' ? size : space[size] ?? space.lg;
    return <View style={horizontal ? { width: v } : { height: v }} />;
}

export default Spacer;
