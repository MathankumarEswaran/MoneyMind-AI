import { hash, verify, type Options } from "@node-rs/argon2";

/** Argon2id is enum member 2 in @node-rs/argon2; the enum is ambient-only. */
const ARGON2ID = 2 as const;

/**
 * Argon2id parameters from ARCHITECTURE.md §5:
 * 64 MiB memory, 3 iterations, 1 degree of parallelism, 32-byte output.
 * Raising these values later is safe: parameters are encoded in each hash.
 */
const ARGON2_OPTIONS: Options = {
  algorithm: ARGON2ID,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
};

/**
 * A real Argon2id hash of a throwaway value. Verifying against it when an email
 * does not exist keeps failed-login latency close to the success path, which
 * makes account enumeration by timing harder.
 */
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$B8Gz0Ix1VQWAMliALPVYcA$/bVvdKspBLXJpcgx2OP20/StNlJTYVkeWhG1vD6bdA8";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    // A malformed stored hash is a data-integrity problem, not a valid login.
    return false;
  }
}

/** Always spends roughly one Argon2 verification, regardless of account existence. */
export async function fakeVerifyPassword(password: string): Promise<void> {
  await verifyPassword(DUMMY_PASSWORD_HASH, password);
}
