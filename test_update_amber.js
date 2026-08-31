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
  
  // Ambers -> Primary (Yellow)
  content = content.replace(/amber-950/g, 'primary-dark');
  content = content.replace(/amber-900/g, 'primary-dark');
  content = content.replace(/amber-800/g, 'primary-dark');
  content = content.replace(/amber-700/g, 'primary-dark');
  content = content.replace(/amber-600/g, 'primary');
  content = content.replace(/amber-500/g, 'primary');
  content = content.replace(/amber-400/g, 'primary-light');
  content = content.replace(/amber-300/g, 'primary-light');
  content = content.replace(/amber-200/g, 'primary-light/50');
  content = content.replace(/amber-100/g, 'primary-light/30');
  content = content.replace(/amber-50\b/g, 'primary-light/10');

  if (content !== original) {
    fs.writeFileSync(file, content);
    modifiedCount++;
  }
});

console.log(`Modified ${modifiedCount} files.`);
