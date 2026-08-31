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
  
  // Purples -> Secondary (Green)
  content = content.replace(/\[#583285\]/g, 'secondary');
  content = content.replace(/\[#45246c\]/g, 'secondary-dark');
  content = content.replace(/\[#43236b\]/g, 'secondary-dark');
  content = content.replace(/purple-900\/40/g, 'secondary-dark/40');
  content = content.replace(/purple-900/g, 'secondary-dark');
  content = content.replace(/purple-800/g, 'secondary-dark');
  content = content.replace(/purple-700/g, 'secondary');
  content = content.replace(/purple-600/g, 'secondary');
  content = content.replace(/purple-500/g, 'secondary');
  content = content.replace(/purple-400/g, 'secondary-light');
  content = content.replace(/purple-300/g, 'secondary-light');
  content = content.replace(/purple-200/g, 'secondary-light/50');
  content = content.replace(/purple-100/g, 'secondary-light/30');
  content = content.replace(/purple-50\b/g, 'secondary-light/10');
  
  // Yellows -> Primary (Yellow)
  content = content.replace(/\[#ffd600\]/g, 'primary');
  
  // Emeralds -> Secondary (Green)
  content = content.replace(/emerald-950/g, 'secondary-dark');
  content = content.replace(/emerald-900/g, 'secondary-dark');
  content = content.replace(/emerald-800/g, 'secondary-dark');
  content = content.replace(/emerald-700/g, 'secondary-dark');
  content = content.replace(/emerald-600/g, 'secondary');
  content = content.replace(/emerald-500/g, 'secondary');
  content = content.replace(/emerald-400/g, 'secondary-light');
  content = content.replace(/emerald-300/g, 'secondary-light');
  content = content.replace(/emerald-200/g, 'secondary-light/50');
  content = content.replace(/emerald-100/g, 'secondary-light/30');
  content = content.replace(/emerald-50\b/g, 'secondary-light/10');

  if (content !== original) {
    fs.writeFileSync(file, content);
    modifiedCount++;
  }
});

console.log(`Modified ${modifiedCount} files.`);
