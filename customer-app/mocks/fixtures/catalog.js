import { oid, KIND, placeholder } from './ids';
import { Asset } from 'expo-asset';

const CREATED_AT = '2026-06-01T09:00:00.000Z';

// Square crop so the product fills a square card image.
const photo = (id) => `https://images.unsplash.com/photo-${id}?w=400&h=400&q=70&fit=crop`;

// Verified to resolve (HTTP 200 image/jpeg) on images.unsplash.com.
export const PHOTOS = {
    produce: photo('1610832958506-aa56368176cf'),
    vegMarket: photo('1488459716781-31db52582fe9'),
    tomato: photo('1592924357228-91a4daadcfea'),
    potato: photo('1518977676601-b53f82aba655'),
    onion: photo('1618512496248-a07fe83aa8cb'),
    banana: photo('1571771894821-ce9b6c11b08e'),
    bananaAlt: photo('1528825871115-3581a5387919'),
    apple: photo('1560806887-1e4cd0b6cbd6'),
    mango: photo('1553279768-865429fa0078'),
    milk: photo('1550583724-b2692b85b150'),
    milkBottle: photo('1563636619-e9143da7973b'),
    bread: photo('1509440159596-0249088772ff'),
    eggs: photo('1582722872445-44dc5f7e3c8f'),
    rice: photo('1586201375761-83865001e31c'),
    oil: photo('1474979266404-7eaacbcd87c5'),
    spices: photo('1596040033229-a9821ebd058d'),
    chips: photo('1566478989037-eec170784d0b'),
    chipsBowl: photo('1621939514649-280e2ee25f60'),
    soda: photo('1622483767028-3f66f32aef97'),
    juice: photo('1600271886742-f049cd451bba'),
    tea: photo('1544787219-7f47ccb76574'),
    coffee: photo('1559056199-641a0ac8b55e'),
    cleaning: photo('1585421514738-01798e348b17'),
    personalCare: photo('1556228578-8c89e6adf883'),
    baby: photo('1515488042361-ee00e0ddd4e4'),
    grocery: photo('1542838132-92c53300491e'),
    okra: photo('1425543103986-22abb7d7e8d2'),
    coriander: photo('1709482107035-9ac8a2fb2ac9'),
    greenChilli: photo('1599987141071-f5810d32e21a'),
    yogurt: photo('1571212515416-fef01fc43637'),
    paneer: photo('1567188040759-fb8a883dc6d8'),
    butter: photo('1589985270826-4b7bb135bc9d'),
    atta: photo('1627735483792-233bf632619b'),
    attaAlt: photo('1610725664285-7c57e6eeac3f'),
    toorDal: photo('1612869538502-b5baa439abd7'),
    moongDal: photo('1594900799266-0e56587ba586'),
    besan: photo('1595414902678-862fe51c9f27'),
    salt: photo('1517856497829-3047e3fffae1'),
    ghee: photo('1601232265936-6da280cff563'),
    gheeAlt: photo('1573812461383-e5f8b759d12e'),
    cookies: photo('1597733153203-a54d0fbc47de'),
    glucoseBiscuits: photo('1585329678734-285d3adee73c'),
    roundBiscuits: photo('1598962073869-f9282d672af0'),
    noodles: photo('1612927601601-6638404737ce'),
    ketchup: photo('1569790554690-1c0877b2fc6c'),
    soapBar: photo('1607006344152-62699f97b42c'),
    dishGel: photo('1647577746559-c9a28c0d0870'),
    toiletCleaner: photo('1649944607215-33cea628763f'),
    floorCleaner: photo('1624377225030-f0bb343eaa4d'),
    toothpaste: photo('1612705166160-97d3b2e8e212'),
    babyFood: photo('1544829832-c8047d6b9d89'),
};

// key, name, nameHi, MaterialCommunityIcons icon, tint, image
const CATEGORY_ROWS = [
    ['fruits', 'Fruits & Vegetables', 'फल और सब्ज़ियाँ', 'fruit-watermelon', '#E8F5E9', PHOTOS.produce],
    ['dairy', 'Dairy, Bread & Eggs', 'डेयरी, ब्रेड और अंडे', 'egg', '#FFF8E1', PHOTOS.milk],
    ['atta', 'Atta, Rice & Dal', 'आटा, चावल और दाल', 'rice', '#FBE9E7', PHOTOS.rice],
    ['masala', 'Masala & Oil', 'मसाले और तेल', 'shaker-outline', '#FFF3E0', PHOTOS.spices],
    ['snacks', 'Snacks & Munchies', 'स्नैक्स', 'cookie', '#FCE4EC', PHOTOS.chips],
    ['drinks', 'Cold Drinks & Juices', 'कोल्ड ड्रिंक्स और जूस', 'bottle-soda-classic-outline', '#E3F2FD', PHOTOS.soda],
    ['tea', 'Tea, Coffee & More', 'चाय, कॉफ़ी', 'coffee', '#EFEBE9', PHOTOS.tea],
    ['cleaning', 'Cleaning Essentials', 'सफ़ाई का सामान', 'spray-bottle', '#E0F7FA', PHOTOS.cleaning],
    ['personal', 'Personal Care', 'पर्सनल केयर', 'face-woman-shimmer-outline', '#F3E5F5', PHOTOS.personalCare],
    ['baby', 'Baby Care', 'बेबी केयर', 'baby-face-outline', '#E8EAF6', PHOTOS.baby],
];

export const categories = CATEGORY_ROWS.map(([key, name, nameHi, icon, color, image], i) => ({
    _id: oid(KIND.category, i + 1),
    key,
    name,
    nameHi,
    icon,
    color,
    image,
    isActive: true,
    sortOrder: i + 1,
    type: 'category',
    level: 0,
    parentId: null,
    description: `${name} delivered in minutes`,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
}));

export const categoryByKey = Object.fromEntries(categories.map((c) => [c.key, c]));

// categoryKey -> [subKey, name, icon]
const SUBCATEGORY_ROWS = {
    fruits: [['veg', 'Fresh Vegetables', 'carrot'], ['fruit', 'Fresh Fruits', 'food-apple'], ['herbs', 'Leafy & Herbs', 'leaf']],
    dairy: [['milk', 'Milk', 'cup'], ['bread', 'Bread & Pav', 'bread-slice'], ['eggs', 'Eggs', 'egg'], ['paneer', 'Paneer, Butter & Cheese', 'cheese']],
    atta: [['flour', 'Atta & Flours', 'grain'], ['rice', 'Rice', 'rice'], ['dal', 'Dals & Pulses', 'seed']],
    masala: [['spices', 'Masala & Spices', 'shaker'], ['oil', 'Edible Oils', 'bottle-tonic'], ['ghee', 'Ghee', 'pot']],
    snacks: [['chips', 'Chips & Namkeen', 'food'], ['biscuits', 'Biscuits & Cookies', 'cookie'], ['noodles', 'Noodles & Pasta', 'noodles']],
    drinks: [['soft', 'Soft Drinks', 'bottle-soda'], ['juice', 'Juices', 'glass-cocktail']],
    tea: [['tea', 'Tea', 'tea'], ['coffee', 'Coffee', 'coffee']],
    cleaning: [['detergent', 'Detergents', 'washing-machine'], ['dish', 'Dishwash', 'silverware-clean'], ['floor', 'Floor & Toilet', 'broom']],
    personal: [['bath', 'Bath & Body', 'shower'], ['oral', 'Oral Care', 'toothbrush'], ['hair', 'Hair Care', 'hair-dryer']],
    baby: [['diapers', 'Diapers & Wipes', 'baby-carriage'], ['babyfood', 'Baby Food', 'baby-bottle-outline']],
};

let subCounter = 0;
export const subcategories = categories.flatMap((cat) => (SUBCATEGORY_ROWS[cat.key] || []).map(([subKey, name, icon], i) => {
    subCounter += 1;
    return {
        _id: oid(KIND.subcategory, subCounter),
        key: `${cat.key}.${subKey}`,
        name,
        icon,
        color: cat.color,
        image: '',
        parentId: cat._id,
        isActive: true,
        sortOrder: i + 1,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
    };
}));

export const subcategoryByKey = Object.fromEntries(subcategories.map((s) => [s.key, s]));

// One item group per subcategory keeps /item-groups realistic without bloat.
export const itemGroups = subcategories.map((sub, i) => ({
    _id: oid(KIND.itemGroup, i + 1),
    name: `Popular ${sub.name}`,
    subcategoryId: sub._id,
    isActive: true,
    sortOrder: 1,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
}));

const BRAND_NAMES = [
    'Fresho', 'Amul', 'Mother Dairy', 'Britannia', 'Harvest Gold', 'Aashirvaad', 'Fortune', 'India Gate',
    'Tata Sampann', 'Tata Tea', 'MDH', 'Everest', 'Saffola', "Haldiram's", 'Lay\'s', 'Parle', 'Maggi',
    'Coca-Cola', 'Thums Up', 'Real', 'Paper Boat', 'Red Label', 'Nescafe', 'Bru', 'Surf Excel', 'Vim',
    'Harpic', 'Lizol', 'Dove', 'Colgate', 'Head & Shoulders', 'Pampers', 'Cerelac', 'Patanjali', 'Kissan',
];

export const brands = BRAND_NAMES.map((name, i) => ({
    _id: oid(KIND.brand, i + 1),
    name,
    logo: placeholder(name, 'FFFFFF', '0F172A'),
    isActive: true,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
}));

// Product pack shots: transparent cut-outs, trimmed, centred on a square with a 6% margin, 480px WebP.
// Made from Open Food Facts / Open Beauty Facts "front" photos (CC-BY-SA 3.0) and Unsplash photos,
// background removed with rembg. Credits and licence: mocks/README.md → "Pack shot credits".
// Bundled (not hot-linked) so the mock catalogue renders offline; mocks/ never ships in release builds.
const packshot = (mod) => Asset.fromModule(mod).uri;
const PACKSHOTS = {
    'Fresh Tomato (Hybrid)': packshot(require('../packshots/tomato.webp')),
    'Potato (Aloo)': packshot(require('../packshots/potato.webp')),
    'Onion (Pyaaz)': packshot(require('../packshots/onion.webp')),
    'Lady Finger (Bhindi)': packshot(require('../packshots/okra.webp')),
    'Banana Robusta': packshot(require('../packshots/banana.webp')),
    'Shimla Apple': packshot(require('../packshots/apple.webp')),
    'Alphonso Mango': packshot(require('../packshots/mango.webp')),
    'Coriander Leaves (Dhaniya)': packshot(require('../packshots/coriander.webp')),
    'Green Chilli': packshot(require('../packshots/greenChilli.webp')),
    'Amul Taaza Toned Fresh Milk': packshot(require('../packshots/amulTaaza.webp')),
    'Mother Dairy Full Cream Milk': packshot(require('../packshots/motherDairy.webp')),
    'Amul Masti Dahi': packshot(require('../packshots/amulDahi.webp')),
    'Britannia 100% Whole Wheat Bread': packshot(require('../packshots/britanniaBread.webp')),
    'Harvest Gold White Bread': packshot(require('../packshots/harvestGold.webp')),
    'Farm Fresh White Eggs': packshot(require('../packshots/eggs.webp')),
    'Amul Malai Paneer': packshot(require('../packshots/amulPaneer.webp')),
    'Amul Pasteurised Butter': packshot(require('../packshots/amulButter.webp')),
    'Aashirvaad Shudh Chakki Atta': packshot(require('../packshots/aashirvaadAtta.webp')),
    'Fortune Chakki Fresh Atta': packshot(require('../packshots/fortuneAtta.webp')),
    'India Gate Basmati Rice Classic': packshot(require('../packshots/indiaGate.webp')),
    'Fortune Rozana Basmati Rice': packshot(require('../packshots/fortuneRice.webp')),
    'Tata Sampann Unpolished Toor Dal': packshot(require('../packshots/toorDal.webp')),
    'Tata Sampann Moong Dal': packshot(require('../packshots/moongDal.webp')),
    'Aashirvaad Besan': packshot(require('../packshots/besan.webp')),
    'MDH Deggi Mirch': packshot(require('../packshots/mdhDeggi.webp')),
    'Everest Garam Masala': packshot(require('../packshots/everestGaram.webp')),
    'Tata Salt Iodised': packshot(require('../packshots/tataSalt.webp')),
    'Fortune Sunlite Refined Sunflower Oil': packshot(require('../packshots/fortuneSunlite.webp')),
    'Saffola Gold Refined Oil': packshot(require('../packshots/saffolaGold.webp')),
    'Fortune Kachi Ghani Mustard Oil': packshot(require('../packshots/mustardOil.webp')),
    'Amul Pure Ghee': packshot(require('../packshots/amulGhee.webp')),
    'Patanjali Cow Ghee': packshot(require('../packshots/patanjaliGhee.webp')),
    "Haldiram's Aloo Bhujia": packshot(require('../packshots/alooBhujia.webp')),
    "Haldiram's Moong Dal": packshot(require('../packshots/haldiramMoong.webp')),
    "Lay's India's Magic Masala Chips": packshot(require('../packshots/lays.webp')),
    'Britannia Good Day Cashew Cookies': packshot(require('../packshots/goodDay.webp')),
    'Parle-G Original Glucose Biscuits': packshot(require('../packshots/parleG.webp')),
    'Britannia Marie Gold': packshot(require('../packshots/marieGold.webp')),
    'Maggi 2-Minute Masala Noodles': packshot(require('../packshots/maggi.webp')),
    'Kissan Fresh Tomato Ketchup': packshot(require('../packshots/kissan.webp')),
    'Coca-Cola Soft Drink': packshot(require('../packshots/coke.webp')),
    'Thums Up Soft Drink': packshot(require('../packshots/thumsUp.webp')),
    'Real Fruit Power Mixed Fruit Juice': packshot(require('../packshots/realJuice.webp')),
    'Paper Boat Aamras': packshot(require('../packshots/paperBoat.webp')),
    'Tata Tea Gold': packshot(require('../packshots/tataTea.webp')),
    'Red Label Natural Care Tea': packshot(require('../packshots/redLabel.webp')),
    'Nescafe Classic Instant Coffee': packshot(require('../packshots/nescafe.webp')),
    'Bru Instant Coffee': packshot(require('../packshots/bru.webp')),
    'Surf Excel Easy Wash Detergent Powder': packshot(require('../packshots/surfPowder.webp')),
    'Surf Excel Matic Liquid Front Load': packshot(require('../packshots/surfMatic.webp')),
    'Vim Lemon Dishwash Bar': packshot(require('../packshots/vimBar.webp')),
    'Vim Dishwash Gel Lemon': packshot(require('../packshots/vimGel.webp')),
    'Harpic Power Plus Toilet Cleaner': packshot(require('../packshots/harpic.webp')),
    'Lizol Disinfectant Floor Cleaner Citrus': packshot(require('../packshots/lizol.webp')),
    'Dove Cream Beauty Bathing Bar': packshot(require('../packshots/dove.webp')),
    'Colgate Strong Teeth Toothpaste': packshot(require('../packshots/colgate.webp')),
    'Head & Shoulders Anti Dandruff Shampoo': packshot(require('../packshots/shampoo.webp')),
    'Pampers Baby Dry Pants (M)': packshot(require('../packshots/pampersPants.webp')),
    'Pampers Baby Gentle Wipes': packshot(require('../packshots/pampersWipes.webp')),
    'Nestle Cerelac Wheat Apple': packshot(require('../packshots/cerelac.webp')),
};

const tint = (catKey) =>(categoryByKey[catKey]?.color || '#F1F5F9').replace('#', '');

// name, brand, sub key, unit, weight(g), mrp, price, stock, rating, reviews, image (PHOTOS key or null => tinted placeholder), storage, dietary
const PRODUCT_ROWS = [
    // Fruits & Vegetables
    ['Fresh Tomato (Hybrid)', 'Fresho', 'fruits.veg', '500 g', 500, 40, 29, 120, 4.3, 1840, 'tomato'],
    ['Potato (Aloo)', 'Fresho', 'fruits.veg', '1 kg', 1000, 45, 35, 200, 4.4, 2310, 'potato'],
    ['Onion (Pyaaz)', 'Fresho', 'fruits.veg', '1 kg', 1000, 60, 46, 180, 4.2, 2650, 'onion'],
    ['Lady Finger (Bhindi)', 'Fresho', 'fruits.veg', '250 g', 250, 30, 24, 0, 4.0, 410, 'okra'],
    ['Banana Robusta', 'Fresho', 'fruits.fruit', '6 pcs', 900, 60, 48, 90, 4.5, 3120, 'banana'],
    ['Shimla Apple', 'Fresho', 'fruits.fruit', '4 pcs (approx. 550 g)', 550, 180, 149, 60, 4.3, 980, 'apple'],
    ['Alphonso Mango', 'Fresho', 'fruits.fruit', '2 pcs (approx. 500 g)', 500, 220, 189, 25, 4.7, 760, 'mango'],
    ['Coriander Leaves (Dhaniya)', 'Fresho', 'fruits.herbs', '100 g', 100, 20, 12, 70, 4.1, 1290, 'coriander'],
    ['Green Chilli', 'Fresho', 'fruits.herbs', '100 g', 100, 15, 10, 85, 4.2, 870, 'greenChilli'],

    // Dairy, Bread & Eggs
    ['Amul Taaza Toned Fresh Milk', 'Amul', 'dairy.milk', '1 L', 1030, 56, 54, 150, 4.6, 5420, 'milk', 'Refrigerated'],
    ['Mother Dairy Full Cream Milk', 'Mother Dairy', 'dairy.milk', '500 ml', 515, 35, 34, 110, 4.5, 2210, 'milkBottle', 'Refrigerated'],
    ['Amul Masti Dahi', 'Amul', 'dairy.milk', '400 g', 400, 35, 33, 0, 4.4, 1430, 'yogurt', 'Refrigerated'],
    ['Britannia 100% Whole Wheat Bread', 'Britannia', 'dairy.bread', '400 g', 400, 55, 50, 40, 4.3, 1660, 'bread'],
    ['Harvest Gold White Bread', 'Harvest Gold', 'dairy.bread', '350 g', 350, 40, 38, 35, 4.1, 920, 'bread'],
    ['Farm Fresh White Eggs', 'Fresho', 'dairy.eggs', '6 pcs', 330, 54, 45, 75, 4.4, 2040, 'eggs', 'Refrigerated'],
    ['Amul Malai Paneer', 'Amul', 'dairy.paneer', '200 g', 200, 95, 90, 30, 4.5, 1880, 'paneer', 'Refrigerated'],
    ['Amul Pasteurised Butter', 'Amul', 'dairy.paneer', '100 g', 100, 58, 56, 65, 4.7, 4310, 'butter', 'Refrigerated'],

    // Atta, Rice & Dal
    ['Aashirvaad Shudh Chakki Atta', 'Aashirvaad', 'atta.flour', '5 kg', 5000, 295, 249, 50, 4.6, 7820, 'atta'],
    ['Fortune Chakki Fresh Atta', 'Fortune', 'atta.flour', '5 kg', 5000, 280, 235, 0, 4.4, 2140, 'attaAlt'],
    ['India Gate Basmati Rice Classic', 'India Gate', 'atta.rice', '1 kg', 1000, 210, 175, 45, 4.5, 3390, 'rice'],
    ['Fortune Rozana Basmati Rice', 'Fortune', 'atta.rice', '5 kg', 5000, 525, 419, 20, 4.2, 1210, 'rice'],
    ['Tata Sampann Unpolished Toor Dal', 'Tata Sampann', 'atta.dal', '1 kg', 1000, 230, 189, 60, 4.5, 2870, 'toorDal'],
    ['Tata Sampann Moong Dal', 'Tata Sampann', 'atta.dal', '500 g', 500, 112, 94, 40, 4.4, 1120, 'moongDal'],
    ['Aashirvaad Besan', 'Aashirvaad', 'atta.flour', '500 g', 500, 75, 62, 55, 4.3, 640, 'besan'],

    // Masala & Oil
    ['MDH Deggi Mirch', 'MDH', 'masala.spices', '100 g', 100, 98, 89, 80, 4.6, 2210, 'spices'],
    ['Everest Garam Masala', 'Everest', 'masala.spices', '100 g', 100, 92, 84, 70, 4.5, 1980, 'spices'],
    ['Tata Salt Iodised', 'Tata Sampann', 'masala.spices', '1 kg', 1000, 28, 27, 300, 4.7, 9020, 'salt'],
    ['Fortune Sunlite Refined Sunflower Oil', 'Fortune', 'masala.oil', '1 L', 910, 175, 139, 90, 4.4, 4410, 'oil'],
    ['Saffola Gold Refined Oil', 'Saffola', 'masala.oil', '1 L', 910, 210, 185, 40, 4.5, 2560, 'oil'],
    ['Fortune Kachi Ghani Mustard Oil', 'Fortune', 'masala.oil', '1 L', 910, 199, 165, 0, 4.5, 3180, 'oil'],
    ['Amul Pure Ghee', 'Amul', 'masala.ghee', '1 L', 905, 650, 599, 35, 4.8, 6120, 'ghee'],
    ['Patanjali Cow Ghee', 'Patanjali', 'masala.ghee', '500 ml', 455, 345, 315, 25, 4.3, 1640, 'gheeAlt'],

    // Snacks & Munchies
    ["Haldiram's Aloo Bhujia", "Haldiram's", 'snacks.chips', '400 g', 400, 110, 99, 85, 4.6, 5230, 'chipsBowl'],
    ["Haldiram's Moong Dal", "Haldiram's", 'snacks.chips', '200 g', 200, 55, 50, 60, 4.4, 1890, 'chipsBowl'],
    ["Lay's India's Magic Masala Chips", "Lay's", 'snacks.chips', '52 g', 52, 20, 20, 140, 4.5, 6740, 'chips'],
    ['Britannia Good Day Cashew Cookies', 'Britannia', 'snacks.biscuits', '200 g', 200, 40, 36, 110, 4.4, 2310, 'cookies'],
    ['Parle-G Original Glucose Biscuits', 'Parle', 'snacks.biscuits', '800 g', 800, 90, 85, 95, 4.7, 8820, 'glucoseBiscuits'],
    ['Britannia Marie Gold', 'Britannia', 'snacks.biscuits', '250 g', 250, 40, 38, 0, 4.3, 1470, 'roundBiscuits'],
    ['Maggi 2-Minute Masala Noodles', 'Maggi', 'snacks.noodles', '4 x 70 g', 280, 60, 56, 160, 4.6, 9910, 'noodles'],
    ['Kissan Fresh Tomato Ketchup', 'Kissan', 'snacks.noodles', '850 g', 850, 160, 129, 45, 4.5, 2380, 'ketchup'],

    // Cold Drinks & Juices
    ['Coca-Cola Soft Drink', 'Coca-Cola', 'drinks.soft', '750 ml', 790, 45, 40, 100, 4.5, 3640, 'soda'],
    ['Thums Up Soft Drink', 'Thums Up', 'drinks.soft', '750 ml', 790, 45, 40, 95, 4.6, 4120, 'soda'],
    ['Real Fruit Power Mixed Fruit Juice', 'Real', 'drinks.juice', '1 L', 1050, 130, 110, 50, 4.3, 1530, 'juice'],
    ['Paper Boat Aamras', 'Paper Boat', 'drinks.juice', '600 ml', 620, 99, 89, 0, 4.4, 760, 'juice'],

    // Tea, Coffee & More
    ['Tata Tea Gold', 'Tata Tea', 'tea.tea', '500 g', 500, 340, 299, 60, 4.6, 4870, 'tea'],
    ['Red Label Natural Care Tea', 'Red Label', 'tea.tea', '250 g', 250, 160, 145, 45, 4.4, 1720, 'tea'],
    ['Nescafe Classic Instant Coffee', 'Nescafe', 'tea.coffee', '100 g', 100, 360, 315, 30, 4.6, 3910, 'coffee'],
    ['Bru Instant Coffee', 'Bru', 'tea.coffee', '100 g', 100, 280, 245, 35, 4.4, 2140, 'coffee'],

    // Cleaning Essentials
    ['Surf Excel Easy Wash Detergent Powder', 'Surf Excel', 'cleaning.detergent', '1.5 kg', 1500, 245, 215, 55, 4.5, 3480, 'cleaning'],
    ['Surf Excel Matic Liquid Front Load', 'Surf Excel', 'cleaning.detergent', '1 L', 1100, 325, 289, 20, 4.6, 1980, 'cleaning'],
    ['Vim Lemon Dishwash Bar', 'Vim', 'cleaning.dish', '3 x 200 g', 600, 60, 55, 120, 4.5, 4120, 'soapBar'],
    ['Vim Dishwash Gel Lemon', 'Vim', 'cleaning.dish', '750 ml', 790, 199, 165, 40, 4.4, 1330, 'dishGel'],
    ['Harpic Power Plus Toilet Cleaner', 'Harpic', 'cleaning.floor', '1 L', 1100, 215, 189, 50, 4.6, 2760, 'toiletCleaner'],
    ['Lizol Disinfectant Floor Cleaner Citrus', 'Lizol', 'cleaning.floor', '975 ml', 1050, 229, 199, 0, 4.5, 2190, 'floorCleaner'],

    // Personal Care
    ['Dove Cream Beauty Bathing Bar', 'Dove', 'personal.bath', '3 x 100 g', 300, 210, 179, 60, 4.6, 3320, 'personalCare'],
    ['Colgate Strong Teeth Toothpaste', 'Colgate', 'personal.oral', '300 g', 300, 156, 129, 80, 4.5, 5260, 'toothpaste'],
    ['Head & Shoulders Anti Dandruff Shampoo', 'Head & Shoulders', 'personal.hair', '340 ml', 360, 399, 335, 30, 4.4, 1890, 'personalCare'],

    // Baby Care
    ['Pampers Baby Dry Pants (M)', 'Pampers', 'baby.diapers', '56 pcs', 1500, 1199, 899, 20, 4.6, 2740, 'baby'],
    ['Pampers Baby Gentle Wipes', 'Pampers', 'baby.diapers', '72 pcs', 400, 299, 199, 0, 4.4, 980, 'baby'],
    ['Nestle Cerelac Wheat Apple', 'Cerelac', 'baby.babyfood', '300 g', 300, 295, 285, 25, 4.7, 1560, 'babyFood'],
];

const describe = (name, brand, unit, catName) => (
    `${name} by ${brand}. ${unit} pack, sourced fresh and delivered from our Gorakhpur dark store. Part of our ${catName} range.`
);

const highlightsFor = (storage) => (
    storage === 'Refrigerated'
        ? 'Keep refrigerated. Best consumed before the date on the pack.'
        : 'Store in a cool, dry place away from direct sunlight.'
);

export const products = PRODUCT_ROWS.map((row, i) => {
    const [name, brand, subKey, unit, weight, mrp, price, stock, rating, reviewCount, photoKey, storage = 'Ambient'] = row;
    const sub = subcategoryByKey[subKey];
    const catKey = subKey.split('.')[0];
    const cat = categoryByKey[catKey];
    const subIndex = subcategories.indexOf(sub);
    const image = PACKSHOTS[name] || (photoKey ? PHOTOS[photoKey] : null) || placeholder(name, tint(catKey), '1F2937');
    const isPerishable = catKey === 'fruits' || storage === 'Refrigerated';
    const _id = oid(KIND.product, i + 1);
    return {
        _id,
        name,
        brand,
        sku: `SKU-${String(i + 1).padStart(4, '0')}`,
        barcode: `8901${String(100000000 + i * 7919).slice(0, 9)}`,
        categoryId: cat._id,
        subcategoryId: sub._id,
        itemGroupId: itemGroups[subIndex]._id,
        subcategory: sub.name,
        pricing: { mrp, sellingPrice: price, gst: 5 },
        price,
        originalPrice: mrp,
        pack: { unit, weight },
        unit,
        stock,
        isPerishable,
        shelfLife: isPerishable ? 3 : 180,
        variants: [],
        attributes: {
            fatProfile: 'NA',
            storage,
            dietary: ['Veg'],
        },
        nutrition: { protein: 0, carbs: 0, sugar: 0, fat: 0, transFat: 0, servingSize: '100g' },
        templates: {
            disclaimerId: isPerishable ? 'PERISHABLE' : 'DEFAULT',
            returnPolicyId: isPerishable ? 'PERISHABLE_24H' : 'STANDARD_7D',
        },
        images: [image],
        image,
        description: describe(name, brand, unit, cat.name),
        highlights: highlightsFor(storage),
        isAvailable: stock > 0,
        rating,
        reviewCount,
        soldCount: Math.round(reviewCount * 3.4),
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
    };
});

// Not a backend endpoint (the Home banner carousel uses bundled assets);
// exposed at GET /banners for screens that want remote banners.
export const banners = [
    { _id: 'banner-1', title: 'Fresh Fruits & Veggies', subtitle: 'Farm fresh, up to 30% off', image: PHOTOS.produce, color: '#E8F5E9', categoryId: categoryByKey.fruits._id },
    { _id: 'banner-2', title: 'Dairy Morning Deals', subtitle: 'Milk, bread & eggs from ₹34', image: PHOTOS.milk, color: '#FFF8E1', categoryId: categoryByKey.dairy._id },
    { _id: 'banner-3', title: 'Snack Attack', subtitle: "Haldiram's, Lay's & more", image: PHOTOS.chips, color: '#FCE4EC', categoryId: categoryByKey.snacks._id },
    { _id: 'banner-4', title: 'Delivered in 10 minutes', subtitle: 'Free delivery above ₹199', image: PHOTOS.grocery, color: '#E3F2FD', categoryId: null },
];
