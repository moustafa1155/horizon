export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
export const MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
];
export function mediaFileError(file) {
  if (!MEDIA_TYPES.includes(file?.type))
    return "Choose a JPEG, PNG, WebP, MP4, WebM, MP3, WAV or OGG file.";
  if (!file.size || file.size > MAX_MEDIA_BYTES)
    return "Choose a file up to 20 MB.";
  return "";
}
