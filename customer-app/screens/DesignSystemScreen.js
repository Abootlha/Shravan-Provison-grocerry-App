/**
 * DesignSystemScreen — DEV ONLY. Renders every primitive in components/ui in all states, following
 * docs/design/DESIGN.md: neutral frame, one brand violet where the user acts, green for savings,
 * no gradients (except the photo scrim), no glow, ≤2 blur uses, flat cards, no idle loops.
 * Registered in AppNavigator only when __DEV__. On web open http://localhost:<port>/?ds
 * On device: navigation.navigate('DesignSystem').
 */
import React, { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    AddToCartButton,
    AnimatedListItem,
    Badge,
    BottomSheet,
    Button,
    Card,
    Chip,
    ConfettiBurst,
    CountBadge,
    Divider,
    EmptyState,
    FloatingDock,
    Headline,
    Icon3D,
    ICON_3D_NAMES,
    IconButton,
    Logo,
    LogoMark,
    Mascot,
    PriceTag,
    ProgressBar,
    RollingNumber,
    RotatingPlaceholder,
    Screen,
    SectionHeader,
    SheetTextInput,
    SkeletonGroup,
    SkeletonListRow,
    SkeletonProductTile,
    SlideToConfirm,
    Spacer,
    SuccessCheck,
    Text,
    ThemeModeControl,
    SegmentedControl,
    AnimatedScreen,
    ContentSwap,
    PressableHighlight,
    SwipeableRow,
    CollapsibleHeader,
    LargeTitle,
    useCollapsibleHeader,
    Skeleton,
    toast,
    useCartTarget,
    useFlightDeferred,
    useFlyToCart,
    ICONS_3D,
} from '../components/ui';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { radii, space, type } from '../constants/theme';
import { makeStyles, useTheme, layout } from '../theme';

// The semantic roles from DESIGN.md, resolved against the ACTIVE theme.
const rolesOf = (c) => [
    ['canvas', c.canvas],
    ['surface', c.surface],
    ['image well', c.imageWell],
    ['hairline', c.hairline],
    ['ink', c.ink],
    ['ink 2', c.inkSecondary],
    ['muted', c.inkMuted],
    ['brand', c.brand],
    ['brand text', c.brandText],
    ['brand tint', c.brandTint],
    ['savings', c.success],
    ['savings tint', c.successTint],
    ['error', c.error],
];
const PHOTO = require('../assets/banner-card1.png');
const ClockIcon = ({ color, size }) => <MaterialCommunityIcons name="clock-outline" color={color} size={size} />;
const DOCK = [
    { key: 'Home', label: 'Home', icon: 'home-variant' },
    { key: 'Categories', label: 'Categories', icon: 'view-grid-outline' },
    { key: 'Cart', label: 'Cart', icon: 'shopping-outline', badge: 3 },
    { key: 'Account', label: 'Account', icon: 'account-circle-outline' },
].map((d) => ({ ...d, icon: ({ color, size }) => <MaterialCommunityIcons name={d.icon} color={color} size={size} /> }));

function Section({ title, children, note }) {
    const styles = useStyles();
    return (
        <View style={styles.section}>
            <SectionHeader title={title} subtitle={note} />
            {children}
        </View>
    );
}

function Row({ children, style }) {
    const styles = useStyles();
    return <View style={[styles.row, style]}>{children}</View>;
}

const PRODUCTS = [
    { id: 1, name: 'Amul Taaza Toned Fresh Milk', unit: '500 ml', price: 28, mrp: 30, art: 'glass_of_milk' },
    { id: 2, name: 'Harvest Gold White Bread', unit: '400 g', price: 40, mrp: 50, art: 'bread' },
    { id: 3, name: 'Farm Fresh Brown Eggs', unit: '6 pcs', price: 72, mrp: 84, art: 'egg', out: true },
    { id: 4, name: 'Fresh Coriander Leaves', unit: '100 g', price: 12, mrp: 15, art: 'herb' },
];

function ProductTile({ p, qty, setQty }) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <Card padding={0} style={styles.product}>
            <View style={[styles.productImg, { backgroundColor: colors.imageWell }]}>
                <Icon3D name={p.art} size={64} />
                <Badge tone="discount" label={`${Math.round((1 - p.price / p.mrp) * 100)}% off`} style={styles.productBadge} />
            </View>
            <View style={styles.productBody}>
                <Badge label="12 mins" icon={ClockIcon} />
                <Text variant="label" numberOfLines={2} style={styles.productName}>
                    {p.name}
                </Text>
                <Text variant="caption" color="muted">
                    {p.unit}
                </Text>
                <View style={styles.productFoot}>
                    <PriceTag price={p.price} mrp={p.mrp} layout="stack" />
                    <AddToCartButton
                        size="sm"
                        quantity={qty}
                        outOfStock={p.out}
                        productName={p.name}
                        max={5}
                        onMaxReached={() => toast.info('Max 5 per order', { description: 'Limited stock for this item.' })}
                        onAdd={() => setQty(1)}
                        onIncrement={() => setQty(qty + 1)}
                        onDecrement={() => setQty(qty - 1)}
                    />
                </View>
            </View>
        </Card>
    );
}

const FLY_ITEMS = [
    { id: 'f1', name: 'Bananas', unit: '6 pcs', price: 48, art: ICONS_3D.banana },
    { id: 'f2', name: 'Shopping basket', unit: 'Combo', price: 199, art: ICONS_3D.basket },
];

/** Fly-to-cart playground: ADD lifts the art into the cart chip, which bumps and rolls on landing. */
function FlyToCartDemo() {
    const { colors } = useTheme();
    const styles = useStyles();
    const fly = useFlyToCart();
    const [qty, setQty] = useState({ f1: 0, f2: 0 });
    const count = qty.f1 + qty.f2;
    const shown = useFlightDeferred(count);
    const cartRef = useRef(null);
    const bump = useCartTarget(cartRef, { priority: 4 });
    const refs = { f1: useRef(null), f2: useRef(null) };
    const add = (it) => {
        fly({ fromRef: refs[it.id], uri: it.art, inset: 0.14 });
        setQty((q) => ({ ...q, [it.id]: q[it.id] + 1 }));
    };
    return (
        <View>
            <Row style={{ justifyContent: 'flex-end', marginBottom: space.md }}>
                <Animated.View ref={cartRef} collapsable={false} style={[styles.flyCart, bump]}>
                    <MaterialCommunityIcons name="shopping" size={20} color={colors.onNight} />
                    <RollingNumber value={shown} variant="label" color="onNight" suffix={shown === 1 ? ' item' : ' items'} />
                </Animated.View>
            </Row>
            <Row style={{ gap: space.md }}>
                {FLY_ITEMS.map((it) => (
                    <Card key={it.id} padding="sm" style={{ flex: 1 }}>
                        <View ref={refs[it.id]} collapsable={false} style={styles.flyWell}>
                            <Icon3D name={it.id === 'f1' ? 'banana' : 'basket'} size={72} />
                        </View>
                        <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm }}>
                            <View>
                                <Text variant="label">{it.name}</Text>
                                <Text variant="caption" color="muted">
                                    ₹{it.price} · {it.unit}
                                </Text>
                            </View>
                            <AddToCartButton
                                size="sm"
                                quantity={qty[it.id]}
                                productName={it.name}
                                onAdd={() => add(it)}
                                onIncrement={() => add(it)}
                                onDecrement={() => setQty((q) => ({ ...q, [it.id]: q[it.id] - 1 }))}
                            />
                        </Row>
                    </Card>
                ))}
            </Row>
        </View>
    );
}

/** Motion building blocks: ContentSwap, PressableHighlight + SwipeableRow, collapsible header, currency roll. */
function MotionDemo() {
    const { colors } = useTheme();
    const styles = useStyles();
    const [state, setState] = useState('loading');
    const [rows, setRows] = useState(['Amul Taaza Milk · 500 ml', 'Harvest Gold Bread · 400 g', 'Farm Eggs · 6 pcs']);
    const [total, setTotal] = useState(1249.5);
    const collapse = useCollapsibleHeader({ range: 48 });
    const next = { loading: 'data', data: 'empty', empty: 'loading' };
    return (
        <View style={{ gap: space.md }}>
            <Row style={{ gap: space.sm, alignItems: 'center' }}>
                <Text variant="label" color="secondary">ContentSwap: {state}</Text>
                <Button label="Next state" size="sm" variant="outline" onPress={() => setState(next[state])} />
            </Row>
            <Card padding="md">
                <ContentSwap stateKey={state}>
                    {state === 'loading' ? (
                        <SkeletonGroup gap={space.sm}>
                            <Skeleton height={16} width="70%" />
                            <Skeleton height={12} width="45%" />
                            <Skeleton height={12} width="55%" />
                        </SkeletonGroup>
                    ) : state === 'data' ? (
                        <View style={{ gap: space.xs }}>
                            <Text variant="title">3 items in your cart</Text>
                            <Text variant="body" color="secondary">Arriving in 9 minutes</Text>
                            <Text variant="caption" color="success">You saved ₹42</Text>
                        </View>
                    ) : (
                        <View style={{ gap: space.xs }}>
                            <Text variant="title">Nothing here yet</Text>
                            <Text variant="body" color="muted">Add something to see it crossfade in.</Text>
                        </View>
                    )}
                </ContentSwap>
            </Card>
            <Text variant="label" color="secondary">PressableHighlight rows · swipe left to delete</Text>
            <Card padding={0} style={{ overflow: 'hidden' }}>
                {rows.map((r, i) => (
                    <Animated.View key={r} layout={layout.list} exiting={layout.exit}>
                        <SwipeableRow onAction={() => setRows((rs) => rs.filter((x) => x !== r))}>
                            <PressableHighlight onPress={() => toast.show(r)} style={styles.motionRow} accessibilityLabel={r}>
                                <MaterialCommunityIcons name="basket-outline" size={20} color={colors.inkSecondary} />
                                <Text variant="bodyStrong" style={{ flex: 1, marginLeft: space.md }}>{r}</Text>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.inkMuted} />
                            </PressableHighlight>
                        </SwipeableRow>
                        {i < rows.length - 1 ? <Divider inset={space.lg} /> : null}
                    </Animated.View>
                ))}
            </Card>
            {rows.length < 3 ? <Button label="Restore rows" size="sm" variant="ghost" align="start" onPress={() => setRows(['Amul Taaza Milk · 500 ml', 'Harvest Gold Bread · 400 g', 'Farm Eggs · 6 pcs'])} /> : null}
            <Text variant="label" color="secondary">useCollapsibleHeader (scroll inside the box)</Text>
            <View style={styles.collapseStage}>
                <Animated.ScrollView onScroll={collapse.onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: 52, paddingBottom: space.lg }}>
                    <LargeTitle collapse={collapse} title="Your orders" subtitle="12 orders · last 90 days" />
                    {[1042, 1039, 1031, 1027, 1019, 1011].map((o) => (
                        <Text key={o} variant="body" style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
                            Order #{o} · Delivered
                        </Text>
                    ))}
                </Animated.ScrollView>
                <CollapsibleHeader collapse={collapse} title="Your orders" onBack={() => {}} />
            </View>
            <Row style={{ gap: space.md, alignItems: 'center' }}>
                <RollingNumber value={total} currency variant="priceLarge" />
                <Button label="+₹48.25" size="sm" variant="outline" onPress={() => setTotal((v) => Math.round((v + 48.25) * 100) / 100)} />
            </Row>
        </View>
    );
}

/** The plain surface header (DESIGN.md): surface fill, ink, hairline. The ETA is the screen's one Headline. */
function HeaderBody({ header, navigation }) {
    const { colors } = useTheme();
    const styles = useStyles();
    return (
        <>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                    <Row style={{ alignItems: 'center', gap: space.xs }}>
                        <MaterialCommunityIcons name="moped-outline" size={16} color={header.inkSecondary} />
                        <Text variant="label" color={header.inkSecondary}>
                            Delivery in
                        </Text>
                    </Row>
                    <Headline variant="display" color={header.ink} lead="12" emphasis="minutes" emphasisColor="brand" />
                    <Text variant="caption" color={header.inkSecondary} numberOfLines={1}>
                        Home · 4th Cross, Indiranagar
                    </Text>
                </View>
                <IconButton
                    name="arrow-left"
                    accessibilityLabel="Go back"
                    onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Splash'))}
                />
            </Row>
            <View style={[styles.search, { backgroundColor: header.searchBg }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.inkMuted} />
                <RotatingPlaceholder items={['milk', 'atta', 'eggs', 'chips', 'paneer']} style={{ flex: 1, marginLeft: space.sm }} color="muted" />
            </View>
        </>
    );
}

export default function DesignSystemScreen({ navigation }) {
    const { colors, gradients, headerThemes, scheme, mode, setMode } = useTheme();
    const styles = useStyles();
    const ROLES = rolesOf(colors);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({ veg: true, offers: false, fast: false });
    const [tip, setTip] = useState(30);
    const [sort, setSort] = useState('relevance');
    const [count, setCount] = useState(3);
    const [qtys, setQtys] = useState({ 1: 0, 2: 2, 3: 0, 4: 0 });
    const [solo, setSolo] = useState({ sm: 0, md: 1, lg: 0 });
    const [price, setPrice] = useState(248);
    const [progress, setProgress] = useState(0.35);
    const [liked, setLiked] = useState(false);
    const [checkStatus, setCheckStatus] = useState('loading');
    const [sheet, setSheet] = useState(null);
    const [mood, setMood] = useState('happy');
    const [listKey, setListKey] = useState(0);
    const [paying, setPaying] = useState(false);
    const [dock, setDock] = useState('Home');
    const slider = useRef(null);
    const confetti = useRef(null);
    const header = headerThemes.default; // every category key maps to this plain surface header now
    const cartTotal = Object.entries(qtys).reduce((sum, [id, q]) => sum + q * PRODUCTS.find((p) => p.id === Number(id)).price, 0);

    return (
        <Screen edges={[]} statusBar={header.statusBar}>
            <AnimatedScreen>
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                {/* Plain surface header — no gradient, no per-category tint */}
                <View style={[styles.header, { backgroundColor: header.bg }]}>
                    <HeaderBody header={header} navigation={navigation} />
                </View>

                <View style={styles.body}>
                    <Section title="Theme" note={`mode: ${mode} · resolved scheme: ${scheme} — every primitive below follows it`}>
                        <ThemeModeControl />
                        <Spacer size="sm" />
                        <SegmentedControl
                            size="sm"
                            accessibilityLabel="Quick scheme"
                            value={scheme}
                            onChange={setMode}
                            options={[
                                { key: 'light', label: 'Force light' },
                                { key: 'dark', label: 'Force dark' },
                            ]}
                        />
                    </Section>

                    <Section title="Brand" note="Flat violet mark — light, brand (white on a violet block) and dark tones">
                        <Card>
                            <Logo size={40} />
                            <Spacer size="md" />
                            <Row style={{ alignItems: 'flex-end', gap: space.xl }}>
                                <LogoMark size={56} />
                                <LogoMark size={32} />
                                <LogoMark size={20} />
                                <Logo variant="wordmark" size={22} />
                            </Row>
                        </Card>
                        <View style={[styles.brandStage, { backgroundColor: colors.brand }]}>
                            <Logo tone="brand" size={40} />
                            <LogoMark tone="brand" size={40} />
                        </View>
                    </Section>

                    <Section title="Colour" note="Neutral frame · violet = act · green = savings · red = error. Nothing else.">
                        <View style={styles.roleGrid}>
                            {ROLES.map(([name, c]) => (
                                <View key={name} style={styles.roleCell}>
                                    <View style={[styles.swatch, { backgroundColor: c }]} />
                                    <Text variant="caption" color="secondary" numberOfLines={1}>
                                        {name}
                                    </Text>
                                </View>
                            ))}
                        </View>
                        <Spacer size="md" />
                        <Text variant="label" color="secondary">
                            The one gradient: a legibility scrim under text on a photo. Glass only for buttons over photos.
                        </Text>
                        <Spacer size="sm" />
                        <View style={styles.photoStage}>
                            <Image source={PHOTO} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            <LinearGradient colors={gradients.scrim} style={[styles.scrimFill, { pointerEvents: 'none' }]} />
                            <Row style={{ justifyContent: 'space-between' }}>
                                <IconButton name="arrow-left" variant="glass" allowBlur accessibilityLabel="Back (over photo)" />
                                <IconButton name="heart-outline" variant="glass" allowBlur accessibilityLabel="Wishlist (over photo)" />
                            </Row>
                            <Text variant="title" color="onNight">
                                Fresh mangoes are in
                            </Text>
                        </View>
                        <Spacer size="md" />
                        <View style={styles.cartPill}>
                            <MaterialCommunityIcons name="shopping-outline" size={20} color={colors.onNight} />
                            <View style={{ flex: 1, marginLeft: space.md }}>
                                <Text variant="bodyStrong" color="onNight">
                                    3 items · ₹273
                                </Text>
                                <Text variant="caption" color="onNightSecondary">
                                    Floating dark surface: ink, never indigo
                                </Text>
                            </View>
                            <Button label="View cart" size="sm" onPress={() => {}} />
                        </View>
                    </Section>

                    <Section title="Headlines & prices" note="Mixed-weight Headline: max ONE per screen (Home hero, tracking ETA) — it's in the header above">
                        <Text variant="h2">Section titles are plain h2</Text>
                        <Spacer size="md" />
                        <Row style={{ alignItems: 'flex-end', gap: space.xl, flexWrap: 'wrap' }}>
                            <PriceTag price={248} mrp={300} size="lg" showSave="amount" />
                            <PriceTag price={48} mrp={60} size="md" showSave />
                        </Row>
                    </Section>

                    <Section title="Display type" note="Bricolage Grotesque — hero, display, h1 only (the 2–3 largest headings)">
                        <Text variant="hero" numberOfLines={1}>
                            Arriving in 8 mins
                        </Text>
                        <Text variant="display">Order placed</Text>
                        <Text variant="h1">Fruits & vegetables</Text>
                        <Text variant="caption" color="muted" style={{ marginTop: space.xs }}>
                            Prices stay in Plus Jakarta (tabular figures); Bricolage has ₹ for headlines that need it.
                        </Text>
                    </Section>

                    <Section title="Type" note="Bricolage (display, h1) · Plus Jakarta Sans (h2 → micro) · sentence case, no tracking">
                        {['display', 'h1', 'h2', 'h3', 'title', 'bodyStrong', 'body', 'label', 'caption'].map((v) => (
                            <Text key={v} variant={v} numberOfLines={1}>
                                {v} · Fresh groceries in minutes
                            </Text>
                        ))}
                        <Text variant="micro">micro · Up to 40% off</Text>
                        <Row style={{ alignItems: 'baseline', gap: space.sm, marginTop: space.xs }}>
                            <Text variant="priceLarge">₹1,249</Text>
                            <Text variant="price">₹48</Text>
                            <Text variant="priceStrike" color="muted">
                                ₹60
                            </Text>
                        </Row>
                    </Section>

                    <Section title="Buttons">
                        <View style={{ gap: space.md }}>
                            <Button label="Proceed to pay" size="lg" fullWidth loading={loading} onPress={() => setLoading(true)}
                                rightIcon={({ color, size }) => <MaterialCommunityIcons name="arrow-right" color={color} size={size} />} />
                            <Row style={{ flexWrap: 'wrap', gap: space.sm }}>
                                <Button label="Primary" onPress={() => {}} />
                                <Button label="Secondary" variant="secondary" onPress={() => {}} />
                                <Button label="Soft" variant="soft" onPress={() => {}} />
                                <Button label="Outline" variant="outline" onPress={() => {}} />
                                <Button label="Ghost" variant="ghost" onPress={() => {}} />
                                <Button label="Dark" variant="dark" onPress={() => {}} />
                                <Button label="Delete" variant="danger" onPress={() => {}} />
                            </Row>
                            <Row style={{ flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
                                <Button label="Small" size="sm" onPress={() => {}} />
                                <Button label="Loading" size="sm" variant="secondary" loading />
                                <Button label="Disabled" size="sm" disabled />
                                <Button label={loading ? 'Stop loading' : 'Toggle'} size="sm" variant="outline" onPress={() => setLoading((l) => !l)} />
                            </Row>
                        </View>
                    </Section>

                    <Section title="Icon buttons">
                        <Row style={{ gap: space.md, alignItems: 'center', flexWrap: 'wrap' }}>
                            <IconButton name="arrow-left" accessibilityLabel="Back" />
                            <IconButton name={liked ? 'heart' : 'heart-outline'} active={liked} activeColor={colors.error} accessibilityLabel="Wishlist" onPress={() => setLiked((l) => !l)} />
                            <IconButton name="share-variant-outline" variant="tinted" accessibilityLabel="Share" />
                            <IconButton name="close" variant="ghost" accessibilityLabel="Close" />
                            <IconButton name="cart-outline" variant="brand" size="lg" accessibilityLabel="Cart" badge={count} />
                            <IconButton name="tune-variant" variant="accent" size="sm" accessibilityLabel="Filters" />
                            <IconButton name="bell-outline" variant="soft" accessibilityLabel="Notifications" />
                            <IconButton name="share-variant" variant="night" accessibilityLabel="Share" />
                            <IconButton name="arrow-left" variant="glass" size="lg" accessibilityLabel="Back (glass: solid, hairline, floating shadow)" />
                            <View style={styles.scrimDemo}>
                                <IconButton name="heart-outline" variant="scrim" size="sm" accessibilityLabel="Wishlist" />
                            </View>
                        </Row>
                    </Section>

                    <Section title="Chips">
                        <Row style={{ flexWrap: 'wrap', gap: space.sm }}>
                            <Chip label="Filters" leftIcon={({ color, size }) => <MaterialCommunityIcons name="tune-variant" color={color} size={size} />} onPress={() => {}} />
                            {Object.keys(filters).map((k) => (
                                <Chip key={k} label={{ veg: 'Pure veg', offers: 'Offers', fast: 'Under 10 mins' }[k]} selected={filters[k]} onPress={() => setFilters((f) => ({ ...f, [k]: !f[k] }))} />
                            ))}
                            <Chip label="Sort" rightIcon={({ color, size }) => <MaterialCommunityIcons name="chevron-down" color={color} size={size} />} onPress={() => {}} />
                        </Row>
                        <Spacer size="md" />
                        <Row style={{ gap: space.sm }}>
                            {[20, 30, 50].map((a) => (
                                <Chip key={a} tone="brand" label={`₹${a}`} caption={a === 30 ? 'Most tipped' : undefined} selected={tip === a} onPress={() => setTip(a)} />
                            ))}
                        </Row>
                        <Spacer size="md" />
                        <Row style={{ gap: space.sm }}>
                            {['relevance', 'price', 'discount'].map((s) => (
                                <Chip key={s} size="sm" label={s} selected={sort === s} onPress={() => setSort(s)} />
                            ))}
                            <Chip size="sm" label="Disabled" disabled />
                        </Row>
                    </Section>

                    <Section title="Badges">
                        <Row style={{ flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
                            <Badge label="12 mins" icon={ClockIcon} />
                            <Badge label="Up to 40% off" tone="discount" />
                            <Badge label="Save ₹40" tone="discount" size="md" />
                            <Badge label="Delivered" tone="success" />
                            <Badge label="Default" tone="soft" />
                            <Badge label="Selected" tone="brand" />
                            <Badge label="Only 2 left" tone="error" />
                            <Badge label="New" size="md" />
                        </Row>
                        <Spacer size="md" />
                        <Row style={{ gap: space.md, alignItems: 'center' }}>
                            <CountBadge count={count} />
                            <CountBadge count={count * 37} tone="ink" />
                            <CountBadge count={count} tone="accent" outline={false} />
                            <Button label="−" size="sm" variant="outline" onPress={() => setCount((c) => Math.max(0, c - 1))} />
                            <Button label="+" size="sm" variant="outline" onPress={() => setCount((c) => c + 1)} />
                        </Row>
                    </Section>

                    <Section title="Add to cart" note="sm · md · lg — fixed widths, max 5">
                        <Row style={{ gap: space.md, alignItems: 'center' }}>
                            {['sm', 'md', 'lg'].map((s) => (
                                <AddToCartButton
                                    key={s}
                                    size={s}
                                    quantity={solo[s]}
                                    max={5}
                                    onMaxReached={() => toast.info('You can add up to 5')}
                                    onAdd={() => setSolo((q) => ({ ...q, [s]: 1 }))}
                                    onIncrement={() => setSolo((q) => ({ ...q, [s]: q[s] + 1 }))}
                                    onDecrement={() => setSolo((q) => ({ ...q, [s]: q[s] - 1 }))}
                                />
                            ))}
                        </Row>
                        <Spacer size="sm" />
                        <Row style={{ gap: space.md }}>
                            <AddToCartButton size="sm" quantity={0} disabled />
                            <AddToCartButton size="sm" quantity={0} outOfStock />
                        </Row>
                        <Spacer size="lg" />
                        <View style={styles.grid}>
                            {PRODUCTS.map((p) => (
                                <ProductTile key={p.id} p={p} qty={qtys[p.id]} setQty={(q) => setQtys((s) => ({ ...s, [p.id]: q }))} />
                            ))}
                        </View>
                        <Card style={{ marginTop: space.md }}>
                            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                <View>
                                    <Text variant="caption" color="secondary">
                                        Cart total
                                    </Text>
                                    <RollingNumber value={cartTotal} prefix="₹" variant="priceLarge" />
                                </View>
                                <Button label="View cart" size="md" onPress={() => {}} />
                            </Row>
                        </Card>
                    </Section>

                    <Section title="Motion building blocks" note="ContentSwap · PressableHighlight · SwipeableRow · useCollapsibleHeader · RollingNumber currency">
                        <MotionDemo />
                    </Section>

                    <Section title="Fly to cart" note="useFlyToCart + useCartTarget · bezier hop, bump + roll on landing · reduced motion: bump only">
                        <FlyToCartDemo />
                    </Section>

                    <Section title="Rolling number">
                        <Row style={{ gap: space.md, alignItems: 'center' }}>
                            <RollingNumber value={price} prefix="₹" variant="display" />
                            <Button label="−37" size="sm" variant="outline" onPress={() => setPrice((p) => Math.max(0, p - 37))} />
                            <Button label="+125" size="sm" variant="outline" onPress={() => setPrice((p) => p + 125)} />
                        </Row>
                    </Section>

                    <Section title="Cards & tiles" note="Flat + hairline, radius 12. Category tiles: neutral well + the product, no pastel tints">
                        <Row style={{ gap: space.sm }}>
                            {[
                                ['leafy_green', 'Fruits & veg'],
                                ['glass_of_milk', 'Dairy'],
                                ['cookie', 'Snacks'],
                                ['cooked_rice', 'Atta & rice'],
                            ].map(([art, label]) => (
                                <PressableHighlight key={art} onPress={() => {}} accessibilityLabel={label} style={styles.catTile}>
                                    <View style={styles.catImg}>
                                        <Icon3D name={art} size={40} />
                                    </View>
                                    <Text variant="caption" align="center" numberOfLines={2} style={{ fontFamily: type.label.fontFamily, marginTop: space.xs }}>
                                        {label}
                                    </Text>
                                </PressableHighlight>
                            ))}
                        </Row>
                        <Spacer size="md" />
                        <Card>
                            <Text variant="title">Card</Text>
                            <Divider spacing={space.md} />
                            <Row style={{ justifyContent: 'space-between' }}>
                                <Text color="secondary">Item total</Text>
                                <Text variant="bodyStrong" tabular>
                                    ₹248
                                </Text>
                            </Row>
                            <Row style={{ justifyContent: 'space-between', marginTop: space.xs }}>
                                <Text color="secondary">You saved</Text>
                                <Text variant="bodyStrong" color="success" tabular>
                                    ₹52
                                </Text>
                            </Row>
                            <Divider variant="dashed" spacing={space.md} />
                            <Row style={{ justifyContent: 'space-between' }}>
                                <Text variant="title">To pay</Text>
                                <Text variant="title" tabular>
                                    ₹273
                                </Text>
                            </Row>
                        </Card>
                    </Section>

                    <Section title="Progress">
                        <Card>
                            <Text variant="label">
                                {progress >= 1 ? 'Yay! You got FREE delivery' : `Add ₹${Math.round((1 - progress) * 199)} more for FREE delivery`}
                            </Text>
                            <Spacer size="sm" />
                            <ProgressBar value={progress} color={colors.success} accessibilityLabel="Free delivery progress" />
                            <Spacer size="sm" />
                            <ProgressBar value={progress} height={4} accessibilityLabel="Order progress" />
                        </Card>
                        <Row style={{ gap: space.sm, marginTop: space.md }}>
                            <Button label="+25%" size="sm" variant="outline" onPress={() => setProgress((p) => Math.min(1, p + 0.25))} />
                            <Button label="Reset" size="sm" variant="ghost" onPress={() => setProgress(0.1)} />
                        </Row>
                    </Section>

                    <Section title="Skeleton">
                        <SkeletonGroup style={{ flexDirection: 'row', gap: space.md }}>
                            <SkeletonProductTile width={150} />
                            <SkeletonProductTile width={150} />
                        </SkeletonGroup>
                        <SkeletonGroup>
                            <SkeletonListRow />
                            <SkeletonListRow />
                        </SkeletonGroup>
                    </Section>

                    <Section title="Staggered list">
                        <View key={listKey} style={{ gap: space.sm }}>
                            {['Order #1042 · Delivered', 'Order #1039 · Delivered', 'Order #1031 · Cancelled', 'Order #1027 · Delivered'].map((o, i) => (
                                <AnimatedListItem key={o} index={i}>
                                    <Card padding="md" bordered elevation="none">
                                        <Text variant="bodyStrong">{o}</Text>
                                    </Card>
                                </AnimatedListItem>
                            ))}
                        </View>
                        <Button label="Replay" size="sm" variant="ghost" onPress={() => setListKey((k) => k + 1)} style={{ marginTop: space.sm }} />
                    </Section>

                    <Section title="3D icons" note={`Fluent Emoji 3D (MIT) · ${ICON_3D_NAMES.length} · only to identify a category · static`}>
                        <Row style={{ flexWrap: 'wrap', gap: space.sm }}>
                            {ICON_3D_NAMES.map((n) => (
                                <View key={n} style={styles.iconCell}>
                                    <Icon3D name={n} size={36} />
                                </View>
                            ))}
                        </Row>
                    </Section>

                    <Section title="Mascot" note="Flat, static, single entrance · empty / error / unserviceable states only">
                        <Row style={{ justifyContent: 'space-around' }}>
                            {['happy', 'sad', 'sleepy', 'loading'].map((m) => (
                                <View key={m} style={{ alignItems: 'center' }}>
                                    <Mascot mood={m} size={72} />
                                    <Text variant="caption" color="muted">
                                        {m}
                                    </Text>
                                </View>
                            ))}
                        </Row>
                    </Section>

                    <Section title="Empty state">
                        <Card padding={0}>
                            <EmptyState
                                mood={mood}
                                title={mood === 'sad' ? "We're not in your area yet" : 'Your cart is empty'}
                                subtitle={mood === 'sad' ? "We're expanding fast — check back soon." : 'Fresh groceries are 10 minutes away.'}
                                actionLabel="Start shopping"
                                onAction={() => setMood(mood === 'sad' ? 'sleepy' : 'sad')}
                            />
                        </Card>
                    </Section>

                    <Section title="Success + confetti" note="Violet check, one burst (violet · green · greys)">
                        <Card style={{ alignItems: 'center' }}>
                            <View>
                                <SuccessCheck status={checkStatus} onDone={() => confetti.current?.fire()} />
                                <ConfettiBurst ref={confetti} />
                            </View>
                            <Spacer size="md" />
                            <Button
                                label={checkStatus === 'loading' ? 'Resolve' : 'Reset'}
                                size="sm"
                                variant="outline"
                                style={{ alignSelf: 'center' }}
                                onPress={() => setCheckStatus((s) => (s === 'loading' ? 'success' : 'loading'))}
                            />
                        </Card>
                    </Section>

                    <Section title="Slide to confirm">
                        <SlideToConfirm
                            ref={slider}
                            label="Slide to pay ₹273"
                            confirmedLabel="Processing payment…"
                            loading={paying}
                            onConfirm={() => {
                                setPaying(true);
                                setTimeout(() => {
                                    setPaying(false);
                                    toast.success('Payment successful');
                                }, 1600);
                            }}
                        />
                        <Button label="Reset slider" size="sm" variant="ghost" onPress={() => slider.current?.reset()} style={{ marginTop: space.sm }} />
                    </Section>

                    <Section title="Toast">
                        <Row style={{ flexWrap: 'wrap', gap: space.sm }}>
                            <Button label="Default" size="sm" variant="outline" onPress={() => toast.show({ message: 'Added to wishlist', action: { label: 'View', onPress: () => {} } })} />
                            <Button label="Success" size="sm" variant="outline" onPress={() => toast.success('Address saved')} />
                            <Button label="Error" size="sm" variant="outline" onPress={() => toast.error('Payment failed', { description: 'No money was deducted. Try again.' })} />
                            <Button label="Info" size="sm" variant="outline" onPress={() => toast.info('Store closes at 11 PM')} />
                        </Row>
                    </Section>

                    <Section title="Floating dock" note="Solid surface, radius 18, one shadow · active = violet icon + label on the brand tint">
                        <View style={styles.dockStage}>
                            <FloatingDock items={DOCK} activeKey={dock} onSelect={setDock} style={{ left: space.sm, right: space.sm }} />
                        </View>
                    </Section>

                    <Section title="Bottom sheet">
                        <Row style={{ gap: space.sm }}>
                            <Button label="Edge sheet" size="sm" variant="outline" onPress={() => setSheet('edge')} />
                            <Button label="Floating sheet" size="sm" variant="outline" onPress={() => setSheet('float')} />
                        </Row>
                    </Section>
                </View>
            </ScrollView>
            </AnimatedScreen>

            <BottomSheet
                visible={sheet === 'edge'}
                onClose={() => setSheet(null)}
                title="Delivery instructions"
                subtitle="Help your delivery partner reach you faster"
                footer={<Button label="Save" fullWidth onPress={() => setSheet(null)} />}
            >
                <SheetTextInput placeholder="e.g. Ring the bell, leave at door" placeholderTextColor={colors.inkMuted} style={styles.input} />
            </BottomSheet>
            <BottomSheet visible={sheet === 'float'} onClose={() => setSheet(null)} floating title="Tip your delivery partner">
                <Row style={{ gap: space.sm }}>
                    {[20, 30, 50, 80].map((a) => (
                        <Chip key={a} tone="brand" label={`₹${a}`} selected={tip === a} onPress={() => setTip(a)} />
                    ))}
                </Row>
                <Spacer size="lg" />
                <Button label={`Add ₹${tip} tip`} fullWidth onPress={() => setSheet(null)} />
            </BottomSheet>
        </Screen>
    );
}

const useStyles = makeStyles((t) => ({
    brandStage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg, borderRadius: radii.card, marginTop: space.md },
    roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    roleCell: { width: 72, gap: space.xs },
    photoStage: { height: 168, borderRadius: radii.card, overflow: 'hidden', padding: space.md, justifyContent: 'space-between' },
    scrimFill: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
    cartPill: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: space.md,
        borderRadius: radii.card,
        backgroundColor: t.colors.surfaceNight,
        ...(t.isDark ? { borderWidth: 1, borderColor: t.colors.hairline } : null),
        ...t.shadows.floating,
    },
    iconCell: { width: 48, height: 48, borderRadius: radii.well, backgroundColor: t.colors.imageWell, alignItems: 'center', justifyContent: 'center' },
    flyCart: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        height: 40,
        paddingHorizontal: space.md,
        borderRadius: radii.button,
        backgroundColor: t.colors.surfaceNight,
    },
    flyWell: { height: 104, borderRadius: radii.well, backgroundColor: t.colors.imageWell, alignItems: 'center', justifyContent: 'center' },
    dockStage: { height: 96, borderRadius: radii.card, backgroundColor: t.colors.canvas, borderWidth: 1, borderColor: t.colors.hairline, overflow: 'hidden' },
    header: {
        paddingTop: space['4xl'],
        paddingHorizontal: space.lg,
        paddingBottom: space.lg,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.hairline,
    },
    search: {
        marginTop: space.lg,
        height: 48,
        borderRadius: radii.input,
        paddingHorizontal: space.md,
        flexDirection: 'row',
        alignItems: 'center',
    },
    body: { paddingHorizontal: space.lg },
    section: { marginTop: space['3xl'] },
    row: { flexDirection: 'row' },
    swatch: { height: 40, borderRadius: radii.chip, borderWidth: 1, borderColor: t.colors.hairline },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
    product: { width: '47%', flexGrow: 1, overflow: 'hidden' },
    productImg: { height: 120, alignItems: 'center', justifyContent: 'center', margin: space.xs + 2, borderRadius: radii.well },
    productBadge: { position: 'absolute', top: 6, left: 6 },
    productBody: { paddingHorizontal: space.md, paddingBottom: space.md, paddingTop: space.xs },
    productName: { marginTop: space.xs + 2, minHeight: 36 },
    productFoot: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.sm },
    catTile: { flex: 1, alignItems: 'center', borderRadius: radii.card },
    catImg: { alignSelf: 'stretch', height: 64, borderRadius: radii.well, backgroundColor: t.colors.imageWell, alignItems: 'center', justifyContent: 'center' },
    scrimDemo: { width: 56, height: 44, borderRadius: radii.chip, backgroundColor: t.colors.neutral[600], alignItems: 'center', justifyContent: 'center' },
    motionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, minHeight: 56, backgroundColor: t.colors.surface },
    collapseStage: { height: 260, borderRadius: radii.card, overflow: 'hidden', backgroundColor: t.colors.canvas, borderWidth: 1, borderColor: t.colors.hairline },
    input: {
        ...type.body,
        color: t.colors.ink,
        backgroundColor: t.colors.surfaceSunken,
        borderRadius: radii.input,
        paddingHorizontal: space.md,
        height: 48,
    },
}));
