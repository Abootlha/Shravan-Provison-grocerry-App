/**
 * Icon3D — soft 3D sticker icons (Microsoft Fluent Emoji 3D, MIT — see assets/icons3d/README.md).
 * 144px PNGs, crisp up to ~48pt on 3x screens and ~72pt on 2x.
 *
 * Props
 *   name      key of ICONS_3D (e.g. 'leafy_green', 'shopping_cart'). Unknown names fall back to 'basket'.
 *   size      pt (default 40)
 *   float     @deprecated — ignored. DESIGN.md: no idle loops; 3D icons only identify a category
 *             (category tabs / tiles without photos). No floating sticker clusters.
 *   delay     @deprecated — ignored
 *   style
 *   accessibilityLabel — decorative by default (hidden from screen readers)
 *
 * Helpers
 *   icon3dFor(categoryLike, fallback = 'basket') → icon name from a category / subcategory
 *     ({ name, translatedName, nameHi, key, icon }) or a plain string, matched by keywords
 *     (English + Hindi) with the MCI glyph as a second hint.
 *
 * Example
 *   <Icon3D name={icon3dFor(category)} size={44} />
 *   <Icon3D name="shopping_cart" size={96} />
 */
import React, { memo } from 'react';
import { Image, View } from 'react-native';

export const ICONS_3D = {
    baby_bottle: require('../../assets/icons3d/baby_bottle.png'),
    banana: require('../../assets/icons3d/banana.png'),
    basket: require('../../assets/icons3d/basket.png'),
    bell: require('../../assets/icons3d/bell.png'),
    beverage_box: require('../../assets/icons3d/beverage_box.png'),
    bread: require('../../assets/icons3d/bread.png'),
    broom: require('../../assets/icons3d/broom.png'),
    bubbles: require('../../assets/icons3d/bubbles.png'),
    candy: require('../../assets/icons3d/candy.png'),
    carrot: require('../../assets/icons3d/carrot.png'),
    cheese_wedge: require('../../assets/icons3d/cheese_wedge.png'),
    chocolate_bar: require('../../assets/icons3d/chocolate_bar.png'),
    coconut: require('../../assets/icons3d/coconut.png'),
    coin: require('../../assets/icons3d/coin.png'),
    cooked_rice: require('../../assets/icons3d/cooked_rice.png'),
    cookie: require('../../assets/icons3d/cookie.png'),
    croissant: require('../../assets/icons3d/croissant.png'),
    cup_with_straw: require('../../assets/icons3d/cup_with_straw.png'),
    egg: require('../../assets/icons3d/egg.png'),
    fire: require('../../assets/icons3d/fire.png'),
    gear: require('../../assets/icons3d/gear.png'),
    glass_of_milk: require('../../assets/icons3d/glass_of_milk.png'),
    globe_with_meridians: require('../../assets/icons3d/globe_with_meridians.png'),
    herb: require('../../assets/icons3d/herb.png'),
    high_voltage: require('../../assets/icons3d/high_voltage.png'),
    honey_pot: require('../../assets/icons3d/honey_pot.png'),
    hot_beverage: require('../../assets/icons3d/hot_beverage.png'),
    hot_pepper: require('../../assets/icons3d/hot_pepper.png'),
    house: require('../../assets/icons3d/house.png'),
    jar: require('../../assets/icons3d/jar.png'),
    leafy_green: require('../../assets/icons3d/leafy_green.png'),
    locked: require('../../assets/icons3d/locked.png'),
    lotion_bottle: require('../../assets/icons3d/lotion_bottle.png'),
    magnifying_glass_tilted_left: require('../../assets/icons3d/magnifying_glass_tilted_left.png'),
    mango: require('../../assets/icons3d/mango.png'),
    mobile_phone: require('../../assets/icons3d/mobile_phone.png'),
    motor_scooter: require('../../assets/icons3d/motor_scooter.png'),
    package: require('../../assets/icons3d/package.png'),
    party_popper: require('../../assets/icons3d/party_popper.png'),
    paw_prints: require('../../assets/icons3d/paw_prints.png'),
    pill: require('../../assets/icons3d/pill.png'),
    popcorn: require('../../assets/icons3d/popcorn.png'),
    red_apple: require('../../assets/icons3d/red_apple.png'),
    red_heart: require('../../assets/icons3d/red_heart.png'),
    round_pushpin: require('../../assets/icons3d/round_pushpin.png'),
    salt: require('../../assets/icons3d/salt.png'),
    shallow_pan_of_food: require('../../assets/icons3d/shallow_pan_of_food.png'),
    sheaf_of_rice: require('../../assets/icons3d/sheaf_of_rice.png'),
    shopping_bags: require('../../assets/icons3d/shopping_bags.png'),
    shopping_cart: require('../../assets/icons3d/shopping_cart.png'),
    soap: require('../../assets/icons3d/soap.png'),
    soft_ice_cream: require('../../assets/icons3d/soft_ice_cream.png'),
    sparkles: require('../../assets/icons3d/sparkles.png'),
    speech_balloon: require('../../assets/icons3d/speech_balloon.png'),
    sponge: require('../../assets/icons3d/sponge.png'),
    stopwatch: require('../../assets/icons3d/stopwatch.png'),
    teacup_without_handle: require('../../assets/icons3d/teacup_without_handle.png'),
    ticket: require('../../assets/icons3d/ticket.png'),
    tomato: require('../../assets/icons3d/tomato.png'),
    toothbrush: require('../../assets/icons3d/toothbrush.png'),
    wrapped_gift: require('../../assets/icons3d/wrapped_gift.png'),
};

export const ICON_3D_NAMES = Object.keys(ICONS_3D);

// Order matters: the first rule that matches wins (specific before generic).
const RULES = [
    [/baby|diaper|infant|बेबी|शिशु/i, 'baby_bottle'],
    [/\bpets?\b|dog|cat food|पालतू/i, 'paw_prints'],
    [/pharma|health|medicine|wellness|दवा/i, 'pill'],
    [/ice ?cream|frozen|dessert|आइसक्रीम/i, 'soft_ice_cream'],
    [/chocolate|sweet|candy|mithai|मिठाई|चॉकलेट/i, 'chocolate_bar'],
    [/\btea\b|chai|चाय/i, 'teacup_without_handle'],
    [/coffee|कॉफ़ी|कॉफी/i, 'hot_beverage'],
    [/drink|soda|cola|ड्रिंक/i, 'cup_with_straw'],
    [/juice|beverage|जूस/i, 'beverage_box'],
    [/fruits? ?(&|and)? ?veg|produce|फल और/i, 'leafy_green'],
    [/leaf|herb|coriander|dhania|पत्त/i, 'herb'],
    [/vegetable|veggie|sabzi|सब्ज़/i, 'carrot'],
    [/mango|आम/i, 'mango'],
    [/banana|केला/i, 'banana'],
    [/tomato|टमाटर/i, 'tomato'],
    [/fruit|फल/i, 'red_apple'],
    [/dairy|milk|डेयरी|दूध/i, 'glass_of_milk'],
    [/paneer|cheese|butter|पनीर/i, 'cheese_wedge'],
    [/\beggs?\b|अंडे/i, 'egg'],
    [/bakery|cake|rusk|croissant/i, 'croissant'],
    [/bread|\bpav\b|\bbuns?\b|ब्रेड/i, 'bread'],
    [/atta|flour|grain|आटा/i, 'sheaf_of_rice'],
    [/\brice\b|चावल/i, 'cooked_rice'],
    [/\bdals?\b|pulse|lentil|दाल/i, 'shallow_pan_of_food'],
    [/ghee|honey|spread|\bjams?\b|sauce|ketchup|घी/i, 'honey_pot'],
    [/masala|spice|मसाले|मसाला/i, 'hot_pepper'],
    [/\boils?\b|तेल/i, 'coconut'],
    [/\bsalt\b|नमक/i, 'salt'],
    [/biscuit|cookie|बिस्कुट/i, 'cookie'],
    [/noodle|pasta|instant|ready to/i, 'shallow_pan_of_food'],
    [/snack|munch|chips|namkeen|स्नैक/i, 'popcorn'],
    [/dish|utensil|bartan/i, 'sponge'],
    [/detergent|laundry|wash/i, 'bubbles'],
    [/floor|toilet|broom/i, 'broom'],
    [/clean|सफ़ाई|सफाई/i, 'sponge'],
    [/oral|tooth|दांत/i, 'toothbrush'],
    [/bath|body|soap|साबुन/i, 'soap'],
    [/\bhair|skin|beauty|lotion|cream/i, 'lotion_bottle'],
    [/personal|care|पर्सनल/i, 'lotion_bottle'],
    [/household|kitchen|\bhome\b/i, 'house'],
    [/^\s*(all|सभी)\s*$/i, 'shopping_bags'],
];

// MaterialCommunityIcons glyph → sticker (second hint when the name doesn't match).
const GLYPHS = [
    [/fruit|apple|watermelon/, 'red_apple'],
    [/carrot/, 'carrot'],
    [/leaf/, 'herb'],
    [/egg/, 'egg'],
    [/cup|milk/, 'glass_of_milk'],
    [/bread/, 'bread'],
    [/cheese/, 'cheese_wedge'],
    [/rice/, 'cooked_rice'],
    [/grain|seed/, 'sheaf_of_rice'],
    [/shaker/, 'hot_pepper'],
    [/bottle-tonic/, 'coconut'],
    [/pot/, 'honey_pot'],
    [/cookie/, 'cookie'],
    [/noodle|food/, 'popcorn'],
    [/soda|cocktail|glass/, 'cup_with_straw'],
    [/tea/, 'teacup_without_handle'],
    [/coffee/, 'hot_beverage'],
    [/washing|spray/, 'bubbles'],
    [/silverware/, 'sponge'],
    [/broom/, 'broom'],
    [/shower/, 'soap'],
    [/tooth/, 'toothbrush'],
    [/hair|face/, 'lotion_bottle'],
    [/baby/, 'baby_bottle'],
    [/basket|cart/, 'basket'],
];

export function icon3dFor(item, fallback = 'basket') {
    if (!item) return fallback;
    if (typeof item === 'string') {
        const hit = RULES.find(([re]) => re.test(item));
        return hit ? hit[1] : fallback;
    }
    if (item.icon3d && ICONS_3D[item.icon3d]) return item.icon3d;
    const text = [item.name, item.translatedName, item.nameHi, item.key].filter(Boolean).join(' ');
    const hit = RULES.find(([re]) => re.test(text));
    if (hit) return hit[1];
    const glyph = typeof item.icon === 'string' ? item.icon : '';
    const g = glyph && GLYPHS.find(([re]) => re.test(glyph));
    return g ? g[1] : fallback;
}

// `float` / `delay` are accepted for old call sites and ignored (no idle motion).
// eslint-disable-next-line no-unused-vars
export const Icon3D = memo(({ name, size = 40, float, delay, style, accessibilityLabel }) => {
    const image = (
        <Image
            source={ICONS_3D[name] || ICONS_3D.basket}
            style={{ width: size, height: size }}
            resizeMode="contain"
            accessible={!!accessibilityLabel}
            accessibilityLabel={accessibilityLabel}
            accessibilityIgnoresInvertColors
        />
    );

    return (
        <View style={[style, { pointerEvents: 'none' }]} importantForAccessibility={accessibilityLabel ? 'auto' : 'no-hide-descendants'}>
            {image}
        </View>
    );
});

export default Icon3D;
