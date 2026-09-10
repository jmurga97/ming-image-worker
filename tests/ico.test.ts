import { describe, expect, test } from "bun:test";

import { wrapPngInIco } from "@/modules/images/engine";

const fakePngBytes = 32;

function fakePng(): ArrayBuffer {
  const bytes = new Uint8Array(fakePngBytes);
  bytes[0] = 0x89;
  bytes.set([0x50, 0x4e, 0x47], 1);
  return bytes.buffer;
}

describe("wrapPngInIco", () => {
  test("builds a single-entry ICO directory followed by the raw PNG", () => {
    const view = new DataView(wrapPngInIco(fakePng(), 48, 48));

    expect(view.byteLength).toBe(22 + fakePngBytes);
    expect(view.getUint16(0, true)).toBe(0); // reserved
    expect(view.getUint16(2, true)).toBe(1); // icon resource type
    expect(view.getUint16(4, true)).toBe(1); // single image
    expect(view.getUint8(6)).toBe(48);
    expect(view.getUint8(7)).toBe(48);
    expect(view.getUint16(10, true)).toBe(1); // color planes
    expect(view.getUint16(12, true)).toBe(32); // bits per pixel
    expect(view.getUint32(14, true)).toBe(fakePngBytes);
    expect(view.getUint32(18, true)).toBe(22);
  });

  test("keeps the PNG payload intact at the 22-byte offset", () => {
    const bytes = new Uint8Array(wrapPngInIco(fakePng(), 48, 48));

    expect(bytes[22]).toBe(0x89);
    expect(bytes[23]).toBe(0x50);
  });

  test("encodes 256px edges as zero per the ICO spec", () => {
    const view = new DataView(wrapPngInIco(fakePng(), 256, 64));

    expect(view.getUint8(6)).toBe(0);
    expect(view.getUint8(7)).toBe(64);
  });
});
