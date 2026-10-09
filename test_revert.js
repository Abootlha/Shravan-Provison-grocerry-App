const fs = require('fs');

const walkSync = function(dir, filelist) {
  let files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(dir + '/' + file).isDirectory()) {
      filelist = walkSync(dir + '/' + file, filelist);
    }
    else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        filelist.push(dir + '/' + file);
      }
    }
  });
  return filelist;
};

const files = walkSync('/home/talha/Desktop/ShravanKirana/website/src');
let modifiedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Revert Primary to Amber / Yellow
  content = content.replace(/primary-dark/g, 'amber-900');
  content = content.replace(/primary-light\/50/g, 'amber-200');
  content = content.replace(/primary-light\/30/g, 'amber-100');
  content = content.replace(/primary-light\/10/g, 'amber-50');
  content = content.replace(/primary-light/g, 'amber-400');
  content = content.replace(/primary/g, 'amber-500');

  // Revert Secondary to Purple
  content = content.replace(/secondary-dark\/40/g, 'purple-900/40');
  content = content.replace(/secondary-dark/g, 'purple-900');
  content = content.replace(/secondary-light\/50/g, 'purple-200');
  content = content.replace(/secondary-light\/30/g, 'purple-100');
  content = content.replace(/secondary-light\/10/g, 'purple-50');
  content = content.replace(/secondary-light/g, 'purple-400');
  content = content.replace(/secondary/g, '[#583285]');

  if (content !== original) {
    fs.writeFileSync(file, content);
    modifiedCount++;
  }
});

console.log(`Reverted ${modifiedCount} files.`);
