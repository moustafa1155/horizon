export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export function photoFileError(file) {
  if (!PHOTO_TYPES.includes(file?.type))
    return "Choose a JPEG, PNG or WebP image.";
  if (!file.size || file.size > MAX_PHOTO_BYTES)
    return "Choose an image up to 2 MB.";
  return "";
}
