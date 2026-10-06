/** AES-256-GCM for social tokens at rest (TOKEN_ENC_KEY = base64 32 bytes). */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY ?? "";
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("TOKEN_ENC_KEY must be 32 bytes base64 (openssl rand -base64 32)");
  return buf;
}
export function encrypt(json: unknown): string {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(json), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
export function decrypt<T>(blob: string): T {
  const [iv, tag, enc] = blob.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8")) as T;
}
