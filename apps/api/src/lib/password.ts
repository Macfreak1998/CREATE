import argon2 from "argon2";
import { randomBytes } from "node:crypto";

const options: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, options);
}

export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function generatePassword(length = 16): string {
  const bytes = Math.ceil((length * 3) / 4) + 4;
  return randomBytes(bytes).toString("base64url").slice(0, length);
}
