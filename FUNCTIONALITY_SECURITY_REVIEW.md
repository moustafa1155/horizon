> Updated after the server-authentication implementation on 20 October 2026: the access-control finding below is resolved in the local code. MongoDB accounts, expiring HTTP-only sessions, server page/API guards, branch-scoped staff access, login throttling and immediate session revocation are implemented. Public previews and public admin setup are disabled. See AUTHENTICATION_SETUP.md for first-admin creation and deployment. The browser-only business workflow and dependency findings remain open. The earlier verification details below describe the previous audit baseline.

# Functionality and security review — 20 October 2026

## Verification

- 21 automated tests pass, including role restrictions, branch dates, ISO weeks, sales calculations, shift validation, malformed requests and production API restrictions.
- The Next.js production build succeeds.
- An isolated browser preview was used to create a test branch, staff member, order, zero-count stock check and sales report. Card sales of £120.05 plus cash sales of £30.10 displayed £150.15 on the dashboard.
- Adding a shift updated Staff Details. Removing the shift through the whole-week editor cleared it. Employee preview exposed only stock checks and rejected direct navigation to Users. Manager preview exposed its four permitted pages.
- Production `/login` returns 200; `/api/employees`, `/api/branches` and `/api/imported-sales` return 403. Production responses include frame protection and content-type protection.
- No exact MongoDB URI or password from the local environment file was found in generated browser JavaScript. Environment files remain excluded from Git.
- Test browser records were isolated from the live database. No source spreadsheet was changed.

## Fixes made

- Connected the Staff Details timetable to saved shifts; resolved branch labels and manager branch filtering.
- Tightened shift time, overlap and break validation, with safe handling of damaged stored data.
- Allowed an imported branch with an empty type to be configured before saving.
- Restricted signed-in manager order and sales entry to their assigned branch; canonical role permissions prevent legacy grants from expanding employee or manager access in the interface.
- Made dashboard refresh reload imported sales.
- Rejected malformed or oversized employee request bodies; rejected blank national-insurance values.
- Centralized local database request restrictions, including cross-origin checks, and added production response headers.
- Improved sidebar navigation labeling and corrected the page breadcrumb target.

## Remaining security and functionality gaps

### High: access control is not enforced by a server session

Accounts and role information are stored in the browser. A user who controls that browser can modify them. Interface restrictions are useful for previews but do not secure an internal company application. Public role previews are still enabled for production. This review preserves that existing preview behavior.

Before internal use, store accounts and password hashes on the server, issue expiring secure HTTP-only session cookies, and authorize every API request by role and assigned branch. Account removal must revoke sessions. First-admin setup must be restricted, and public previews must be removed or explicitly isolated from business data. Add login throttling and server-side audit records as part of that work.

### High: shared business submissions are not connected end to end

Orders, stock checks, shifts, user accounts and newly entered sales reports use browser storage. Branch changes also remain in the browser. They do not synchronize between a manager's device and an administrator's device. Local development can access MongoDB employees and imported branch/sales records, while production database endpoints intentionally deny requests until server authentication exists.

Move these workflows to authenticated MongoDB APIs, validate branch ownership and duplicate submissions on the server, and test separate employee, manager and administrator sessions before using the site for business records.

### Dependency findings remain open

The dependency audit reported seven advisories: five high and two moderate. They affect the Tailwind 3 build/watch dependency chain, including braces and postcss-selector-parser. The suggested automatic repair upgrades Tailwind to a new major version, which requires a separate styling migration and visual verification. No forced major upgrade was applied.

## Scope

This is a local review of the current project, not a guarantee that every deployed configuration is secure. The fixes were verified locally; the deployed host and its environment were not changed. The site remains a functional preview, not an authenticated internal production system.
