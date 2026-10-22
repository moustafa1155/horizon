import { useEffect, useRef, useState } from "react";
import { FiUser } from "react-icons/fi";
import { photoFileError } from "../../../data/profilePhoto.mjs";
export default function ProfilePhotoInput({
  initialUrl,
  onChange,
  onReadingChange,
  disabled,
}) {
  const [preview, setPreview] = useState(initialUrl || "");
  const [error, setError] = useState("");
  const input = useRef(null);
  const reader = useRef(null);
  useEffect(
    () => () => {
      if (reader.current) {
        reader.current.onload = null;
        reader.current.onerror = null;
        reader.current.onloadend = null;
        reader.current.abort();
      }
    },
    []
  );
  function choose(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validation = photoFileError(file);
    if (validation) {
      setError(validation);
      event.target.value = "";
      return;
    }
    setError("");
    onReadingChange(true);
    const current = new FileReader();
    reader.current = current;
    current.onload = () => {
      const value = String(current.result);
      setPreview(value);
      onChange(value);
    };
    current.onerror = () => {
      setError("The image could not be read. Please choose it again.");
      if (input.current) input.current.value = "";
    };
    current.onloadend = () => onReadingChange(false);
    current.readAsDataURL(file);
  }
  return (
    <div className="mb-5 rounded-xl border border-gray-200 p-4 dark:border-white/10">
      <label htmlFor="employee-profile-photo" className="text-sm font-medium">
        Profile picture{" "}
        <span className="font-normal text-gray-700 dark:text-gray-300">
          (optional)
        </span>
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {preview ? (
          <img
            src={preview}
            alt="Employee profile preview"
            className="h-20 w-20 rounded-full object-cover"
            width={80}
            height={80}
          />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-lightPrimary text-3xl text-brand-500 dark:bg-navy-900">
            <FiUser aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <input
            ref={input}
            id="employee-profile-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled}
            onChange={choose}
            aria-describedby="employee-photo-help"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-medium file:text-brand-600"
          />
          <p
            id="employee-photo-help"
            className="mt-2 text-xs text-gray-700 dark:text-gray-300"
          >
            JPEG, PNG or WebP, up to 2 MB.
          </p>
          {preview && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setPreview("");
                setError("");
                onChange(null);
                if (input.current) input.current.value = "";
              }}
              className="mt-2 text-sm text-red-600 hover:underline dark:text-red-300"
            >
              Remove picture
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
