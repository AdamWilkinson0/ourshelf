import { maxImageBytes } from "../src/lib/scan-contract";

export function supportedJpeg(image: string, maxSide: number): boolean {
  let jpeg: string;
  try {
    jpeg = atob(image);
  } catch {
    return false;
  }
  if (jpeg.length > maxImageBytes || !jpeg.startsWith("\xff\xd8") || !jpeg.endsWith("\xff\xd9"))
    return false;
  const byte = (offset: number) => jpeg.charCodeAt(offset);
  const word = (offset: number) => byte(offset) * 256 + byte(offset + 1);
  let foundFrame = false;
  for (let offset = 2; offset + 4 <= jpeg.length;) {
    if (byte(offset++) !== 0xff) return false;
    while (byte(offset) === 0xff) offset++;
    const marker = byte(offset++);
    const length = word(offset);
    if (length < 2 || offset + length >= jpeg.length) return false;
    if (marker === 0xc0 || marker === 0xc2) {
      if (foundFrame || length < 11 || byte(offset + 2) !== 8) return false;
      const height = word(offset + 3);
      const width = word(offset + 5);
      if (!width || !height || width > maxSide || height > maxSide) return false;
      foundFrame = true;
    }
    if (marker === 0xda) return foundFrame && length >= 6 && offset + length < jpeg.length - 2;
    offset += length;
  }
  return false;
}
