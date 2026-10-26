import { useEffect, useRef, useState } from "react";
import { FiDownload, FiUpload, FiEye } from "react-icons/fi";
import {
  ATTACHMENT_TYPES,
  attachmentFileError,
  attachmentNameError,
  attachmentExtension,
} from "../../../data/employeeAttachments.mjs";
export default function EmployeeFilesDialog({
  employee,
  canUpload,
  onClose,
  embedded = false,
  onPendingChange,
}) {
  const Container = embedded ? "section" : "dialog";
  const dialog = useRef(null);
  const input = useRef(null);
  const [files, setFiles] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const path = "/api/employees/" + employee.id + "/attachments";
  useEffect(() => {
    const element = dialog.current;
    if (!embedded) element.showModal();
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(path, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        setFiles(data.files);
      } catch (error) {
        if (error.name !== "AbortError")
          setError(error.message || "Employee files could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => {
      controller.abort();
      if (!embedded) element.close();
    };
  }, [path, embedded]);
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  async function upload(event) {
    event.preventDefault();
    if (pending || !canUpload) return;
    const file = input.current?.files?.[0];
    const validation = attachmentNameError(name) || attachmentFileError(file);
    if (validation) {
      setError(validation);
      return;
    }
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
          "X-Attachment-Name": encodeURIComponent(name.trim()),
        },
        body: file,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setFiles((current) => [data.file, ...current]);
      input.current.value = "";
      setName("");
      setNotice("Employee file uploaded.");
    } catch (error) {
      setError(error.message || "The file could not be uploaded.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Container
      ref={dialog}
      aria-labelledby="employee-files-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!embedded && !pending) onClose();
      }}
      className={
        embedded
          ? "text-navy-700 dark:text-white"
          : "backdrop:bg-black/40 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-3xl bg-white p-6 text-navy-700 shadow-xl dark:bg-navy-800 dark:text-white"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="employee-files-title" className="text-xl font-bold">
            Employee files
          </h2>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {employee.name}
          </p>
        </div>
        {!embedded && (
          <button
            type="button"
            aria-label="Close employee files"
            disabled={pending}
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xl disabled:opacity-50"
          >
            ×
          </button>
        )}
      </div>
      {canUpload && (
        <form onSubmit={upload} className="mt-5 space-y-4">
          <label className="block text-sm font-medium">
            File name
            <input
              autoFocus={!embedded}
              required
              maxLength={120}
              value={name}
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
              placeholder="For example: Employment contract"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 dark:border-white/10 dark:bg-navy-900"
            />
          </label>
          <label className="block text-sm font-medium">
            Choose file
            <input
              ref={input}
              required
              type="file"
              accept={Object.keys(ATTACHMENT_TYPES)
                .map((extension) => "." + extension)
                .join(",")}
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && !name.trim())
                  setName(file.name.replace(/\.[^.]+$/, "").slice(0, 120));
                setError("");
              }}
              className="mt-2 block w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 text-sm dark:border-white/10 dark:bg-navy-900"
            />
          </label>
          <p className="text-xs text-gray-700 dark:text-gray-300">
            PDF, images, Word (.docx), Excel (.xlsx), text, video or audio.
            Maximum 20 MB.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <FiUpload aria-hidden="true" />
            {pending ? "Uploading…" : "Upload file"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-4 text-sm text-green-700 dark:text-green-300"
        >
          {notice}
        </p>
      )}
      <div className="mt-6 border-t border-gray-200 pt-4 dark:border-white/10">
        <h3 className="font-bold">Saved files ({files.length})</h3>
        {loading ? (
          <p role="status" className="mt-3 text-sm">
            Loading files…
          </p>
        ) : files.length ? (
          <ul className="mt-3 divide-y divide-gray-200 dark:divide-white/10">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{file.name}</p>
                  <p className="mt-1 break-all text-xs text-gray-700 dark:text-gray-300">
                    {file.originalName} · {(file.size / 1024 / 1024).toFixed(2)}{" "}
                    MB · {new Date(file.createdAt).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {[
                    "pdf",
                    "jpg",
                    "jpeg",
                    "png",
                    "webp",
                    "mp4",
                    "webm",
                    "mp3",
                    "wav",
                    "ogg",
                  ].includes(attachmentExtension(file.originalName)) && (
                    <a
                      href={file.url + "?preview=1"}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={"View " + file.name}
                      title={"View " + file.name}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-lg text-brand-600 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-navy-900"
                    >
                      <FiEye aria-hidden="true" />
                    </a>
                  )}
                  <a
                    href={file.url}
                    aria-label={"Download " + file.name}
                    title={"Download " + file.name}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg text-brand-600 hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-navy-900"
                  >
                    <FiDownload aria-hidden="true" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            No files uploaded for this employee.
          </p>
        )}
      </div>
    </Container>
  );
}
