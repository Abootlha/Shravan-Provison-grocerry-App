import re

with open('customer-app/screens/CategoriesScreen.js', 'r') as f:
    content2 = f.read()

sticky_start2 = content2.find('<View style={styles.stickyHeaderWrapper}>')
scroll_start2 = content2.find('{/* Scrollable Categories List */}')
scroll_end_match2 = re.search(r'</Animated\.ScrollView>', content2[scroll_start2:])
if sticky_start2 != -1 and scroll_start2 != -1 and scroll_end_match2:
    scroll_end2 = scroll_start2 + scroll_end_match2.end()
    
    sticky_block2 = content2[sticky_start2:scroll_start2]
    scroll_block2 = content2[scroll_start2:scroll_end2]
    
    new_content2 = content2[:sticky_start2] + scroll_block2 + '\n\n            ' + sticky_block2.strip() + '\n' + content2[scroll_end2:]
    
    with open('customer-app/screens/CategoriesScreen.js', 'w') as f:
        f.write(new_content2)
    print("CategoriesScreen swapped")
else:
    print("Could not find blocks in CategoriesScreen")
