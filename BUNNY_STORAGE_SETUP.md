# Bunny storage connection

Bunny storage is connected through server-only upload and download APIs. Only admins can call these APIs. There is no separate media page or sidebar item.

Files upload to Bunny; MongoDB stores their metadata. Storage credentials stay in the private .env file and server environment. Existing employee profile photos continue using MongoDB.

For Render set BUNNY_STORAGE_ZONE=taste-midea-storage, BUNNY_STORAGE_HOST=storage.bunnycdn.com, and BUNNY_STORAGE_PASSWORD to your private storage-zone password. Never put the password in Git or a NEXT_PUBLIC_ variable.

Employee attachments are available from the paperclip icon in Staff Details. Admins and branch managers can upload and download files for employees they are authorized to view. Managers are limited to their assigned branch. Each attachment has a chosen name and is stored privately in Bunny, with its employee link and metadata saved in MongoDB. Maximum file size is 20 MB. Supported types: PDF, JPEG, PNG, WebP, DOCX, XLSX and UTF-8 text. Downloads are protected and files belonging to archived employees are inaccessible.
