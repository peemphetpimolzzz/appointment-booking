// Human-friendly booking codes: 8 chars, unambiguous alphabet (no 0/O/1/I).
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateBookingCode(length = 8): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
