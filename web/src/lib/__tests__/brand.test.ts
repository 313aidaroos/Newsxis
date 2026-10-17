import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const brandDir = path.join(repo, "web/public/brand");

const PRESENT = [
  "logo-full.png",
  "logo-full-white.png",
  "mark.png",
  "mark-white.png",
  "favicon.ico",
  "favicon-32.png",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "og-image.png",
  "brand.json",
  "README.md",
] as const;

const PENDING = ["banner.png", "facebook-cover.png", "facebook-profile.png"] as const;

type Rgba = { width: number; height: number; rows: Buffer; stride: number };

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buf: Buffer): Rgba {
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.equal(buf[24], 8);
  assert.equal(buf[25], 6, "PNG color type should be RGBA");
  assert.equal(buf[28], 0, "PNG should not be interlaced");
  const idats: Buffer[] = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    if (type === "IDAT") idats.push(buf.subarray(off + 8, off + 8 + len));
    if (type === "IEND") break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idats));
  const stride = width * 4;
  const rows = Buffer.alloc(height * stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= 4 ? rows[row + i - 4] : 0;
      const up = y > 0 ? rows[row - stride + i] : 0;
      const ul = y > 0 && i >= 4 ? rows[row - stride + i - 4] : 0;
      const x = raw[p++];
      if (filter === 0) rows[row + i] = x;
      else if (filter === 1) rows[row + i] = (x + left) & 255;
      else if (filter === 2) rows[row + i] = (x + up) & 255;
      else if (filter === 3) rows[row + i] = (x + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) rows[row + i] = (x + paeth(left, up, ul)) & 255;
      else throw new Error(`unknown png filter ${filter}`);
    }
  }
  return { width, height, rows, stride };
}

function alpha(png: Rgba, x: number, y: number) {
  return png.rows[y * png.stride + x * 4 + 3];
}

function assertTransparentCorners(png: Rgba, file: string) {
  for (const [x, y] of [
    [0, 0],
    [png.width - 1, 0],
    [0, png.height - 1],
    [png.width - 1, png.height - 1],
  ] as const) {
    assert.equal(alpha(png, x, y), 0, `${file} corner ${x},${y} should be transparent`);
  }
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === ".next") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

test("brand kit matches the family file list", () => {
  const onDisk: string[] = readdirSync(brandDir).sort();
  for (const name of PENDING) assert.equal(onDisk.includes(name), false, `${name} is pending and must not be shipped`);
  assert.deepEqual(onDisk, [...PRESENT].sort());
  const meta = JSON.parse(readFileSync(path.join(brandDir, "brand.json"), "utf8"));
  assert.equal(meta.name, "Newsxis");
  assert.equal(meta.domain, "newsxis.vercel.app");
  assert.equal(typeof meta.tagline, "string");
  for (const key of ["primary", "accent", "background", "text"]) assert.match(meta.colors[key], /^#[0-9a-f]{6}$/);
  assert.ok(Array.isArray(meta.fonts));
  for (const name of PRESENT) {
    if (name === "brand.json" || name === "README.md") continue;
    assert.ok(meta.files[name], `brand.json files.${name}`);
  }
  for (const name of PENDING) assert.equal(meta.files[name].status, "pending");
  assert.match(readFileSync(path.join(brandDir, "README.md"), "utf8"), /pending/i);
});

test("logo and icon PNGs have an alpha channel and transparent corners", () => {
  const expect: Record<string, [number, number] | "min"> = {
    "logo-full.png": "min",
    "logo-full-white.png": "min",
    "mark.png": "min",
    "mark-white.png": "min",
    "favicon-32.png": [32, 32],
    "apple-touch-icon.png": [180, 180],
    "icon-192.png": [192, 192],
    "icon-512.png": [512, 512],
  };
  for (const [name, size] of Object.entries(expect)) {
    const png = decodePng(readFileSync(path.join(brandDir, name)));
    if (size === "min") {
      const min = name.startsWith("logo-full") ? 1024 : 512;
      assert.ok(png.width >= min && png.height >= 512, `${name} is ${png.width}x${png.height}`);
    } else {
      assert.deepEqual([png.width, png.height], size);
    }
    assertTransparentCorners(png, name);
  }
  const og = decodePng(readFileSync(path.join(brandDir, "og-image.png")));
  assert.deepEqual([og.width, og.height], [1200, 630]);
  assert.equal(alpha(og, 0, 0), 255, "og card is filled with the theme");
});

test("favicon.ico is built from transparent 16 and 32 PNG frames", () => {
  const buf = readFileSync(path.join(brandDir, "favicon.ico"));
  assert.equal(buf.readUInt16LE(0), 0);
  assert.equal(buf.readUInt16LE(2), 1);
  const count = buf.readUInt16LE(4);
  assert.equal(count, 2);
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    const base = 6 + i * 16;
    sizes.push(buf[base]);
    const bytes = buf.readUInt32LE(base + 8);
    const offset = buf.readUInt32LE(base + 12);
    const blob = buf.subarray(offset, offset + bytes);
    const png = decodePng(blob);
    assert.equal(png.width, buf[base]);
    assertTransparentCorners(png, `favicon.ico ${png.width}`);
  }
  assert.deepEqual(sizes.sort((a, b) => a - b), [16, 32]);
});

test("the repo has no other logo file and no svg", () => {
  const files = walk(repo);
  const images = files.filter((file) => /\.(png|ico|svg|webp|jpe?g|gif)$/i.test(file));
  for (const file of images) {
    assert.equal(path.extname(file).toLowerCase() === ".svg", false, file);
    assert.ok(file.startsWith(brandDir + path.sep), `unexpected image ${path.relative(repo, file)}`);
  }
  const code = files.filter((file) => /\.(tsx?|jsx?|mjs|css|json)$/.test(file));
  for (const file of code) {
    if (file.endsWith(`${path.sep}brand.test.ts`)) continue;
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes(".svg"), false, path.relative(repo, file));
    assert.equal(text.includes("favicon.png"), false, path.relative(repo, file));
  }
});
