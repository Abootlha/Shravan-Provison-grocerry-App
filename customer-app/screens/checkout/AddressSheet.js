import React, { memo, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Badge, BottomSheet, Button, ContentSwap, Divider, EmptyState, IconButton, SkeletonGroup, SkeletonListRow, Text } from '../../components/ui';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { RadioRow } from './RadioRow';
import { addressIcon, formatFullAddress, isSameAddress, labelText } from '../address/addressUtils';

const CLOSE_DELAY = 180;

/** Saved addresses as radio rows, each with an edit (pencil) action; add new / pick on map below. */
function AddressSheetBase({ visible, onClose, addresses, selected, onSelect, onAddNew, onEdit, onOpenMap, loading, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const state = loading && addresses.length === 0 ? 'loading' : addresses.length === 0 ? 'empty' : 'data';
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);

    const choose = (addr) => {
        onSelect(addr);
        clearTimeout(timer.current);
        timer.current = setTimeout(onClose, CLOSE_DELAY);
    };

    return (
        <BottomSheet
            visible={visible}
            onClose={onClose}
            title={isHi ? 'डिलीवरी पता चुनें' : 'Select delivery address'}
            scrollable
            footer={(
                <View style={styles.footer}>
                    <Button
                        label={isHi ? 'नया पता जोड़ें' : 'Add new address'}
                        variant="outline"
                        fullWidth
                        onPress={onAddNew}
                        leftIcon={({ color, size }) => <MaterialCommunityIcons name="plus" size={size} color={color} />}
                    />
                    <Button
                        label={isHi ? 'नक्शे पर स्थान चुनें' : 'Pick a location on the map'}
                        variant="ghost"
                        size="sm"
                        fullWidth
                        onPress={onOpenMap}
                        leftIcon={({ color, size }) => <MaterialCommunityIcons name="map-search-outline" size={size} color={color} />}
                    />
                </View>
            )}
        >
            <ContentSwap stateKey={state}>
            {state === 'loading' ? (
                <SkeletonGroup style={styles.skeletons}>
                    <SkeletonListRow />
                    <SkeletonListRow />
                </SkeletonGroup>
            ) : state === 'empty' ? (
                <EmptyState
                    compact
                    title={isHi ? 'कोई सहेजा पता नहीं' : 'No saved addresses yet'}
                    subtitle={isHi ? 'डिलीवरी के लिए एक पता जोड़ें।' : 'Add one so we know where to deliver.'}
                />
            ) : (
                <View style={styles.group} accessibilityRole="radiogroup">
                    <Text variant="micro" color="muted" accessibilityRole="header" style={styles.groupTitle}>
                        {isHi ? 'सहेजे गए पते' : 'Saved addresses'}
                    </Text>
                    <View style={styles.box}>
                        {addresses.map((addr, i) => (
                            <View key={addr.id || i}>
                                {i > 0 ? <Divider inset={space.md} /> : null}
                                <View style={styles.rowWrap}>
                                    <View style={styles.flex}>
                                        <RadioRow
                                            icon={addressIcon(addr.type)}
                                            title={labelText(addr.type || 'Home', isHi)}
                                            subtitle={formatFullAddress(addr, isHi)}
                                            badge={addr.isDefault ? <Badge tone="soft" size="sm" label={isHi ? 'डिफ़ॉल्ट' : 'Default'} /> : null}
                                            selected={isSameAddress(addr, selected)}
                                            onPress={() => choose(addr)}
                                        />
                                    </View>
                                    {onEdit ? (
                                        <IconButton
                                            name="pencil-outline"
                                            variant="ghost"
                                            size="sm"
                                            color={colors.inkSecondary}
                                            accessibilityLabel={isHi
                                                ? `${labelText(addr.type || 'Home', true)} पता संपादित करें`
                                                : `Edit ${addr.type || 'Home'} address`}
                                            onPress={() => onEdit(addr)}
                                            style={styles.edit}
                                        />
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            )}
            </ContentSwap>
        </BottomSheet>
    );
}

export const AddressSheet = memo(AddressSheetBase);

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    footer: { gap: space.xs },
    rowWrap: { flexDirection: 'row', alignItems: 'center' },
    edit: { marginRight: space.xs },
    skeletons: { gap: space.md, paddingVertical: space.sm },
    group: { gap: space.sm, paddingBottom: space.sm },
    groupTitle: { marginLeft: space.xs },
    box: {
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        backgroundColor: t.colors.surface,
        overflow: 'hidden',
    },
}));

export default AddressSheet;
