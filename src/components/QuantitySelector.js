import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants';

const QuantitySelector = ({
    quantity,
    onIncrement,
    onDecrement,
    size = 'medium',
    variant = 'outline',
}) => {
    const isSmall = size === 'small';
    const isFilled = variant === 'filled';

    return (
        <View
            style={[
                styles.container,
                isSmall && styles.containerSmall,
                isFilled && styles.containerFilled,
            ]}
        >
            <TouchableOpacity
                style={[styles.button, isSmall && styles.buttonSmall]}
                onPress={onDecrement}
            >
                <MaterialCommunityIcons
                    name="minus"
                    size={isSmall ? 14 : 18}
                    color={isFilled ? COLORS.white : COLORS.secondary}
                />
            </TouchableOpacity>

            <Text
                style={[
                    styles.quantity,
                    isSmall && styles.quantitySmall,
                    isFilled && styles.quantityFilled,
                ]}
            >
                {quantity}
            </Text>

            <TouchableOpacity
                style={[styles.button, isSmall && styles.buttonSmall]}
                onPress={onIncrement}
            >
                <MaterialCommunityIcons
                    name="plus"
                    size={isSmall ? 14 : 18}
                    color={isFilled ? COLORS.white : COLORS.secondary}
                />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.secondary,
        borderRadius: 8,
        overflow: 'hidden',
    },
    containerSmall: {
        borderRadius: 6,
    },
    containerFilled: {
        backgroundColor: COLORS.secondary,
        borderWidth: 0,
    },
    button: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    buttonSmall: {
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    quantity: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.secondary,
        paddingHorizontal: 12,
        minWidth: 40,
        textAlign: 'center',
    },
    quantitySmall: {
        fontSize: 14,
        paddingHorizontal: 8,
        minWidth: 30,
    },
    quantityFilled: {
        color: COLORS.white,
    },
});

export default QuantitySelector;
