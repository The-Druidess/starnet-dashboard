'use strict';

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const spriteRoot = path.join(root, 'frontend', 'assets', 'sprites');
const sourceDir = path.join(spriteRoot, 'approved_tom_paris');
const targetDir = path.join(spriteRoot, 'theseus_science_officer');
const websiteDir = path.join(root, 'website', 'app', 'assets', 'sprites', 'theseus_science_officer');
const directions = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const seatedDirections = ['south', 'east', 'north', 'west'];
const skinTones = new Map([
  ['239,182,146', [152, 104, 80]],
  ['230,170,128', [152, 104, 80]],
  ['219,151,106', [152, 96, 72]],
  ['201,141,102', [128, 80, 56]],
  ['181,116,88', [120, 72, 48]],
  ['148,88,63', [96, 56, 32]],
  ['153,107,67', [152, 104, 80]],
  ['133,94,52', [128, 80, 56]]
]);
const uniformShades = new Map([
  ['60,60,60', [184, 124, 43]],
  ['36,36,36', [132, 88, 31]],
  ['92,52,30', [113, 76, 29]],
  ['68,40,9', [113, 76, 29]],
  ['117,23,50', [30, 30, 30]],
  ['54,6,19', [0, 0, 0]],
  ['95,6,35', [30, 30, 30]],
  ['73,11,35', [30, 30, 30]],
  ['61,41,47', [30, 30, 30]]
]);
const blackPalette = new Map([
  ['60,60,60', [18, 18, 20]],
  ['36,36,36', [14, 14, 16]],
  ['92,52,30', [30, 30, 30]],
  ['68,40,9', [18, 18, 20]],
  ['117,23,50', [30, 30, 30]],
  ['54,6,19', [0, 0, 0]],
  ['95,6,35', [30, 30, 30]],
  ['73,11,35', [30, 30, 30]],
  ['61,41,47', [30, 30, 30]]
]);
const redUniform = new Set(['117,23,50', '54,6,19', '95,6,35', '73,11,35', '61,41,47', '80,9,31']);

function colorAt(data, offset) {
  return `${data[offset]},${data[offset + 1]},${data[offset + 2]}`;
}

function setColor(data, offset, color) {
  data[offset] = color[0];
  data[offset + 1] = color[1];
  data[offset + 2] = color[2];
}

function isGold(color) {
  return color === '184,124,43' || color === '132,88,31' || color === '113,76,29';
}

function isWarmClothing(color) {
  const [red, green, blue] = color.split(',').map(Number);
  return red > green * 1.35 && (green > blue * 1.1 || red > blue * 1.4) && blue < 100;
}

async function makeAnimationFrame(sourceFile, headFile, outputFile) {
  const source = await sharp(sourceFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const head = await sharp(headFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (source.info.width !== 144 || source.info.height !== 144 ||
      head.info.width !== 144 || head.info.height !== 144) {
    throw new Error(`Expected 144x144 source frames: ${sourceFile}, ${headFile}`);
  }

  const { data, info } = source;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * 4;
      if (data[offset + 3] === 0) continue;
      const original = colorAt(data, offset);
      const skin = skinTones.get(original);
      if (skin) {
        setColor(data, offset, skin);
      } else if (y >= 79) {
        setColor(data, offset, blackPalette.get(original) || [30, 30, 30]);
      } else if (y >= 64 && y <= 78) {
        if (redUniform.has(original) || isWarmClothing(original)) setColor(data, offset, [113, 76, 29]);
        else if (uniformShades.has(original)) setColor(data, offset, uniformShades.get(original));
        else if (['30,30,30', '0,0,0', '2,1,1', '11,10,14'].includes(original)) {
          setColor(data, offset, original === '30,30,30' ? [30, 30, 30] : [0, 0, 0]);
        }
      } else if (y >= 54 && y < 64) {
        if (redUniform.has(original) || isWarmClothing(original) || uniformShades.has(original) ||
            ['30,30,30', '0,0,0', '2,1,1', '11,10,14'].includes(original)) {
          setColor(data, offset, original === '30,30,30' ? [30, 30, 30] : [0, 0, 0]);
        }
      }
    }
  }

  for (let y = 34; y <= 53; y++) {
    for (let x = 54; x <= 89; x++) {
      const offset = (y * info.width + x) * 4;
      const headOffset = (y * head.info.width + x) * 4;
      data.set(head.data.subarray(headOffset, headOffset + 4), offset);
    }
  }

  for (let y = 79; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * 4;
      if (data[offset + 3] > 0 && isGold(colorAt(data, offset))) {
        throw new Error(`Gold pixel leaked into pants at ${x},${y}: ${outputFile}`);
      }
    }
  }

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(outputFile);
  fs.copyFileSync(outputFile, path.join(websiteDir, path.basename(outputFile)));
}

async function main() {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(websiteDir, { recursive: true });
  const tracks = {};

  for (const direction of directions) {
    const headFile = path.join(targetDir, `rot_${direction}.png`);
    tracks[`theseus_science_officer.walk.${direction}`] = [];
    for (let frame = 0; frame < 6; frame++) {
      const name = `walk_${direction}_${frame}.png`;
      await makeAnimationFrame(
        path.join(sourceDir, name),
        headFile,
        path.join(targetDir, name)
      );
      tracks[`theseus_science_officer.walk.${direction}`].push(`theseus_science_officer/${name}`);
    }
  }

  for (const direction of seatedDirections) {
    const name = `sit_${direction}.png`;
    await makeAnimationFrame(
      path.join(sourceDir, name),
      path.join(targetDir, `rot_${direction}.png`),
      path.join(targetDir, name)
    );
    tracks[`theseus_science_officer.sit.${direction}`] = [`theseus_science_officer/${name}`];
  }

  tracks['theseus_science_officer.type.north'] = [];
  for (let frame = 0; frame < 4; frame++) {
    const name = `type_north_${frame}.png`;
    await makeAnimationFrame(
      path.join(sourceDir, name),
      path.join(targetDir, 'rot_north.png'),
      path.join(targetDir, name)
    );
    tracks['theseus_science_officer.type.north'].push(`theseus_science_officer/${name}`);
  }

  for (const manifestFile of [
    path.join(root, 'frontend', 'assets', 'sprites', 'manifest.json'),
    path.join(root, 'website', 'app', 'assets', 'sprites', 'manifest.json')
  ]) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    Object.assign(manifest.sprites, tracks);
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  console.log(`Generated ${Object.values(tracks).reduce((count, frames) => count + frames.length, 0)} science officer animation frames.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
