# 3D icons

Soft 3D sticker icons used for categories, the Home category tabs, empty states, onboarding/login
stickers and a few profile rows. Rendered by `components/ui/Icon3D.js` (`<Icon3D name="leafy_green" />`,
`icon3dFor(category)`).

## Source and licence

**Microsoft Fluent Emoji (3D style)** — https://github.com/microsoft/fluentui-emoji
Files fetched from `assets/<Name>/3D/<name>_3d.png` (256×256), resized to 144×144 and palette-quantised
with sharp. File names are the upstream slug without the `_3d` suffix.

Licensed under the MIT License:

```
MIT License

Copyright (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE
```

## Adding an icon

1. Download `https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/<Name>/3D/<name>_3d.png`.
2. Resize to 144px and quantise (`sharp(src).resize(144).png({ palette: true, quality: 90 })`).
3. Save here as `<name>.png` and add a `require` line to `ICONS_3D` in `components/ui/Icon3D.js`
   (plus a keyword rule if a category should map to it).
