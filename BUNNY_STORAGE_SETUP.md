# Bunny media storage

The admin-only Media Library uploads files through the Next.js server to Bunny storage. MongoDB stores the file names, storage paths, content types, sizes and upload ownership. Downloads and previews pass through authenticated admin-only routes; no public Pull Zone is required. The password never goes to the browser. Existing employee profile photos continue using their existing MongoDB storage.

## Render environment

Set BUNNY_STORAGE_ZONE to taste-midea-storage, BUNNY_STORAGE_HOST to storage.bunnycdn.com, and BUNNY_STORAGE_PASSWORD to the storage-zone password supplied privately. The local .env already contains these settings. Copy the password directly from your local private configuration or Bunny dashboard into Render Environment; do not add it to GitHub or a NEXT_PUBLIC_ variable. Deploy the latest commit after setting the variables.

## Uploads

Sign in as an admin and open Media Library in the sidebar. Supported formats: JPEG, PNG, WebP, MP4, WebM, MP3, WAV and OGG, up to 20 MB each. Images are verified, resized to fit 2048 pixels and converted to WebP with metadata stripped. Videos and audio are signature-checked and retain their formats. Files use unique names under portal-media/ so uploads do not overwrite existing files. Existing files in the storage zone are not automatically imported or modified. The library displays the latest 200 uploads.

The integration uses the Storage API with an AccessKey header carrying the storage-zone password. See https://bunnycdnstorage.docs.apiary.io/ for the official API reference.
