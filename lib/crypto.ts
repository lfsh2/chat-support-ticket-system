import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for secrets we must store (the Gmail refresh token). The key lives only in
 * the server's environment (MAIL_TOKEN_KEY, 32 bytes base64), so a database dump alone
 * can't be used to read the mailbox.
 */
function key(): Buffer {
  const raw = process.env.MAIL_TOKEN_KEY ?? "";
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("MAIL_TOKEN_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).");
  return k;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}

export function decryptSecret(sealed: string): string {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognised secret format.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}
