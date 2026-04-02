var fs = require('fs');
var path = 'C:/Users/qpooq/.qclaw/workspace/pagenotes-chrome-extension/pages/popup.html';
console.log('checking popup.html...');
console.log('exists:', fs.existsSync(path));
if (fs.existsSync(path)) {
    console.log('size:', fs.statSync(path).size);
    var s = fs.readFileSync(path, 'utf8');
    console.log('starts with:', JSON.stringify(s.slice(0, 30)));
    if (s.indexOf('<!DOCTYPE') !== 0) {
        s = '<!DOCTYPE html>\n' + s;
        fs.writeFileSync(path, s, 'utf8');
        console.log('DOCTYPE added. new size:', fs.statSync(path).size);
    } else {
        console.log('DOCTYPE OK');
    }
}
