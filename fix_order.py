import re

with open('customer-app/screens/HomeScreen.js', 'r') as f:
    content = f.read()

# Find the stickyHeaderWrapper block
sticky_start = content.find('{/* ===== STICKY HEADER (Location, SearchBar, Popular Tags & Quick Categories Sticky) ===== */}')
sticky_end = content.find('{/* ===== SCROLLABLE CONTENT (NON-STICKY) ===== */}')

sticky_block = content[sticky_start:sticky_end]

# Find the ScrollView block
scroll_start = sticky_end
scroll_end = content.find('</Animated.ScrollView>') + len('</Animated.ScrollView>')

scroll_block = content[scroll_start:scroll_end]

# Replace in content
new_content = content[:sticky_start] + scroll_block + '\n\n            ' + sticky_block.strip() + '\n' + content[scroll_end:]

with open('customer-app/screens/HomeScreen.js', 'w') as f:
    f.write(new_content)

print("Swapped successfully")
