/**
 * Tek-komut başlatıcı: bağımlılıklar (node_modules) yoksa önce `npm install`
 * çalıştırır (Puppeteer ilk kurulumda Chromium indirir, birkaç dakika
 * sürebilir), sonra src/server.js'i başlatır. Kök AkademiYonetici-web
 * `npm start` bu dosyayı çağırır — kullanıcı elle "market-server'a girip
 * npm install yap" demek zorunda kalmasın diye.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const HERE = __dirname;
const nodeModulesPath = path.join(HERE, 'node_modules');

if (!fs.existsSync(nodeModulesPath)) {
  console.log('[market-server] node_modules yok, "npm install" çalıştırılıyor (Puppeteer Chromium indirecek, ilk seferde birkaç dakika sürebilir)...');
  const result = spawnSync('npm', ['install'], { cwd: HERE, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error('[market-server] npm install başarısız oldu, çıkılıyor.');
    process.exit(result.status || 1);
  }
}

const server = spawn('node', ['src/server.js'], { cwd: HERE, stdio: 'inherit', shell: true });
server.on('exit', code => process.exit(code || 0));
