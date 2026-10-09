import re

with open('customer-app/components/ProductCard.js', 'r') as f:
    content = f.read()

# Replace pink colors with theme green for Add button
content = content.replace(
    "backgroundColor: '#FFF4F7',",
    "backgroundColor: '#F4FBF4',"
)
content = content.replace(
    "borderColor: '#E91E63',",
    "borderColor: COLORS.secondary,"
)
content = content.replace(
    "color: '#E91E63',",
    "color: COLORS.secondary,"
)
content = content.replace(
    "backgroundColor: '#E91E63',",
    "backgroundColor: COLORS.secondary,"
)

with open('customer-app/components/ProductCard.js', 'w') as f:
    f.write(content)
