var fs = require('fs');
var base = 'C:/Users/qpooq/.qclaw/workspace/pagenotes-chrome-extension/';
var files = [
    'manifest.json',
    'pages/popup.html',
    'pages/popup.js',
    'content/content.js',
    'background/background.js',
    'styles/popup.css',
    'README.md',
    'README.en.md',
    'SPEC.md'
];
files.forEach(function(f) {
    var p = base + f;
    var exists = fs.existsSync(p);
    console.log((exists ? 'OK' : 'MISSING') + ' ' + f + ' (' + (exists ? fs.statSync(p).size + 'b' : 'N/A') + ')');
});
