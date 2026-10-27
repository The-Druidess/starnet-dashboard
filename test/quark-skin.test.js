'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sharp = require('sharp');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '..');
const directions = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const approvedTurns = [
  '53557c8c1f4af9a6a316b8937cc3e4293d7a2697c5c878d8052ba51267dd6f12',
  '2a9663d040902f29f5878b5f4fbd8deea3117d1a10a12de0505298bc866ea5ea',
  'd0e383f7461dfc5f9e1c10e06d8569284f4a57dd7f35bfd9b5b21a21c72db608',
  '39f8cfc50a60e04cc330210d8e423c513f2e2990d5addefa591c5c81ef4d4daa',
  '52c655004ec718b263e31eb46404e0896ea64f35508d8ba9e5db15d82dc3751a',
  '3bf794244b6dd318e011eda410c08620c610a4a43456449d900f11f1182d4b78',
  '6141dbb4b12cecbf3a4091c7db6ff1b0ed8c71b6b3f33ebea6160c3f4546de23',
  'f963ba6199102eb6889897e1343b64ca90d734ebfa8145698b748f994ed7c4e0'
];

function bounds(data, from = 0, to = 144) {
  const xs = [], ys = [];
  for (let y = from; y < to; y++) {
    for (let x = 0; x < 144; x++) {
      if (data[(y * 144 + x) * 4 + 3]) { xs.push(x); ys.push(y); }
    }
  }
  assert.ok(xs.length);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

function assertConnected(data, label) {
  const pixels = new Set();
  for (let i = 0; i < 144 * 144; i++) if (data[i * 4 + 3]) pixels.add(i);
  const stack = [pixels.values().next().value];
  pixels.delete(stack[0]);
  while (stack.length) {
    const point = stack.pop(), x = point % 144, y = Math.floor(point / 144);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx >= 144 || y + dy < 0 || y + dy >= 144) continue;
        const neighbor = (y + dy) * 144 + x + dx;
        if (pixels.delete(neighbor)) stack.push(neighbor);
      }
    }
  }
  assert.equal(pixels.size, 0, `${label}: detached pixels or limbs`);
}

async function main() {
  const frontend = path.join(root, 'frontend');
  const website = path.join(root, 'website', 'app');
  const readCatalog = base => {
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(base, 'app', 'data-shim.js'), 'utf8') +
      '\nglobalThis.skin = DATA.SKINS.quark;', context);
    return JSON.parse(JSON.stringify(context.skin));
  };
  assert.deepEqual(readCatalog(frontend), readCatalog(website));
  assert.deepEqual(readCatalog(frontend), {
    name: 'Quark', set: 'theseus_quark_review', scale: 0.25,
    sourceStandingHeight: 76, collection: 'star-trek'
  });
  const readTracks = base => Object.fromEntries(Object.entries(JSON.parse(
    fs.readFileSync(path.join(base, 'assets', 'sprites', 'manifest.json'), 'utf8')
  ).sprites).filter(([key]) => key.startsWith('theseus_quark.')));
  const tracks = readTracks(frontend);
  assert.deepEqual(tracks, readTracks(website));
  assert.equal(Object.keys(tracks).length, 21);
  assert.equal(Object.values(tracks).flat().length, 64);
  for (const direction of directions) {
    assert.equal(tracks[`theseus_quark.rot.${direction}`].length, 1);
    assert.equal(tracks[`theseus_quark.walk.${direction}`].length, 6);
  }
  for (const direction of ['south', 'east', 'north', 'west']) {
    assert.equal(tracks[`theseus_quark.sit.${direction}`].length, 1);
  }
  assert.equal(tracks['theseus_quark.type.north'].length, 4);
  const images = new Map();
  for (const [track, files] of Object.entries(tracks)) {
    const unique = new Set();
    for (const file of files) {
      const source = path.join(frontend, 'assets', 'sprites', file);
      const bytes = fs.readFileSync(source);
      assert.deepEqual(bytes, fs.readFileSync(path.join(website, 'assets', 'sprites', file)));
      const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, 144);
      assert.equal(info.height, 144);
      images.set(path.basename(file), data);
      const rows = [];
      for (let y = 0; y < 144; y++) {
        for (let x = 0; x < 144; x++) {
          const alpha = data[(y * 144 + x) * 4 + 3];
          assert.ok(alpha === 0 || alpha === 255);
          if (alpha) rows.push(y);
        }
      }
      assert.ok(rows.length > 300);
      if (track.includes('.rot.')) {
        assert.equal(Math.min(...rows), 36);
        assert.equal(Math.max(...rows), 111);
        const direction = track.split('.rot.')[1];
        assert.equal(createHash('sha256').update(bytes).digest('hex'),
          approvedTurns[directions.indexOf(direction)], `${direction}: approved turn changed`);
      } else {
        assertConnected(data, file);
        assert.ok(Math.max(...rows) <= 111, `${file}: feet below floor`);
      }
      unique.add(data.toString('base64'));
    }
    assert.equal(unique.size, files.length, `${track} contains duplicate animation frames`);
  }
  for (const direction of directions) {
    const standing = images.get(`rot_${direction}.png`);
    const lowerSilhouettes = new Set();
    for (let i = 0; i < 6; i++) {
      const frame = images.get(`walk_${direction}_${i}.png`);
      const dy = bounds(frame).top - bounds(standing).top;
      for (let y = 36; y < 63; y++) {
        for (let x = 0; x < 144; x++) {
          const offset = (y * 144 + x) * 4;
          assert.deepEqual(frame.subarray(((y + dy) * 144 + x) * 4, ((y + dy) * 144 + x) * 4 + 4),
            standing.subarray(offset, offset + 4), `${direction} frame ${i}: head changed at ${x},${y}`);
        }
      }
      const mask = [];
      for (let offset = 91 * 144 * 4 + 3; offset < 112 * 144 * 4; offset += 4) mask.push(frame[offset]);
      lowerSilhouettes.add(Buffer.from(mask).toString('base64'));
      assert.ok(bounds(frame).bottom >= 109, `${direction}: floating stride`);
    }
    assert.ok(lowerSilhouettes.size >= 4, `${direction}: insufficient leg articulation`);
  }
  for (const direction of ['east', 'west']) {
    const handPositions = Array.from({ length: 6 }, (_, i) => {
      const frame = images.get(`walk_${direction}_${i}.png`);
      const xs = [];
      for (let y = 75; y < 100; y++) {
        for (let x = 0; x < 144; x++) {
          const offset = (y * 144 + x) * 4;
          if (frame[offset + 3] && frame[offset] === 211 && frame[offset + 1] === 144 &&
              frame[offset + 2] === 108) xs.push(x);
        }
      }
      assert.ok(xs.length, `${direction} frame ${i}: missing hands`);
      return Math.min(...xs);
    });
    assert.ok(Math.max(...handPositions) - Math.min(...handPositions) >= 8,
      `${direction}: arms must swing through the stride`);
    const widths = Array.from({ length: 6 }, (_, i) => {
      const box = bounds(images.get(`walk_${direction}_${i}.png`), 91, 112);
      return box.right - box.left + 1;
    });
    assert.ok(Math.max(...widths) >= 32, `${direction}: missing extended stride`);
    assert.ok(Math.max(...widths) - Math.min(...widths) >= 18, `${direction}: rigid sliding legs`);
    const standing = bounds(images.get(`rot_${direction}.png`), 91, 112);
    const knees = bounds(images.get(`sit_${direction}.png`), 91, 99);
    assert.ok(direction === 'east' ? knees.right - standing.right >= 10 : standing.left - knees.left >= 10,
      `${direction}: seated knees must bend forward, not shrink standing legs`);
  }
  const typingArms = new Set(Array.from({ length: 4 }, (_, i) =>
    images.get(`type_north_${i}.png`).subarray(80 * 144 * 4, 100 * 144 * 4).toString('base64')));
  assert.equal(typingArms.size, 4, 'Typing must animate the arms, not just bob the head');
  console.log('Quark: 64 mirrored frames, approved turns/heads preserved, connected articulated strides, seated knees and typing motion passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
