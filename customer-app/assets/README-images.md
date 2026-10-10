# Bundled photography: sources and licences

Every photo that ships in the app bundle (`assets/banner-*.png`, `assets/onboarding/*.webp`) is built
only from **unbranded** produce and staples. No packaging, logos or trademarks. The branded
Open Food Facts pack shots in `mocks/packshots/` are mock-only (CC BY-SA, trademarked) and must
never be used for shipped art.

All sources below are under the [Unsplash Licence](https://unsplash.com/license) (free for commercial
use, modification allowed, no attribution required; credited here anyway).

## How the art is made

1. Source photo from `images.unsplash.com/photo-<id>`.
2. Background removed with [rembg](https://github.com/danielgatis/rembg) (MIT), model
   `isnet-general-use`; stray fragments dropped (largest connected components kept).
3. Composited with `sharp` on a transparent canvas (banners 1200×600, art on the right;
   onboarding 1200×900 webp). `BannerCarousel` paints the flat background so it follows the theme.

The generator scripts live outside the repo (temporary build tooling); the inputs are fully listed below.

## Banners

| File | Items | Unsplash source (photo id, photographer) |
|---|---|---|
| banner-essentials.png | sliced bread loaf | 1554933054-0b679a7982ca, Stephanie Harvey |
| | milk in swing-top glass bottle | 1576186726188-c9d70843790f, No Revisions |
| | eggs in a bowl | 1582722872445-44dc5f7e3c8f |
| | bananas | 1571771894821-ce9b6c11b08e |
| banner-fresh.png | coriander, bananas, onion, tomatoes, potatoes, mango | 1709482107035-9ac8a2fb2ac9, 1571771894821-ce9b6c11b08e, 1618512496248-a07fe83aa8cb, 1592924357228-91a4daadcfea, 1518977676601-b53f82aba655, 1553279768-865429fa0078 |
| banner-pantry.png | flour (atta) in a bowl | 1555465083-a845797ef750, Mae Mu |
| | red lentils (masoor dal) in a bowl (cropped) | 1612257416648-ee7a6c533b4f |
| | rice in a bowl | 1536304993881-ff6e9eefa2a6, Pille R. Priske |
| | spice powder (garam masala) in a steel bowl | 1591465001551-2340b4ea3296, Prchi Palwe |
| | red onion | 1618512496248-a07fe83aa8cb |
| | green chilli | 1599987141071-f5810d32e21a |
| banner-card1.png (design-system screen only) | same set as banner-fresh | as banner-fresh |

## Onboarding (`assets/onboarding/`)

| File | Items | Unsplash source |
|---|---|---|
| daily-vegetables.webp | coriander, onion, potatoes, green chilli | 1709482107035-9ac8a2fb2ac9, 1618512496248-a07fe83aa8cb, 1518977676601-b53f82aba655, 1599987141071-f5810d32e21a |
| fruit-and-eggs.webp | bananas, eggs | 1571771894821-ce9b6c11b08e, 1582722872445-44dc5f7e3c8f |
| kitchen-basics.webp | tomatoes, mango | 1592924357228-91a4daadcfea, 1553279768-865429fa0078 |

## Other bundled art

- `assets/icons3d/`: Microsoft Fluent Emoji 3D (MIT). See `assets/icons3d/README.md`.
- `assets/brand/`: the Shravan bag mark, rendered from `components/ui/logoPaths.js` (own artwork).
