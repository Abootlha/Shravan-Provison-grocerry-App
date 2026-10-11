import React, { memo } from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Text } from '../../components/ui';
import { space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { GROUP_RADIUS } from './layout';

/**
 * Lines the server refused at quote time (archived / draft / unpriced product, or not enough
 * stock), listed by name. Nothing is removed silently: the customer removes them here (or fixes
 * the quantity), and payment stays locked until the cart is sellable.
 */
function UnavailableItemsCardBase({ items, onRemove, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const gone = items.filter((i) => i.reason !== 'stock');
    const short = items.filter((i) => i.reason === 'stock');
    const names = (list) => list.map((i) => i.name).filter(Boolean).join(', ');
    return (
        <Card padding={0} radius={GROUP_RADIUS} style={styles.card}>
            <View style={styles.body} accessibilityLiveRegion="polite">
                <View style={styles.head}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.errorInk} />
                    <Text variant="bodyStrong" style={styles.flex}>
                        {isHi
                            ? `${items.length} सामान अभी नहीं मिल सकता`
                            : `${items.length} item${items.length === 1 ? '' : 's'} can’t be ordered right now`}
                    </Text>
                </View>
                {gone.length ? (
                    <Text variant="body" color="secondary">
                        {isHi ? 'अब उपलब्ध नहीं: ' : 'No longer available: '}
                        <Text variant="body" color="ink">{names(gone)}</Text>
                    </Text>
                ) : null}
                {short.length ? (
                    <Text variant="body" color="secondary">
                        {isHi ? 'पर्याप्त स्टॉक नहीं: ' : 'Not enough stock: '}
                        <Text variant="body" color="ink">{names(short)}</Text>
                    </Text>
                ) : null}
                <Text variant="caption" color="muted">
                    {isHi
                        ? 'बिल में ये शामिल नहीं हैं। ऑर्डर करने के लिए इन्हें हटाएं।'
                        : 'They’re left out of the bill. Remove them to place your order.'}
                </Text>
                <Button
                    label={isHi ? 'इन्हें कार्ट से हटाएं' : items.length === 1 ? 'Remove it from cart' : 'Remove them from cart'}
                    variant="outline"
                    fullWidth
                    onPress={onRemove}
                />
            </View>
        </Card>
    );
}

export const UnavailableItemsCard = memo(UnavailableItemsCardBase);

const useStyles = makeStyles((t) => ({
    card: { overflow: 'hidden', borderColor: t.colors.errorInk },
    body: { padding: space.lg, gap: space.sm },
    head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    flex: { flex: 1 },
}));

export default UnavailableItemsCard;
