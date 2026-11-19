# Shared database storage

All business save forms use MongoDB APIs. Authentication, permissions and branch restrictions are checked on the server for every request.

- Employee details: employees. Admins and designated branch managers can add employees. Optional linked stock-only logins: portal_users. Passwords are salted hashes. Removing an employee deletes their linked login, sessions and saved timetable documents.
- Branches: branches. Admins create, edit, remove and restore branches. Removal retains historical reports. Revisions reject stale edits; names are unique regardless of case.
- Orders: weekly_orders. Admins and assigned branch managers submit and view; one order per branch/week.
- Stock checks: weekly_stock_checks. Employees submit only for their assigned branch; admins can view company submissions.
- Sales reports: weekly_sales_reports. Managers enter and edit daily card/cash for a selected week in their assigned branch; only admins read company-wide history. Daily blanks stay null, weekly totals are calculated on the server, and revisions reject stale edits. Imported reports remain intact. Card/cash are integer pennies, with totals calculated from both. The dashboard reads the database.
- Staff shifts: weekly_staff_timetables. A document contains one employee/week, rows and revision. Admins and designated branch managers edit; invalid/overlapping shifts are rejected, and clearing all shifts persists an empty week. Stale saves return 409.
- Financial summaries: weekly_financial_summaries. Admin-only Monday–Sunday table for Total Sale, Expenses, Goods, Rent, Cost and Profit and Loss. Weekly totals sum daily figures; blank days stay null. Original imported weekly totals are preserved when first replaced by a daily breakdown.

Browser-only historical entries have not been automatically copied or deleted. Database records are now the source displayed by these pages. Previous local storage remains available for a separately reviewed import; never copy untrusted local records directly into MongoDB.

No new hosting variables are needed beyond the existing MongoDB and authentication configuration. Deploy the updated code to activate the APIs. Tests use a temporary isolated database and do not alter business records.

## Order-sheet product catalog

The products collection supplies searchable product lists to orders and stock checks. The 154 source names and pack sizes are retained from the two supplied Med Food order workbooks. Source cells, categories and workbook hashes are recorded in src/data/orderProducts.json. Run npm run products:import for a new database; rerunning it preserves existing products and does not create duplicates. The source workbooks are read only.
