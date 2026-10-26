import {
  ATTACHMENT_TYPES,
  attachmentExtension,
  attachmentFileError,
} from "../data/employeeAttachments.mjs";
function officeArchive(data, required) {
  if (data.length < 22 || data.readUInt32LE(0) !== 0x04034b50) return false;
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--)
    if (data.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) return false;
  const offset = data.readUInt32LE(end + 16),
    size = data.readUInt32LE(end + 12),
    names = new Set();
  if (offset + size > end) return false;
  for (let position = offset; position < offset + size; ) {
    if (
      position + 46 > data.length ||
      data.readUInt32LE(position) !== 0x02014b50
    )
      return false;
    const length = data.readUInt16LE(position + 28),
      extra = data.readUInt16LE(position + 30),
      comment = data.readUInt16LE(position + 32);
    if (position + 46 + length + extra + comment > offset + size) return false;
    names.add(
      data.subarray(position + 46, position + 46 + length).toString("utf8")
    );
    position += 46 + length + extra + comment;
    if (names.size > 10000) return false;
  }
  return names.has("[Content_Types].xml") && names.has(required);
}
export function validateEmployeeAttachment(data, originalName) {
  const error = attachmentFileError({ name: originalName, size: data.length });
  if (error) throw Error(error);
  const extension = attachmentExtension(originalName);
  let valid = false;
  switch (extension) {
    case "pdf":
      valid = data.subarray(0, 5).toString() === "%PDF-";
      break;
    case "jpg":
    case "jpeg":
      valid = data.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
      break;
    case "png":
      valid = data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      break;
    case "webp":
      valid =
        data.subarray(0, 4).toString() === "RIFF" &&
        data.subarray(8, 12).toString() === "WEBP";
      break;
    case "docx":
      valid = officeArchive(data, "word/document.xml");
      break;
    case "xlsx":
      valid = officeArchive(data, "xl/workbook.xml");
      break;
    case "mp4":
      valid = data.length >= 12 && data.subarray(4, 8).toString() === "ftyp";
      break;
    case "webm":
      valid =
        data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
        data.subarray(0, 4096).includes(Buffer.from("webm"));
      break;
    case "mp3":
      valid =
        data.subarray(0, 3).toString() === "ID3" ||
        (data[0] === 255 && (data[1] & 224) === 224);
      break;
    case "wav":
      valid =
        data.subarray(0, 4).toString() === "RIFF" &&
        data.subarray(8, 12).toString() === "WAVE";
      break;
    case "ogg":
      valid = data.subarray(0, 4).toString() === "OggS";
      break;
    case "txt":
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(data);
        valid = !data.includes(0);
      } catch {}
      break;
  }
  if (!valid) throw Error("The file contents do not match its file type.");
  return { contentType: ATTACHMENT_TYPES[extension], extension };
}
