import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { prepareProfilePhoto } from "../src/lib/profilePhotoServer.mjs";
import { photoFileError, MAX_PHOTO_BYTES } from "../src/data/profilePhoto.mjs";
test("Profile photos are optional; accepted file types have a 2 MB limit", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"])
    assert.equal(photoFileError({ type, size: 1024 }), "");
  assert.notEqual(photoFileError({ type: "image/svg+xml", size: 100 }), "");
  assert.notEqual(
    photoFileError({ type: "image/png", size: MAX_PHOTO_BYTES + 1 }),
    ""
  );
  assert.notEqual(photoFileError({ type: "image/png", size: 0 }), "");
});
test("Profile image processing generates bounded WebP bytes and strips metadata", async () => {
  for (const format of ["jpeg", "png", "webp"]) {
    const source = await sharp({
      create: { width: 600, height: 400, channels: 3, background: "#668800" },
    })
      .withMetadata()
      .toFormat(format)
      .toBuffer();
    const photo = await prepareProfilePhoto(
      "data:image/" + format + ";base64," + source.toString("base64")
    );
    assert.equal(photo.contentType, "image/webp");
    assert.ok(Buffer.isBuffer(photo.data));
    const metadata = await sharp(photo.data).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 256);
    assert.equal(metadata.height, 256);
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.icc, undefined);
    assert.ok(photo.updatedAt instanceof Date);
  }
});
test("Profile uploads reject spoofed types, malformed files and oversized payloads", async () => {
  for (const value of [
    undefined,
    {},
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "data:image/png;base64,YmFk",
    "data:image/jpeg;base64,@@@",
    "data:image/png;base64," +
      "A".repeat(Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 100),
  ])
    await assert.rejects(() => prepareProfilePhoto(value));
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(() =>
    prepareProfilePhoto("data:image/jpeg;base64," + png.toString("base64"))
  );
});
