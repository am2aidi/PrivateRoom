/**
 * Web Crypto API Module for Private Room
 * Handles zero-leakage room ID derivation, E2EE key creation, AES-GCM encryption/decryption,
 * and 4-word safety code fingerprinting.
 */

// 256 friendly words for the 4-word Safety Code fingerprint
const SAFETY_WORDS = [
  'alpha', 'anchor', 'apex', 'arcade', 'arrow', 'astral', 'atlas', 'aurora',
  'beacon', 'breeze', 'bridge', 'bronze', 'canyon', 'castle', 'cedar', 'celestial',
  'cipher', 'cobalt', 'comet', 'compass', 'copper', 'coral', 'cosmos', 'crest',
  'crystal', 'delta', 'diamond', 'drift', 'eagle', 'echo', 'eclipse', 'ember',
  'emerald', 'falcon', 'feather', 'flame', 'forest', 'frost', 'galaxy', 'garnet',
  'glacier', 'granite', 'harbor', 'haven', 'horizon', 'hunter', 'island', 'jade',
  'jasper', 'lagoon', 'lantern', 'laurel', 'legend', 'lotus', 'lunar', 'magnet',
  'marble', 'matrix', 'meadow', 'mercury', 'midnight', 'mirage', 'monarch', 'mountain',
  'nebula', 'neon', 'nexus', 'north', 'oasis', 'ocean', 'olive', 'omega',
  'onyx', 'opal', 'orbit', 'orchid', 'orion', 'osprey', 'pacific', 'palace',
  'panther', 'pass', 'peak', 'pearl', 'phoenix', 'pine', 'planet', 'plasma',
  'polar', 'prism', 'pulse', 'pyramid', 'quantum', 'quartz', 'radar', 'radiant',
  'raven', 'ray', 'ridge', 'river', 'ruby', 'saddle', 'safari', 'sapphire',
  'shadow', 'shield', 'sierra', 'silver', 'solar', 'spark', 'spectrum', 'sphere',
  'spiral', 'spring', 'star', 'stellar', 'stone', 'storm', 'summit', 'sunburst',
  'tango', 'temple', 'titan', 'topaz', 'torpedo', 'tower', 'trail', 'trident',
  'tropic', 'tundra', 'ultra', 'valley', 'vector', 'velvet', 'vessel', 'victor',
  'violet', 'viper', 'vision', 'vortex', 'voyage', 'wave', 'willow', 'wind',
  'zenith', 'zephyr', 'zodiac', 'amber', 'arctic', 'autumn', 'banyan', 'basalt',
  'blazer', 'bloom', 'boulder', 'bramble', 'brio', 'cactus', 'canopy', 'cascade',
  'chime', 'cinder', 'citrus', 'clover', 'coast', 'crag', 'cypress', 'dune',
  'dynasty', 'echo', 'elm', 'epoch', 'falcon', 'fern', 'fjord', 'flint',
  'flora', 'fountain', 'fox', 'gale', 'geyser', 'glade', 'grove', 'gull',
  'halo', 'hazel', 'heath', 'hero', 'heron', 'highland', 'holly', 'hydra',
  'iris', 'island', 'ivory', 'jackal', 'jungle', 'jupiter', 'kelp', 'king',
  'knight', 'lark', 'lava', 'leaf', 'lichen', 'lightning', 'lynx', 'magnet',
  'magnolia', 'mantis', 'maple', 'marsh', 'meadow', 'mesa', 'meteor', 'moss',
  'myrtle', 'nautilus', 'nova', 'oak', 'obsidian', 'osprey', 'otter', 'owl'
];

/**
 * Derives both Room ID (sent to server) and Secret Key (kept in browser only)
 * using PBKDF2 with SHA-256.
 */
export async function deriveRoomCredentials(roomName, password) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(`${roomName.trim()}::${password.trim()}`);

  // Base key for PBKDF2
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // 1. Derive Room ID (Scrambled hash sent to server)
  const roomIdSalt = encoder.encode('PrivateRoom-Server-RoomID-v1');
  const roomIdBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: roomIdSalt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );
  
  const roomIdArray = new Uint8Array(roomIdBits);
  const roomIdHex = Array.from(roomIdArray).map(b => b.toString(16).padStart(2, '0')).join('');

  // 2. Derive Secret E2EE Key (NEVER sent to server)
  const secretKeySalt = encoder.encode('PrivateRoom-Client-SecretKey-v1');
  const secretKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: secretKeySalt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true, // extractable to derive safety fingerprint
    ['encrypt', 'decrypt']
  );

  // 3. Derive 4-word Safety Code fingerprint from Secret Key
  const exportedRawKey = await window.crypto.subtle.exportKey('raw', secretKey);
  const hashFingerprint = await window.crypto.subtle.digest('SHA-256', exportedRawKey);
  const fingerBytes = new Uint8Array(hashFingerprint);

  const word1 = SAFETY_WORDS[fingerBytes[0]];
  const word2 = SAFETY_WORDS[fingerBytes[1]];
  const word3 = SAFETY_WORDS[fingerBytes[2]];
  const word4 = SAFETY_WORDS[fingerBytes[3]];

  const safetyCode = `${word1}-${word2}-${word3}-${word4}`;

  return {
    roomId: roomIdHex,
    secretKey,
    safetyCode
  };
}

/**
 * Encrypt a string message using AES-GCM
 */
export async function encryptText(text, secretKey) {
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const data = encoder.encode(text);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    secretKey,
    data
  );

  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext)
  };
}

/**
 * Decrypt a string message using AES-GCM
 */
export async function decryptText(encryptedObj, secretKey) {
  const iv = base64ToArrayBuffer(encryptedObj.iv);
  const ciphertext = base64ToArrayBuffer(encryptedObj.ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    secretKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Encrypt an ArrayBuffer (e.g., image file) using AES-GCM
 */
export async function encryptBuffer(buffer, secretKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    secretKey,
    buffer
  );

  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext)
  };
}

/**
 * Decrypt an ArrayBuffer using AES-GCM
 */
export async function decryptBuffer(encryptedObj, secretKey) {
  const iv = base64ToArrayBuffer(encryptedObj.iv);
  const ciphertext = base64ToArrayBuffer(encryptedObj.ciphertext);

  return await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    secretKey,
    ciphertext
  );
}

// Helpers
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
