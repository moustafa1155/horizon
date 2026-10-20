# Server authentication

Login and account permissions now use MongoDB rather than browser accounts. The existing page design is retained. Public preview login and browser-based admin registration are disabled in every environment.

## Create your first administrator

Open a terminal in C:\Users\moust\Downloads\horizon-react-v1.0.0 and run:

```powershell
npm run auth:create-admin
```

Enter your name, chosen username and a password of 12–128 characters. The password is hidden and never written to a file or displayed by the script. This command uses the existing private MongoDB environment settings. It creates only the first account and refuses to run once accounts exist. The fixed first-account identifier prevents simultaneous setup commands from creating two initial admins. There is no public setup endpoint.

Then start the site and sign in. Under Users & Permissions, create accounts for staff and managers, assign a branch, and give their credentials to them privately. Existing browser accounts are not trusted or automatically imported; recreate them through the admin page. Do not send passwords in this chat or commit them to Git.

## Hosting

- Keep MONGODB_URI and MONGODB_DATABASE in the hosting provider's private environment settings.
- Render automatically supplies RENDER_EXTERNAL_URL, which is trusted for origin checks behind its HTTPS proxy. For a custom domain, also set APP_ORIGIN to its HTTPS origin (for example, https://portal.example.com). Surrounding whitespace and a trailing slash are normalized. Local development can leave both unset.
- Run the first-admin command locally against the same database that hosting uses, then deploy this version. No account password or session signing key needs to be stored in the hosting environment.
- Production requires HTTPS: the session cookie is Secure, HTTP-only, SameSite=Strict and uses the __Host- prefix. It expires after eight hours. Development uses a separate HTTP-only cookie on localhost.
- Account updates, password changes and account removal invalidate existing sessions. Every protected page and existing database endpoint checks the live account and session. MongoDB TTL indexes clean up expired sessions, but expiry is enforced immediately without waiting for cleanup.
- Managers can read and update staff only in their assigned branch. Only admins can create staff and manage accounts. Employees cannot access staff, accounts or company sales history. Managers cannot read admin sales history.
- Login throttling uses MongoDB counters, so it applies across server instances. Account changes use transactions to preserve admin-account protections under concurrent changes. MongoDB Atlas supports the required transactions.

## Verification

Run npm test and npm run build in the inner application folder. npm run test:auth-integration starts an isolated local production server, creates a uniquely named temporary test database, checks real logins and permissions, then removes that test database. It never tests against your company records. It requires the configured MongoDB user to have permission to create and remove that separate test database.

## Remaining separate work

This change secures server login, accounts, protected pages and the existing MongoDB APIs. Orders, stock checks, shifts, newly entered sales and branch edits still use browser storage. They are not yet shared submissions, and browser storage is not a secure company record store. Moving those workflows to authenticated database APIs remains separate work. Existing browser records are preserved. The previously reported Tailwind dependency advisories also remain open.
