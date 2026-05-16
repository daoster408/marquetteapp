import * as ExpoCrypto from 'expo-crypto';

type CryptoLike = {
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
};

const root = globalThis as unknown as { crypto?: CryptoLike };

if (!root.crypto) {
  root.crypto = {};
}

if (!root.crypto.getRandomValues) {
  root.crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (!array) return array;

    const bytes = ExpoCrypto.getRandomBytes(array.byteLength);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(bytes);
    return array;
  };
}
