// Converts photos in raw/ to small WebP files in public/images/. Run: npm run images
const sharp = require('sharp'), fs = require('fs'), path = require('path');
fs.mkdirSync('public/images', { recursive: true });
(async () => {
  for (const f of fs.readdirSync('raw').filter(f => /\.(jpe?g|png)$/i.test(f))) {
    const name = path.parse(f).name, width = name.startsWith('hero') ? 1600 : 800;
    await sharp(path.join('raw', f)).rotate().resize({ width, withoutEnlargement: true })
      .webp({ quality: 74 }).toFile(`public/images/${name}.webp`);
    console.log('done', name);
  }
})();
