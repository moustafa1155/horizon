import sharp from "sharp";
import { MAX_MEDIA_BYTES, MEDIA_TYPES } from "../data/mediaFiles.mjs";
export async function readMediaBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("Choose a media file.");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MEDIA_BYTES) {
        await reader.cancel();
        const error = Error("Choose a file up to 20 MB.");
        error.status = 413;
        throw error;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw Error("Choose a media file.");
  return Buffer.concat(chunks);
}
export async function prepareMedia(data, type) {
  if (
    !MEDIA_TYPES.includes(type) ||
    !data.length ||
    data.length > MAX_MEDIA_BYTES
  )
    throw Error("Choose a supported media file up to 20 MB.");
  if (type.startsWith("image/")) {
    try {
      const image = sharp(data, {
        limitInputPixels: 16000000,
        failOn: "warning",
      });
      const info = await image.metadata();
      const expected = {
        "image/jpeg": "jpeg",
        "image/png": "png",
        "image/webp": "webp",
      };
      if (info.format !== expected[type] || (info.pages || 1) > 1)
        throw Error();
      const output = await image
        .rotate()
        .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      return { data: output, contentType: "image/webp", extension: "webp" };
    } catch {
      throw Error(
        "Choose a valid, non-animated image no larger than 16 megapixels."
      );
    }
  }
  const starts = (value) =>
    data.subarray(0, value.length).toString("ascii") === value;
  const valid =
    type === "video/mp4"
      ? data.length >= 12 && data.subarray(4, 8).toString() === "ftyp"
      : type === "video/webm"
      ? data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
        data.subarray(0, 4096).includes(Buffer.from("webm"))
      : type === "audio/mpeg"
      ? starts("ID3") || (data[0] === 255 && (data[1] & 224) === 224)
      : type === "audio/wav"
      ? starts("RIFF") && data.subarray(8, 12).toString() === "WAVE"
      : type === "audio/ogg" && starts("OggS");
  if (!valid)
    throw Error("The file contents do not match the selected media type.");
  return {
    data,
    contentType: type,
    extension: {
      "video/mp4": "mp4",
      "video/webm": "webm",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/ogg": "ogg",
    }[type],
  };
}
