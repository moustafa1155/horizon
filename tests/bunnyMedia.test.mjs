import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createBunnyStorage } from "../src/lib/bunnyStorage.mjs";
import { readMediaBody, prepareMedia } from "../src/lib/mediaUpload.mjs";
import { mediaFileError, MAX_MEDIA_BYTES } from "../src/data/mediaFiles.mjs";
const config = {
  BUNNY_STORAGE_HOST: "storage.bunnycdn.com",
  BUNNY_STORAGE_ZONE: "test-only-zone",
  BUNNY_STORAGE_PASSWORD: "test-only-secret",
};
test("Bunny credentials are sent only to the configured storage host and uploads use raw bytes", async () => {
  let actual;
  const client = createBunnyStorage(config, async (url, options) => {
    actual = { url, options };
    return new Response(null, { status: 201 });
  });
  const bytes = Buffer.from("test");
  await client.put("portal-media/test.webp", bytes, "image/webp");
  assert.equal(
    actual.url,
    "https://storage.bunnycdn.com/test-only-zone/portal-media/test.webp"
  );
  assert.equal(actual.options.headers.AccessKey, "test-only-secret");
  assert.equal(actual.options.body, bytes);
  assert.equal(actual.options.redirect, "error");
  assert.ok(actual.options.signal instanceof AbortSignal);
});
test("Storage rejects untrusted hosts, unknown paths, traversal and malformed byte ranges", async () => {
  assert.throws(() =>
    createBunnyStorage({ ...config, BUNNY_STORAGE_HOST: "evil.example" })
  );
  assert.throws(() =>
    createBunnyStorage({ ...config, BUNNY_STORAGE_PASSWORD: "" })
  );
  let calls = 0;
  const client = createBunnyStorage(config, async () => {
    calls++;
    return new Response(null, { status: 200 });
  });
  for (const name of [
    "../private",
    "portal-media/../secret",
    "portal-media/%2e%2e/file",
    "portal-media//file",
    "https://evil.example/secret",
  ])
    await assert.rejects(() =>
      client.put(name, Buffer.from("test"), "image/webp")
    );
  for (const range of ["bytes=-", "bytes=1-2,4-8", "invalid"])
    await assert.rejects(() => client.get("portal-media/test.webp", range));
  assert.equal(calls, 0);
  await client.get("portal-media/test.webp", "bytes=0-20");
  assert.equal(calls, 1);
});
test("Bunny failures never expose response bodies or credential values", async () => {
  const client = createBunnyStorage(
    config,
    async () =>
      new Response("test-only-secret internal detail", { status: 401 })
  );
  await assert.rejects(
    () =>
      client.put("portal-media/test.webp", Buffer.from("test"), "image/webp"),
    (e) => !e.message.includes("test-only-secret")
  );
  await assert.rejects(
    () => client.get("portal-media/test.webp"),
    (e) => !e.message.includes("internal detail")
  );
});
test("Media uploads enforce supported formats and 20 MB size cap", async () => {
  assert.equal(mediaFileError({ type: "video/mp4", size: 100 }), "");
  assert.notEqual(mediaFileError({ type: "text/html", size: 100 }), "");
  assert.notEqual(
    mediaFileError({ type: "image/png", size: MAX_MEDIA_BYTES + 1 }),
    ""
  );
  await assert.rejects(
    () =>
      readMediaBody(
        new Request("http://localhost", {
          method: "POST",
          body: Buffer.alloc(MAX_MEDIA_BYTES + 1),
        })
      ),
    (e) => e.status === 413
  );
});
test("Images are verified, normalized and stripped of metadata", async () => {
  const image = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: "#668800" },
  })
    .withMetadata()
    .png()
    .toBuffer();
  const media = await prepareMedia(image, "image/png");
  assert.equal(media.contentType, "image/webp");
  const meta = await sharp(media.data).metadata();
  assert.equal(meta.width, 2048);
  assert.equal(meta.height, 1024);
  assert.equal(meta.exif, undefined);
  await assert.rejects(() =>
    prepareMedia(Buffer.from("<script>bad</script>"), "image/png")
  );
  await assert.rejects(() => prepareMedia(image, "image/jpeg"));
});
test("Video and audio payloads must match their declared format", async () => {
  const bytes = Buffer.concat([
    Buffer.from([0, 0, 0, 20]),
    Buffer.from("ftypisom"),
    Buffer.alloc(8),
  ]);
  const result = await prepareMedia(bytes, "video/mp4");
  assert.equal(result.extension, "mp4");
  assert.equal(result.data, bytes);
  for (const type of [
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "text/html",
  ])
    await assert.rejects(() => prepareMedia(Buffer.from("not media"), type));
});
