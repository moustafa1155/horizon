# Horizon Company Portal — Next.js

Run from the outer horizon-react-v1.0.0 folder or this application folder:

- npm install (inside this application folder)
- npm run dev — http://localhost:5173
- npm run build
- npm start — runs the production build

Next.js App Router pages live in src/app. Existing Tailwind UI components and business pages remain in src/components and src/views. Navigation uses Next.js links and router. The workspace loads in the browser because its accounts, permissions and business records currently use localStorage/sessionStorage. No server authentication or shared database has been added. Preview access is development-only. Storage keys are unchanged; use the same localhost origin and browser to retain existing records.

The root package.json forwards commands to Downloads/horizon-tailwind-react. Previous Vite entry/config files are retained as .vite-backup files for reference.

## Hosted role preview
Production builds default to a role-preview landing screen (Admin, Branch Manager, Employee). Employee data uses a separate browser-only preview store; live MongoDB access stays disabled outside localhost development. No employee database records or credentials are published. Set NEXT_PUBLIC_HOSTED_PREVIEW=false in the hosting environment and rebuild to disable this preview. Shared production accounts and database access still require server authentication.
