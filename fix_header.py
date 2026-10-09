import re

with open('customer-app/components/Header.js', 'r') as f:
    content = f.read()

# Add dynamic text colors
content = content.replace("    if (showLocation) {", """    const isDarkBg = !whiteBackground && !transparent;
    const dynamicTextColor = isDarkBg ? '#FFFFFF' : '#111111';
    const dynamicTextSecondary = isDarkBg ? 'rgba(255, 255, 255, 0.9)' : '#444444';
    const dynamicIconColor = isDarkBg ? '#FFFFFF' : COLORS.text;

    if (showLocation) {""")

# Update LinearGradient colors and locationHeaderContainer backgroundColor
content = content.replace(
    "colors={['#D8B4FE', '#F3E8FF', '#FAFAFC']}",
    "colors={['#3C006B', '#5B21B6', '#7C3AED']}"
)
content = content.replace(
    "colors={['#D8B4FE', '#F3E8FF', '#FAF9F6']}",
    "colors={['#3C006B', '#5B21B6', '#7C3AED']}"
)

# Add fallback background color to locationHeaderContainer
content = content.replace(
    "paddingBottom: 12,",
    "paddingBottom: 12,\n        backgroundColor: '#5B21B6',"
)
content = content.replace(
    "minHeight: 70,",
    "minHeight: 70,\n        backgroundColor: '#5B21B6',"
)

# Apply dynamic colors to styles
content = content.replace(
    "color={COLORS.text}",
    "color={dynamicIconColor}"
)

content = content.replace(
    "<Text style={styles.brandPrefixText}>",
    "<Text style={[styles.brandPrefixText, { color: dynamicTextSecondary }]}>"
)

content = content.replace(
    "<Text style={styles.heroTimeText}>",
    "<Text style={[styles.heroTimeText, { color: dynamicTextColor }]}>"
)

content = content.replace(
    "<Text style={styles.locationHomeBold}>",
    "<Text style={[styles.locationHomeBold, { color: dynamicTextColor }]}>"
)

content = content.replace(
    "<Text style={styles.locationAddressText}>",
    "<Text style={[styles.locationAddressText, { color: dynamicTextSecondary }]}>"
)

# Title Text in standard header
content = content.replace(
    "<Text style={styles.headerTitle} numberOfLines={1}>",
    "<Text style={[styles.headerTitle, { color: dynamicTextColor }]} numberOfLines={1}>"
)

with open('customer-app/components/Header.js', 'w') as f:
    f.write(content)
print("Header updated")
