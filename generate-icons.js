const fs = require('fs');
const sharp = require('C:/Users/qpooq/.qclaw/workspace/timepulse-chrome-extension/node_modules/sharp');
const path = require('path');

const outDir = 'C:/Users/qpooq/.qclaw/workspace/pagenotes-chrome-extension/assets/icons';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// 筆記本 + 便利貼圖標
function svg(size) {
    var cx = size / 2, cy = size / 2, r = size * 0.38;
    var sw = Math.max(1, Math.floor(size / 20));
    // 紙張
    var pw = r * 1.5, ph = r * 1.8;
    var px = cx - pw / 2, py = cy - ph / 2;
    // 左側螺旋
    var sp = size * 0.05;
    var spiralY1 = py + ph * 0.2;
    var spiralY2 = py + ph * 0.5;
    var spiralY3 = py + ph * 0.8;
    return [
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">',
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#6366F1"/>',
        '<rect x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" rx="' + size * 0.05 + '" fill="white"/>',
        // 螺旋孔
        '<circle cx="' + (px - sp) + '" cy="' + spiralY1 + '" r="' + sw * 1.5 + '" fill="#6366F1"/>',
        '<circle cx="' + (px - sp) + '" cy="' + spiralY2 + '" r="' + sw * 1.5 + '" fill="#6366F1"/>',
        '<circle cx="' + (px - sp) + '" cy="' + spiralY3 + '" r="' + sw * 1.5 + '" fill="#6366F1"/>',
        // 文字線
        '<line x1="' + (px + pw * 0.2) + '" y1="' + (py + ph * 0.35) + '" x2="' + (px + pw * 0.85) + '" y2="' + (py + ph * 0.35) + '" stroke="#E0E7FF" stroke-width="' + sw + '" stroke-linecap="round"/>',
        '<line x1="' + (px + pw * 0.2) + '" y1="' + (py + ph * 0.55) + '" x2="' + (px + pw * 0.7) + '" y2="' + (py + ph * 0.55) + '" stroke="#E0E7FF" stroke-width="' + sw + '" stroke-linecap="round"/>',
        '<line x1="' + (px + pw * 0.2) + '" y1="' + (py + ph * 0.75) + '" x2="' + (px + pw * 0.6) + '" y2="' + (py + ph * 0.75) + '" stroke="#E0E7FF" stroke-width="' + sw + '" stroke-linecap="round"/>',
        // 便利貼角
        '<polygon points="' + (px + pw * 0.6) + ',' + py + ' ' + (px + pw) + ',' + py + ' ' + (px + pw) + ',' + (py + ph * 0.4) + '" fill="#FEF08A" opacity="0.8"/>',
        '</svg>'
    ].join('');
}

Promise.all([16, 32, 48, 128].map(function(s) {
    return sharp(Buffer.from(svg(s))).resize(s, s).png().toFile(path.join(outDir, 'icon' + s + '.png'))
        .then(function() { console.log('icon' + s + '.png OK'); });
})).then(function() { console.log('All icons generated'); });
