import { useEffect, useRef, useState } from "react";
import Card from "components/card";
import { FiUpload, FiExternalLink } from "react-icons/fi";
import { mediaFileError, MEDIA_TYPES } from "../../../data/mediaFiles.mjs";
export default function MediaLibrary() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef(null);
  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/media", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setFiles(data.files);
    } catch (error) {
      setError(error.message || "Media library could not be loaded.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  async function upload(event) {
    event.preventDefault();
    const file = input.current?.files?.[0];
    const validation = mediaFileError(file);
    if (validation) {
      setError(validation);
      return;
    }
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/media", {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setFiles((current) => [data.file, ...current]);
      input.current.value = "";
      setNotice("Media file uploaded.");
    } catch (error) {
      setError(error.message || "The file could not be uploaded.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="mt-4 space-y-5 text-navy-700 dark:text-white">
      <Card extra="p-6">
        <h1 className="text-xl font-bold">Media library</h1>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
          Upload images, video and audio files. Up to 20 MB per file. Only
          admins can access this library.
        </p>
        <form onSubmit={upload} className="mt-5 flex flex-wrap items-end gap-4">
          <label className="min-w-0 flex-1 text-sm font-medium">
            Choose a media file
            <input
              ref={input}
              type="file"
              accept={MEDIA_TYPES.join(",")}
              disabled={pending}
              className="mt-2 block w-full rounded-xl border border-gray-200 bg-lightPrimary p-3 text-sm dark:border-white/10 dark:bg-navy-900"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            <FiUpload aria-hidden="true" />
            {pending ? "Uploading…" : "Upload file"}
          </button>
        </form>
        {error && (
          <p
            role="alert"
            className="mt-4 text-sm text-red-600 dark:text-red-300"
          >
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
      </Card>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Uploaded files ({files.length})</h2>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError("");
            refresh();
          }}
          className="text-sm text-brand-600 dark:text-brand-200"
        >
          Refresh library
        </button>
      </div>
      {loading ? (
        <p role="status">Loading media…</p>
      ) : files.length ? (
        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {files.map((file) => (
            <Card key={file.id} extra="overflow-hidden p-4">
              {file.contentType.startsWith("image/") ? (
                <img
                  src={file.url}
                  alt={file.name}
                  loading="lazy"
                  className="h-44 w-full rounded-xl bg-lightPrimary object-contain"
                />
              ) : file.contentType.startsWith("video/") ? (
                <video
                  src={file.url}
                  controls
                  preload="metadata"
                  className="bg-black h-44 w-full rounded-xl"
                />
              ) : (
                <audio
                  src={file.url}
                  controls
                  preload="metadata"
                  className="w-full"
                />
              )}
              <p className="mt-3 break-all text-sm font-bold">{file.name}</p>
              <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                {(file.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                {new Date(file.createdAt).toLocaleDateString("en-GB")}
              </p>
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm text-brand-600 dark:text-brand-200"
              >
                Open file
                <FiExternalLink aria-hidden="true" />
              </a>
            </Card>
          ))}
        </div>
      ) : (
        <Card extra="p-8 text-center text-sm">
          No media files uploaded yet.
        </Card>
      )}
    </div>
  );
}
