/**
 * Admin authentication utilities using Web Crypto API.
 * All cryptographic operations use Web Crypto (crypto.subtle) for Cloudflare Workers compatibility.
 */

/**
 * PBKDF2 configuration and verification
 */
interface PBKDF2Config {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
}

/**
 * Parse PBKDF2 hash string in format: pbkdf2-sha256$<iterations>$<salt_base64>$<hash_base64>
 */
export function parsePBKDF2Hash(hashString: string): PBKDF2Config {
  const parts = hashString.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') {
    throw new Error('Invalid PBKDF2 hash format');
  }

  const iterations = parseInt(parts[1], 10);
  const salt = base64ToBytes(parts[2]);
  const hash = base64ToBytes(parts[3]);

  return { iterations, salt, hash };
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes as Uint8Array;
}

/**
 * Convert Uint8Array to base64 string
 */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Uint8Array to base64url string (RFC 4648)
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  const base64 = bytesToBase64(bytes);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Convert base64url string to Uint8Array (RFC 4648)
 */
function base64UrlToBytes(base64url: string): Uint8Array {
  // Add padding if needed
  const padded = base64url + '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToBytes(base64);
}

/**
 * Verify password against PBKDF2 hash using constant-time comparison
 */
export async function verifyPasswordPBKDF2(
  password: string,
  hashString: string
): Promise<boolean> {
  try {
    const config = parsePBKDF2Hash(hashString);

    // Derive key from password using PBKDF2
    const passwordBuffer = new TextEncoder().encode(password);
    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer as BufferSource,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: config.salt as BufferSource,
        iterations: config.iterations,
      },
      baseKey,
      256 // 32 bytes in bits
    );

    const derivedBytes = new Uint8Array(derivedBits);

    // Constant-time comparison using XOR
    return constantTimeCompare(derivedBytes, config.hash);
  } catch {
    // Return false on any error (malformed hash, etc.)
    return false;
  }
}

/**
 * Constant-time comparison of two byte arrays to prevent timing attacks
 * PBKDF2 hashes are always 32 bytes; if either array differs in length, return false
 * but always XOR all 32 bytes to avoid timing leaks
 */
function constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
  const HASH_LENGTH = 32; // PBKDF2 output is always 32 bytes

  // If either array is not exactly 32 bytes, fail but compare all bytes for constant time
  let mismatch = (a.length ^ HASH_LENGTH) | (b.length ^ HASH_LENGTH);

  for (let i = 0; i < HASH_LENGTH; i++) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return mismatch === 0;
}

/**
 * Session payload structure
 */
export interface SessionPayload {
  iat: number; // issued at (unix seconds)
  exp: number; // expiration (unix seconds)
  ver: number; // session version for DB validation
}

/**
 * Validate that a parsed object is a valid SessionPayload
 * Ensures all required fields are present and are safe integers
 */
function isValidSessionPayload(payload: unknown): payload is SessionPayload {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const obj = payload as Record<string, unknown>;

  return (
    Number.isSafeInteger(obj.iat) &&
    Number.isSafeInteger(obj.exp) &&
    Number.isSafeInteger(obj.ver)
  );
}

/**
 * Sign session payload into cookie value: v1.<payload_base64url>.<sig_base64url>
 */
export async function signSessionCookie(
  payload: SessionPayload,
  secret: string
): Promise<string> {
  try {
    // Encode payload as JSON
    const payloadJson = JSON.stringify(payload);
    const payloadBytes = new TextEncoder().encode(payloadJson);
    const payloadBase64Url = bytesToBase64Url(payloadBytes);

    // Create signature message: v1.<payload_base64url>
    const signatureMessage = `v1.${payloadBase64Url}`;
    const signatureMessageBytes = new TextEncoder().encode(signatureMessage);

    // Import secret as HMAC key (secret is standard base64, not base64url)
    const secretBytes = base64ToBytes(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign the message
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      signatureMessageBytes
    );
    const signatureBytes = new Uint8Array(signatureBuffer);
    const signatureBase64Url = bytesToBase64Url(signatureBytes);

    // Return cookie value
    return `v1.${payloadBase64Url}.${signatureBase64Url}`;
  } catch (error) {
    throw new Error(`Failed to sign session cookie: ${error}`);
  }
}

/**
 * Verify and parse session cookie: v1.<payload_base64url>.<sig_base64url>
 * Checks signature validity and expiration
 * Does NOT check session version (that's the API handler's responsibility for DB lookup)
 */
export async function verifySessionCookie(
  cookieValue: string,
  secret: string
): Promise<SessionPayload | null> {
  try {
    // Parse cookie format
    const parts = cookieValue.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') {
      return null;
    }

    const payloadBase64Url = parts[1];
    const signatureBase64Url = parts[2];

    // Reconstruct signed message for verification
    const signatureMessage = `v1.${payloadBase64Url}`;
    const signatureMessageBytes = new TextEncoder().encode(signatureMessage);

    // Decode and verify signature (secret is standard base64, not base64url)
    const secretBytes = base64ToBytes(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = base64UrlToBytes(signatureBase64Url);
    const isSignatureValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes as BufferSource,
      signatureMessageBytes
    );

    if (!isSignatureValid) {
      return null;
    }

    // Decode and parse payload
    const payloadBytes = base64UrlToBytes(payloadBase64Url);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const parsed: unknown = JSON.parse(payloadJson);

    // Validate payload structure and types (fail-closed)
    if (!isValidSessionPayload(parsed)) {
      return null;
    }
    const payload = parsed as SessionPayload;

    // Check expiration (fail-closed: only return if exp > now)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp > now) {
      return payload;
    }

    return null;
  } catch {
    // Return null on any verification error
    return null;
  }
}

/**
 * Generate session cookie with specified TTL
 */
export async function generateSessionCookie(
  sessionVersion: number,
  ttlSeconds: number,
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    iat: now,
    exp: now + ttlSeconds,
    ver: sessionVersion,
  };

  return signSessionCookie(payload, secret);
}
