const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/ShravanKirana')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const SubcategorySchema = new mongoose.Schema({
      name: String,
      parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
      isActive: Boolean
    });
    
    const Subcategory = mongoose.model('Subcategory', SubcategorySchema, 'subcategories');
    
    // Get all subcategories
    const all = await Subcategory.find({});
    console.log('\nAll subcategories:');
    all.forEach(sub => {
      console.log(`  - ${sub.name}`);
      console.log(`    parentId: ${sub.parentId}`);
      console.log(`    parentId type: ${typeof sub.parentId}`);
      console.log(`    parentId instanceof ObjectId: ${sub.parentId instanceof mongoose.Types.ObjectId}`);
    });
    
    // Try query with ObjectId
    const parentIdStr = '697763bde756262a66c8a745';
    const parentIdObj = new mongoose.Types.ObjectId(parentIdStr);
    
    console.log(`\nQuerying with ObjectId: ${parentIdObj}`);
    const withObjectId = await Subcategory.find({ parentId: parentIdObj, isActive: true });
    console.log(`Found ${withObjectId.length} subcategories`);
    
    // Try query with string
    console.log(`\nQuerying with string: ${parentIdStr}`);
    const withString = await Subcategory.find({ parentId: parentIdStr, isActive: true });
    console.log(`Found ${withString.length} subcategories`);
    
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
