import test from "node:test";
import assert from "node:assert/strict";
import {
  attachmentNameError,
  attachmentFileError,
  attachmentDownloadName,
  MAX_ATTACHMENT_BYTES,
} from "../src/data/employeeAttachments.mjs";
import { validateEmployeeAttachment } from "../src/lib/employeeAttachmentFile.mjs";
test("Employee files have editable display names and safe download names", () => {
  assert.equal(attachmentNameError("Employment contract"), "");
  for (const value of [
    "",
    " ",
    "a".repeat(121),
    "bad" + String.fromCharCode(10) + "name",
    null,
  ])
    assert.notEqual(attachmentNameError(value), "");
  assert.equal(attachmentDownloadName("Contract", "scan.pdf"), "Contract.pdf");
  assert.equal(
    attachmentDownloadName("Contract.pdf", "scan.pdf"),
    "Contract.pdf"
  );
  assert.equal(
    attachmentDownloadName("ID / passport", "scan.png"),
    "ID - passport.png"
  );
});
test("Employee attachment files reject unsupported extensions, invalid names and oversize bodies", () => {
  assert.equal(attachmentFileError({ name: "Contract.PDF", size: 100 }), "");
  for (const file of [
    { name: "bad.exe", size: 100 },
    { name: "../private.pdf", size: 100 },
    { name: "bad.pdf", size: 0 },
    { name: "large.pdf", size: MAX_ATTACHMENT_BYTES + 1 },
  ])
    assert.notEqual(attachmentFileError(file), "");
});
test("Document upload checks file content against its extension", () => {
  assert.equal(
    validateEmployeeAttachment(
      Buffer.from("%PDF-1.4\nTest-only file\n%%EOF"),
      "contract.pdf"
    ).contentType,
    "application/pdf"
  );
  assert.equal(
    validateEmployeeAttachment(
      Buffer.from("Test-only text file"),
      "contract.txt"
    ).contentType,
    "text/plain"
  );
  for (const [bytes, name] of [
    [Buffer.from("<html>bad</html>"), "contract.pdf"],
    [Buffer.from("bad"), "photo.png"],
    [Buffer.from("bad"), "contract.docx"],
    [Buffer.from([0, 255]), "contract.txt"],
  ])
    assert.throws(() => validateEmployeeAttachment(bytes, name));
});
function zipEntries(names) {
  const locals = [],
    central = [];
  let offset = 0;
  for (const name of names) {
    const encoded = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(encoded.length, 26);
    locals.push(local, encoded);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50);
    entry.writeUInt16LE(encoded.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, encoded);
    offset += 30 + encoded.length;
  }
  const table = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(table.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, table, end]);
}
test("Office uploads require the correct document structure", () => {
  assert.equal(
    validateEmployeeAttachment(
      zipEntries(["[Content_Types].xml", "word/document.xml"]),
      "contract.docx"
    ).extension,
    "docx"
  );
  assert.equal(
    validateEmployeeAttachment(
      zipEntries(["[Content_Types].xml", "xl/workbook.xml"]),
      "record.xlsx"
    ).extension,
    "xlsx"
  );
  assert.throws(() =>
    validateEmployeeAttachment(
      zipEntries(["[Content_Types].xml", "xl/workbook.xml"]),
      "contract.docx"
    )
  );
  assert.throws(() =>
    validateEmployeeAttachment(Buffer.from("PK"), "contract.docx")
  );
});

test("Employee attachments accept media formats and reject mismatched content", () => {
  const mp4 = Buffer.concat([
    Buffer.from([0, 0, 0, 20]),
    Buffer.from("ftypisom"),
    Buffer.alloc(8),
  ]);
  assert.equal(
    validateEmployeeAttachment(mp4, "clip.mp4").contentType,
    "video/mp4"
  );
  assert.equal(
    validateEmployeeAttachment(Buffer.from("ID3test-only"), "recording.mp3")
      .contentType,
    "audio/mpeg"
  );
  for (const name of [
    "clip.mp4",
    "clip.webm",
    "recording.mp3",
    "recording.wav",
    "recording.ogg",
  ])
    assert.throws(() =>
      validateEmployeeAttachment(Buffer.from("not media"), name)
    );
});
