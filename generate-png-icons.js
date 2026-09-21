// Generate real 192x192 and 512x512 PNG icons with OTAQ luxury branding
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // RGBA color type
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Generate raw image data: RGBA
  // Dark luxury background (#0e0b08) with gold rounded border and gold center
  const rawBytes = [];
  const cx = width / 2;
  const cy = height / 2;
  const outerR = width * 0.46;
  const innerR = width * 0.43;

  for (let y = 0; y < height; y++) {
    rawBytes.push(0); // filter type none
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Gold border
      if (dist >= innerR && dist <= outerR) {
        // Gold: #d6a961 -> (214, 169, 97, 255)
        rawBytes.push(214, 169, 97, 255);
      } else if (dist < innerR) {
        // Center: gradient gold/black
        const ratio = dist / innerR;
        if (ratio < 0.28) {
          // Gold center emblem: #edd3a4 -> (237, 211, 164, 255)
          rawBytes.push(237, 211, 164, 255);
        } else {
          // Luxury dark background: #16120e -> (22, 18, 14, 255)
          rawBytes.push(22, 18, 14, 255);
        }
      } else {
        // Rounded corner transparency outside outerR + 4
        if (dist > outerR + 6) {
          rawBytes.push(0, 0, 0, 0);
        } else {
          rawBytes.push(10, 8, 6, 255);
        }
      }
    }
  }

  const rawBuffer = Buffer.from(rawBytes);
  const compressed = zlib.deflateSync(rawBuffer);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);

  return Buffer.concat([len, body, crcBuf]);
}

// Standard CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Write files
const assetsDir = path.join(__dirname, 'assets');
const png192 = createPng(192, 192);
fs.writeFileSync(path.join(assetsDir, 'icon-192.png'), png192);
console.log('✅ Generated assets/icon-192.png (' + png192.length + ' bytes)');

const png512 = createPng(512, 512);
fs.writeFileSync(path.join(assetsDir, 'icon-512.png'), png512);
console.log('✅ Generated assets/icon-512.png (' + png512.length + ' bytes)');
