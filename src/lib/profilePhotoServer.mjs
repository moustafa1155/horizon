import sharp from "sharp";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "../data/profilePhoto.mjs";
export const EMPLOYEE_REQUEST_BYTES =
  Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 16384;
export async function prepareProfilePhoto(value) {
  if (
    typeof value !== "string" ||
    value.length > Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 64
  )
    throw Error("Choose an image up to 2 MB.");
  const match =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value
    );
  if (!match || !PHOTO_TYPES.includes(match[1]))
    throw Error("Choose a JPEG, PNG or WebP image.");
  const data = Buffer.from(match[2], "base64");
  if (
    !data.length ||
    data.length > MAX_PHOTO_BYTES ||
    data.toString("base64") !== match[2]
  )
    throw Error("Choose a valid image up to 2 MB.");
  const signature =
    match[1] === "image/jpeg"
      ? data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      : match[1] === "image/png"
      ? data
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : data.subarray(0, 4).toString() === "RIFF" &&
        data.subarray(8, 12).toString() === "WEBP";
  if (!signature) throw Error("The selected file is not a valid image.");
  try {
    const image = sharp(data, {
      limitInputPixels: 16000000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      (metadata.pages || 1) > 1
    )
      throw Error();
    const output = await image
      .rotate()
      .resize(256, 256, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { data: output, contentType: "image/webp", updatedAt: new Date() };
  } catch {
    throw Error(
      "Choose a valid, non-animated image no larger than 16 megapixels."
    );
  }
}
