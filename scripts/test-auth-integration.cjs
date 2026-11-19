const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { loadEnvConfig } = require("@next/env");
const { MongoClient, ObjectId } = require("mongodb");
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
async function main() {
  const database =
    "horizon_auth_test_" +
    Math.floor(Date.now() / 1000) +
    "_" +
    randomBytes(3).toString("hex");
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  let server;
  let passed = 0;
  const check = (actual, expected, label) => {
    assert.deepEqual(actual, expected, label);
    passed++;
    console.log("PASS " + label);
  };
  const base = "http://localhost:10003";
  const password = randomBytes(24).toString("base64url");
  const { hashPassword, tokenHash } = await import("../src/lib/authCore.mjs");
  try {
    await client.connect();
    const db = client.db(database);
    const credentials = await hashPassword(password);
    const b1 = new ObjectId(),
      b2 = new ObjectId();
    await db.collection("branches").insertMany([
      {
        _id: b1,
        name: "Auth test A",
        type: "permanent",
        startDate: "",
        endDate: "",
        removed: false,
      },
      {
        _id: b2,
        name: "Auth test B",
        type: "permanent",
        startDate: "",
        endDate: "",
        removed: false,
      },
    ]);
    const users = ["Admin", "Branch Manager", "Employee"].map((role, i) => ({
      _id: new ObjectId(),
      name: "Auth test " + role,
      username: ["auth.admin", "auth.manager", "auth.employee"][i],
      role,
      branchId: role === "Admin" ? "" : b1.toString(),
      removed: false,
      authVersion: 1,
      credentials,
    }));
    await db.collection("portal_users").insertMany(users);
    const employee = {
      fullName: "Auth fixture A",
      phoneNumber: "00000000000",
      nationalInsuranceNumber: "TEST-ONLY-A",
      email: "auth-a@example.invalid",
      branchId: b1.toString(),
    };
    const other = {
      ...employee,
      fullName: "Auth fixture B",
      nationalInsuranceNumber: "TEST-ONLY-B",
      email: "auth-b@example.invalid",
      branchId: b2.toString(),
    };
    const inserted = await db
      .collection("employees")
      .insertMany([employee, other]);
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "-H",
        "127.0.0.1",
        "-p",
        "10003",
      ],
      {
        env: {
          ...process.env,
          MONGODB_DATABASE: database,
          APP_ORIGIN: base + "/",
          RENDER_EXTERNAL_URL: "https://auth-fixture.onrender.com",
        },
        stdio: "ignore",
        windowsHide: true,
      }
    );
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        await fetch(base + "/login");
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    assert.ok(ready, "test server started");
    const request = async (
      url,
      { cookie, body, method = "GET", origin = base } = {}
    ) => {
      const response = await fetch(base + url, {
        method,
        redirect: "manual",
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(method !== "GET"
            ? { origin, "content-type": "application/json" }
            : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      let data;
      try {
        data = await response.json();
      } catch {}
      return { response, data, status: response.status };
    };
    for (const url of [
      "/api/users",
      "/api/employees",
      "/api/branches",
      "/api/imported-sales",
    ])
      check((await request(url)).status, 401, "anonymous denied " + url);
    check(
      (
        await request("/api/auth/session", {
          cookie: "__Host-horizon-session=forged-admin",
        })
      ).status,
      401,
      "forged session denied"
    );
    check(
      (await request("/admin/users")).status,
      307,
      "protected page redirects anonymous visitor"
    );
    check(
      (
        await request("/api/auth/login", {
          method: "POST",
          origin: "https://evil.example",
          body: { username: "auth.admin", password },
        })
      ).status,
      403,
      "cross-site login denied"
    );
    check(
      (
        await request("/api/auth/login", {
          method: "POST",
          body: { username: "auth.admin", password: "incorrect" },
        })
      ).status,
      401,
      "wrong password denied"
    );
    const login = async (username) => {
      const result = await request("/api/auth/login", {
        method: "POST",
        body: { username, password },
      });
      check(result.status, 200, "login " + username);
      const header = result.response.headers.get("set-cookie");
      assert.match(header, /HttpOnly/i);
      assert.match(header, /Secure/i);
      assert.match(header, /SameSite=strict/i);
      const cookie = header.split(";")[0];
      const token = cookie.split("=")[1];
      check(
        !!(await db
          .collection("portal_sessions")
          .findOne({ _id: tokenHash(token) })),
        true,
        "hashed session persisted"
      );
      return cookie;
    };
    const catalogProducts = require("../src/data/orderProducts.json");
    await db.collection("products").insertMany(catalogProducts.map(({ name, category }) => ({ name, category, removed: false })));
    const admin = await login("auth.admin"),
      manager = await login("auth.manager"),
      employeeCookie = await login("auth.employee");
    const mobileLogin = username => request("/api/mobile/sign-in", {
      method: "POST", body: { username, password },
    });
    check((await request("/api/mobile/staff")).status, 401, "mobile directory requires authentication");
    check((await mobileLogin("auth.employee")).status, 403, "stock-only account cannot sign into staff directory");
    const mobile = await mobileLogin("auth.manager");
    check(mobile.status, 200, "manager can sign into mobile staff");
    const mobileHeaders = { Authorization: "Bearer " + mobile.data.token };
    const mobileStaff = await fetch(base + "/api/mobile/staff", { headers: mobileHeaders });
    check(mobileStaff.status, 200, "mobile staff request succeeds");
    const mobileDirectory = await mobileStaff.json();
    check(mobileDirectory.employees.map(person => person.fullName), ["Auth fixture A"], "mobile directory is branch-scoped");
    check("nationalInsuranceNumber" in mobileDirectory.employees[0], false, "mobile directory omits national insurance");
    check((await request("/api/employees", { cookie: "__Host-horizon-session=" + mobile.data.token })).status, 401, "mobile token cannot authenticate web routes");
    check((await fetch(base + "/api/mobile/staff", { method: "DELETE", headers: mobileHeaders })).status, 200, "mobile sign-out succeeds");
    check((await fetch(base + "/api/mobile/staff", { headers: mobileHeaders })).status, 401, "revoked mobile token is rejected");

    check(
      (await request("/api/users", { cookie: admin })).data.users.length,
      3,
      "admin can list accounts"
    );

    await db.collection("branches").updateOne({ _id: b1 }, { $set: { type: "" } });
    check((await request("/api/products")).status, 401, "product list requires authentication");
    for (const cookie of [admin, manager, employeeCookie]) {
      const productResponse = await request("/api/products", { cookie });
      check(productResponse.status, 200, "authorised role can load product dropdown");
      check(productResponse.data.products.length, 154, "dropdown includes all supplied products");
      const names = productResponse.data.products.map(product => product.name);
      check(names, [...names].sort((a, b) => a.localeCompare(b, "en-GB", { sensitivity: "base", numeric: true })), "products sorted alphabetically across all categories");
      check(productResponse.data.products.every(product => typeof product.name === "string" && typeof product.category === "string" && !("source" in product)), true, "product API exposes only dropdown fields");
    }
    const stockDraft = { branch: "Auth test A", employee: "Spoofed name", week: "2026-11-02", items: [{ product: "Test product", quantity: 10 }], notes: "Test only" };
    check((await request("/api/stock-checks")).status, 401, "anonymous stock access denied");
    check((await request("/api/stock-checks", { cookie: manager })).status, 403, "manager stock access denied");
    check((await request("/api/stock-checks", { cookie: employeeCookie, method: "POST", origin: "https://evil.example", body: stockDraft })).status, 403, "cross-site stock submission denied");
    check((await request("/api/stock-checks", { cookie: employeeCookie, method: "POST", body: { ...stockDraft, branch: "Auth test B" } })).status, 403, "employee cannot submit stock for another branch");
    const stockSaved = await request("/api/stock-checks", { cookie: employeeCookie, method: "POST", body: stockDraft });
    check(stockSaved.status, 201, "employee submits stock with unspecified imported branch type");
    check(stockSaved.data.check.employee, users[2].name, "stock author comes from authenticated account");
    check(await db.collection("weekly_stock_checks").countDocuments({ branchId: b1.toString(), week: stockDraft.week }), 1, "stock persists in MongoDB");
    check((await request("/api/stock-checks", { cookie: admin })).data.checks.length, 1, "admin sees employee submission");
    check((await request("/api/stock-checks", { cookie: employeeCookie, method: "POST", body: stockDraft })).status, 409, "duplicate branch week stock rejected");
    await db.collection("weekly_stock_checks").insertOne({ branchId: b2.toString(), week: stockDraft.week, recordedAt: new Date().toISOString() });
    check((await request("/api/stock-checks", { cookie: employeeCookie })).data.checks.length, 1, "employee cannot read other branch stock");
    await db.collection("branches").updateOne({ _id: b1 }, { $set: { type: "permanent" } });
    const newBranch = { name: "Temporary test branch", type: "temporary", startDate: "2026-11-01", endDate: "2026-12-01", removed: false };
    check((await request("/api/branches", { cookie: manager, method: "POST", body: newBranch })).status, 403, "manager cannot create branches");
    check((await request("/api/branches", { cookie: admin, method: "POST", origin: "https://evil.example", body: newBranch })).status, 403, "cross-site branch writes denied");
    check((await request("/api/branches", { cookie: admin, method: "POST", body: { ...newBranch, endDate: "" } })).status, 400, "temporary branch needs dates on server");
    check((await request("/api/branches", { cookie: admin, method: "POST", body: newBranch })).status, 201, "admin creates persistent branch");
    check(await db.collection("branches").countDocuments({ name: newBranch.name }), 1, "branch creation persists in MongoDB");
    check((await request("/api/branches", { cookie: admin, method: "POST", body: { ...newBranch, name: newBranch.name.toUpperCase() } })).status, 400, "duplicate branch name rejected");
    let savedBranch = (await request("/api/branches", { cookie: admin })).data.branches.find(b => b.name === newBranch.name);
    check((await request("/api/branches", { cookie: admin, method: "PUT", body: { ...savedBranch, removed: true } })).status, 200, "admin removes persistent branch");
    check((await db.collection("branches").findOne({ name: newBranch.name })).removed, true, "branch removal stored in MongoDB");
    check((await request("/api/branches", { cookie: admin, method: "PUT", body: savedBranch })).status, 409, "stale branch edit rejected");
    savedBranch = (await request("/api/branches", { cookie: admin })).data.branches.find(b => b.name === newBranch.name);
    check((await request("/api/branches", { cookie: admin, method: "PUT", body: { ...savedBranch, removed: false } })).status, 200, "admin restores persistent branch");
    const orderDraft = { branch: "Auth test A", manager: "Spoofed manager", week: "2026-11-02", items: [{ product: "Test product", quantity: 12 }], notes: "Test only" };
    check((await request("/api/orders")).status, 401, "anonymous order read denied");
    check((await request("/api/orders", { cookie: employeeCookie, method: "POST", body: orderDraft })).status, 403, "employee order write denied");
    check((await request("/api/orders", { cookie: manager, method: "POST", body: { ...orderDraft, branch: "Auth test B" } })).status, 403, "manager cannot order for another branch");
    check((await request("/api/orders", { cookie: manager, method: "POST", body: { ...orderDraft, items: [{ product: "Test", quantity: 0 }] } })).status, 400, "server validates order quantities");
    const orderResult = await request("/api/orders", { cookie: manager, method: "POST", body: orderDraft });
    check(orderResult.status, 201, "manager creates shared order");
    check(orderResult.data.order.manager, users[1].name, "order manager comes from signed-in account");
    check((await request("/api/orders", { cookie: admin })).data.orders.length, 1, "admin sees submitted order");
    check(await db.collection("weekly_orders").countDocuments({ week: orderDraft.week }), 1, "order stored in database");
    check((await request("/api/orders", { cookie: manager, method: "POST", body: orderDraft })).status, 409, "duplicate weekly order denied");
    await db.collection("weekly_orders").insertOne({ branchId: b2.toString(), branch: "Auth test B", week: orderDraft.week, items: [] });
    check((await request("/api/orders", { cookie: manager })).data.orders.length, 1, "manager cannot read other branch orders");
    const salesDraft = { branch: "Auth test A", manager: "Spoofed manager", week: "2026-11-02", card: "123.45", cash: "20.05", notes: "Test only" };
    check((await request("/api/sales-reports", { cookie: manager })).status, 403, "manager cannot read sales history");
    check((await request("/api/sales-reports", { cookie: employeeCookie, method: "POST", body: salesDraft })).status, 403, "employee cannot submit sales");
    check((await request("/api/sales-reports", { cookie: manager, method: "POST", body: { ...salesDraft, branch: "Auth test B" } })).status, 403, "manager cannot submit other branch sales");
    check((await request("/api/sales-reports", { cookie: manager, method: "POST", body: { ...salesDraft, card: "-1" } })).status, 400, "negative sales rejected");
    check((await request("/api/sales-reports", { cookie: manager, method: "POST", body: salesDraft })).status, 201, "manager submits sales to database");
    const salesRecord = await db.collection("weekly_sales_reports").findOne({ week: salesDraft.week });
    check(salesRecord.cardCents + salesRecord.cashCents, 14350, "sales stored with exact penny totals");
    check((await request("/api/sales-reports", { cookie: admin })).data.reports.length, 1, "admin sees submitted sales");
    check((await request("/api/imported-sales", { cookie: admin })).data.reports.length, 1, "dashboard sales endpoint includes new reports");
    check((await request("/api/sales-reports", { cookie: manager, method: "POST", body: salesDraft })).status, 409, "duplicate weekly sales rejected");
    const daily = Array.from({ length: 7 }, (_, day) => ({ day, card: "", cash: "" }));
    daily[0].cost = "12.34"; daily[1].cost = "0";
    daily[0].card = "100.10"; daily[0].cash = "20.05"; daily[1].card = "30.20";
    const dailyBody = { branchId: b1.toString(), week: salesDraft.week, daily, notes: "Daily fixture", revision: 0 };
    const dailyPath = "/api/sales-reports?" + new URLSearchParams({ branchId: b1.toString(), week: salesDraft.week });
    check((await request(dailyPath, { cookie: manager })).status, 200, "manager can reopen a selected week for their branch");
    check((await request("/api/sales-reports?" + new URLSearchParams({ branchId: b2.toString(), week: salesDraft.week }), { cookie: manager })).status, 403, "manager cannot load other branch daily figures");
    check((await request("/api/sales-reports", { cookie: employeeCookie, method: "PUT", body: dailyBody })).status, 403, "employee daily sales changes denied");
    check((await request("/api/sales-reports", { cookie: manager, method: "PUT", body: { ...dailyBody, branchId: b2.toString() } })).status, 403, "manager daily writes restricted to own branch");
    check((await request("/api/sales-reports", { cookie: manager, method: "PUT", origin: "https://evil.example", body: dailyBody })).status, 403, "cross-site daily sales writes denied");
    const dailySaved = await request("/api/sales-reports", { cookie: manager, method: "PUT", body: dailyBody });
    check(dailySaved.status, 200, "daily sales update existing weekly report");
    check(dailySaved.data.report.cardCents, 13030, "daily card total calculated on server");
    check(dailySaved.data.report.cashCents, 2005, "daily cash total calculated on server");
    check(dailySaved.data.report.daily[2].cardCents, null, "unentered days remain empty in database");
    check(await db.collection("weekly_sales_reports").countDocuments({ week: salesDraft.week }), 1, "daily save does not duplicate weekly report");
    const editedDaily = structuredClone(daily); editedDaily[0].card = "110.10";
    check((await request("/api/sales-reports", { cookie: manager, method: "PUT", body: { ...dailyBody, daily: editedDaily, revision: 1 } })).status, 200, "manager can edit and save daily report again");
    check((await request(dailyPath, { cookie: manager })).data.report.cardCents, 14030, "edited daily amounts survive reload");
    check((await request("/api/sales-reports", { cookie: manager, method: "PUT", body: dailyBody })).status, 409, "stale daily save cannot overwrite newer changes");
    const badDaily = structuredClone(daily); badDaily[0].cash = "-1";
    check((await request("/api/sales-reports", { cookie: manager, method: "PUT", body: { ...dailyBody, daily: badDaily, revision: 2 } })).status, 400, "negative daily amounts rejected");
    const newWeek = "2026-11-09";
    check((await request("/api/sales-reports", { cookie: manager, method: "PUT", body: { ...dailyBody, week: newWeek, revision: 0 } })).status, 200, "first daily save creates a new weekly report");
    check((await request("/api/sales-reports", { cookie: manager })).status, 403, "daily editing does not expose company sales history to manager");
    check((await request("/api/sales-reports", { cookie: admin })).data.reports.find(report => report.week === salesDraft.week).cardCents, 14030, "admin totals reflect latest daily edits");
    const costReport = (await request(dailyPath, { cookie: manager })).data.report;
    check(costReport.costCents, 1234, "daily costs persist and total separately from sales");
    check(costReport.daily[1].costCents, 0, "zero daily cost preserved");
    check(costReport.daily[2].costCents, null, "blank daily cost stays empty");
    const revisedCosts = structuredClone(editedDaily); revisedCosts[0].cost = "20.01";
    check((await request("/api/sales-reports", { cookie: manager, method: "PUT", body: { ...dailyBody, daily: revisedCosts, revision: 2 } })).status, 200, "daily costs can be edited and saved again");
    const updatedCosts = (await request(dailyPath, { cookie: admin })).data.report;
    check(updatedCosts.costCents, 2001, "updated cost survives reload for admin");
    check(updatedCosts.cardCents + updatedCosts.cashCents, 16035, "cost edits do not alter sales totals");
    const timetable = { employeeId: inserted.insertedIds[0].toString(), week: "2026-11-02", revision: 0, rows: [{ id: "test-shift", day: 0, start: "09:00", end: "17:00", breakMinutes: 30 }] };
    check((await request("/api/timetables", { cookie: employeeCookie })).status, 403, "stock-only employee cannot read timetables");
    check((await request("/api/timetables", { cookie: manager, method: "PUT", body: { ...timetable, employeeId: inserted.insertedIds[1].toString() } })).status, 404, "manager cannot edit other branch timetable");
    check((await request("/api/timetables", { cookie: manager, method: "PUT", body: { ...timetable, week: "2026-02-30" } })).status, 400, "invalid timetable date rejected");
    check((await request("/api/timetables", { cookie: manager, method: "PUT", body: { ...timetable, rows: [...timetable.rows, { ...timetable.rows[0], id: "overlap" }] } })).status, 400, "overlapping shifts rejected on server");
    check((await request("/api/timetables", { cookie: manager, method: "PUT", body: timetable })).status, 200, "manager saves assigned staff timetable");
    check((await request("/api/timetables", { cookie: admin })).data.timetables[0].rows.length, 1, "admin sees saved shifts");
    check((await request("/api/timetables", { cookie: manager, method: "PUT", body: timetable })).status, 409, "stale timetable changes rejected");
    check((await request("/api/timetables", { cookie: manager, method: "PUT", body: { ...timetable, revision: 1, rows: [{ ...timetable.rows[0], start: "10:00" }] } })).status, 200, "manager edits saved shift");
    check((await request("/api/timetables", { cookie: manager, method: "PUT", body: { ...timetable, revision: 2, rows: [] } })).status, 200, "manager removes all weekly shifts");
    check((await db.collection("weekly_staff_timetables").findOne({ employeeId: timetable.employeeId })).rows.length, 0, "empty timetable remains empty in database");
    const managerStaff = { fullName: "Manager-created fixture", phoneNumber: "00000000000", nationalInsuranceNumber: "MANAGER-NEW", email: "manager-new@example.invalid" };
    check((await request("/api/employees", { cookie: manager, method: "POST", body: { ...managerStaff, branchId: b2.toString() } })).status, 403, "manager cannot add staff to another branch");
    const managerAdded = await request("/api/employees", { cookie: manager, method: "POST", body: managerStaff });
    check(managerAdded.status, 201, "manager adds staff without choosing a branch");
    check(managerAdded.data.employee.branchId, b1.toString(), "manager staff automatically assigned to their branch");
    await request("/api/employees", { cookie: admin, method: "DELETE", body: { id: managerAdded.data.employee.id, confirmed: true } });
    const managerLogin = await request("/api/employees", { cookie: manager, method: "POST", body: { ...managerStaff, account: { username: "manager.created", password }, role: "Admin" } });
    check(managerLogin.status, 201, "manager can assign employee login when adding own staff");
    const managerLoginUser = await db.collection("portal_users").findOne({ username: "manager.created" });
    check(managerLoginUser.role, "Employee", "manager cannot create privileged account via staff form");
    check(managerLoginUser.branchId, b1.toString(), "manager-created login restricted to assigned branch");
    await request("/api/employees", { cookie: admin, method: "DELETE", body: { id: managerLogin.data.employee.id, confirmed: true } });
    await db.collection("portal_users").updateOne({ _id: users[1]._id }, { $set: { branchId: "" } });
    check((await request("/api/employees", { cookie: manager, method: "POST", body: managerStaff })).status, 403, "unassigned manager cannot add staff");
    await db.collection("portal_users").updateOne({ _id: users[1]._id }, { $set: { branchId: b1.toString() } });
    const accountEmployee = {
      fullName: "Linked account fixture", phoneNumber: "00000000000",
      nationalInsuranceNumber: "TEST-LINKED", email: "linked@example.invalid",
      branchId: b1.toString(), account: { username: "linked.staff", password },
    };
    const weakAccount = await request("/api/employees", { cookie: admin, method: "POST", body: { ...accountEmployee, account: { username: "linked.staff", password: "short" } } });
    check(weakAccount.status, 400, "employee account rejects weak password");
    check((await request("/api/employees", { cookie: admin, method: "POST", body: { ...accountEmployee, branchId: "" } })).status, 400, "employee login requires branch assignment");
    const linked = await request("/api/employees", { cookie: admin, method: "POST", body: accountEmployee });
    check(linked.status, 201, "admin creates staff and login together");
    check("account" in linked.data.employee || "credentials" in linked.data.employee, false, "employee response contains no login secrets");
    const linkedUser = await db.collection("portal_users").findOne({ username: "linked.staff" });
    check(linkedUser.employeeId.toString(), linked.data.employee.id, "login linked to employee record");
    check(linkedUser.role, "Employee", "new account restricted to employee role");
    check(typeof linkedUser.credentials.hash, "string", "new login stores password hash");
    check("password" in linkedUser, false, "plaintext password never stored");
    const linkedCookie = await login("linked.staff");
    check((await request("/admin/weekly-stock-checks", { cookie: linkedCookie })).status, 200, "new employee can sign in for stock checking");
    check((await request("/api/employees", { cookie: linkedCookie })).status, 403, "new employee cannot read staff details");
    const duplicate = await request("/api/employees", { cookie: admin, method: "POST", body: { ...accountEmployee, email: "rollback@example.invalid", nationalInsuranceNumber: "TEST-ROLLBACK" } });
    check(duplicate.status, 409, "duplicate employee username rejected");
    check(await db.collection("employees").countDocuments({ email: "rollback@example.invalid" }), 0, "duplicate account rolls back employee creation");
    check((await request("/api/employees", { cookie: admin, method: "DELETE", body: { id: linked.data.employee.id, confirmed: true } })).status, 200, "linked employee can be deleted");
    check(await db.collection("portal_users").findOne({ _id: linkedUser._id }), null, "employee deletion deletes linked login");
    check((await request("/api/auth/session", { cookie: linkedCookie })).status, 401, "employee deletion revokes linked login session");
    const financialWeek = "2026-10-12";
    const financialPath =
      "/api/financial-summaries?" +
      new URLSearchParams({ branchId: b1.toString(), week: financialWeek });
    const figures = {
      totalSaleCents: 12345,
      expensesCents: 1000,
      goodsCents: null,
      rentCents: 0,
      profitLossCents: -500,
    };
    const financialBody = {
      branchId: b1.toString(),
      week: financialWeek,
      revision: 0,
      values: figures,
    };
    check(
      (await request(financialPath)).status,
      401,
      "financial summary denies anonymous access"
    );
    for (const cookie of [manager, employeeCookie]) {
      check(
        (await request(financialPath, { cookie })).status,
        403,
        "financial summary readable only by admins"
      );
      check(
        (
          await request("/api/financial-summaries", {
            cookie,
            method: "PUT",
            body: financialBody,
          })
        ).status,
        403,
        "financial summary writable only by admins"
      );
    }
    check(
      (await request(financialPath, { cookie: admin })).data.summary,
      null,
      "unreported financial week stays empty"
    );
    check(
      (
        await request("/api/financial-summaries", {
          cookie: admin,
          method: "PUT",
          origin: "https://evil.example",
          body: financialBody,
        })
      ).status,
      403,
      "cross-site financial edit denied"
    );
    check(
      (
        await request("/api/financial-summaries", {
          cookie: admin,
          method: "PUT",
          body: { ...financialBody, week: "2026-02-30" },
        })
      ).status,
      400,
      "invalid financial week rejected"
    );
    check(
      (
        await request("/api/financial-summaries", {
          cookie: admin,
          method: "PUT",
          body: {
            ...financialBody,
            values: { ...figures, expensesCents: -100 },
          },
        })
      ).status,
      400,
      "negative financial expense rejected"
    );
    const financialSaved = await request("/api/financial-summaries", {
      cookie: admin,
      method: "PUT",
      body: financialBody,
    });
    check(financialSaved.status, 200, "admin can save financial summary");
    check(
      financialSaved.data.summary.goodsCents,
      null,
      "missing goods value preserved"
    );
    check(financialSaved.data.summary.rentCents, 0, "zero rent preserved");
    check(
      financialSaved.data.summary.profitLossCents,
      -500,
      "loss amount preserved"
    );
    const savedFinancial = await db
      .collection("weekly_financial_summaries")
      .findOne({ branchId: b1.toString(), week: financialWeek });
    check(
      savedFinancial.totalSaleCents,
      12345,
      "financial amount persists in MongoDB"
    );
    check(
      savedFinancial.updatedBy,
      users[0]._id.toString(),
      "financial edit records admin identity"
    );
    check(
      (
        await request("/api/financial-summaries", {
          cookie: admin,
          method: "PUT",
          body: financialBody,
        })
      ).status,
      409,
      "duplicate financial create cannot overwrite saved figures"
    );
    const blankValues = Object.fromEntries(
      Object.keys(figures).map((key) => [key, null])
    );
    check(
      (
        await request("/api/financial-summaries", {
          cookie: admin,
          method: "PUT",
          body: { ...financialBody, revision: 1, values: blankValues },
        })
      ).status,
      200,
      "admin can clear financial inputs back to empty"
    );
    const clearedFinancial = (await request(financialPath, { cookie: admin }))
      .data.summary;
    check(
      clearedFinancial.totalSaleCents,
      null,
      "cleared total sale remains empty after reload"
    );
    check(
      clearedFinancial.profitLossCents,
      null,
      "profit loss is not invented when blank"
    );
    check(clearedFinancial.revision, 2, "financial edits increment revision");
    check(
      (
        await request("/api/financial-summaries", {
          cookie: admin,
          method: "PUT",
          body: { ...financialBody, revision: 1 },
        })
      ).status,
      409,
      "stale financial edits rejected"
    );
    check(
      (
        await request(
          "/api/financial-summaries?" +
            new URLSearchParams({
              branchId: new ObjectId().toString(),
              week: financialWeek,
            }),
          { cookie: admin }
        )
      ).status,
      404,
      "unknown branch financial access rejected"
    );
    const dailyFinanceWeek = "2026-11-16";
    await db.collection("weekly_financial_summaries").insertOne({ branchId: b1.toString(), week: dailyFinanceWeek, totalSaleCents: 77777, expensesCents: null, goodsCents: null, rentCents: 500, profitLossCents: null, revision: 1, source: { file: "Test only workbook", sheet: "Test week" } });
    const financialDays = Array.from({ length: 7 }, (_, day) => ({ day, totalSaleCents: null, expensesCents: null, goodsCents: null, rentCents: null, costCents: null, profitLossCents: null }));
    financialDays[0].totalSaleCents = 10000; financialDays[1].totalSaleCents = 2000;
    financialDays[0].costCents = 250; financialDays[1].costCents = 0;
    financialDays[0].profitLossCents = -100;
    const dailyFinanceBody = { branchId: b1.toString(), week: dailyFinanceWeek, revision: 1, daily: financialDays, values: { ...figures, totalSaleCents: 999999 } };
    check((await request("/api/financial-summaries", { cookie: manager, method: "PUT", body: dailyFinanceBody })).status, 403, "manager cannot edit dashboard daily finances");
    const dailyFinanceSaved = await request("/api/financial-summaries", { cookie: admin, method: "PUT", body: dailyFinanceBody });
    check(dailyFinanceSaved.status, 200, "admin saves daily financial breakdown");
    check(dailyFinanceSaved.data.summary.totalSaleCents, 12000, "weekly finance totals calculated from daily inputs on server");
    check(dailyFinanceSaved.data.summary.costCents, 250, "weekly financial cost total saved");
    check(dailyFinanceSaved.data.summary.daily[1].costCents, 0, "daily zero cost remains zero");
    check(dailyFinanceSaved.data.summary.daily[2].costCents, null, "unentered financial days remain blank");
    check(dailyFinanceSaved.data.summary.profitLossCents, -100, "daily losses are preserved");
    const financeStored = await db.collection("weekly_financial_summaries").findOne({ branchId: b1.toString(), week: dailyFinanceWeek });
    check(financeStored.originalWeeklyValues.totalSaleCents, 77777, "original weekly imported totals preserved without allocating across days");
    check(financeStored.source.sheet, "Test week", "financial source provenance preserved");
    const financeReload = await request("/api/financial-summaries?" + new URLSearchParams({ branchId: b1.toString(), week: dailyFinanceWeek }), { cookie: admin });
    check(financeReload.data.summary.daily.length, 7, "daily financial figures survive database reload");
    check((await request("/api/financial-summaries", { cookie: admin, method: "PUT", body: dailyFinanceBody })).status, 409, "stale daily financial changes rejected");
    const badFinancialDays = structuredClone(financialDays); badFinancialDays[0].costCents = -1;
    check((await request("/api/financial-summaries", { cookie: admin, method: "PUT", body: { ...dailyFinanceBody, revision: 2, daily: badFinancialDays } })).status, 400, "negative daily finance costs rejected");
    check((await request("/api/financial-summaries", { cookie: admin, method: "PUT", body: { ...dailyFinanceBody, revision: 2, daily: financialDays.map(row => Object.fromEntries(Object.keys(row).map(key => [key, key === "day" ? row.day : null]))) } })).status, 200, "admin can clear daily finances back to empty");
    const sharp = require("sharp");
    const photoBytes = await sharp({
      create: { width: 400, height: 300, channels: 3, background: "#668800" },
    })
      .png()
      .toBuffer();
    const profilePhoto =
      "data:image/png;base64," + photoBytes.toString("base64");
    const photoPath =
      "/api/employees/" + inserted.insertedIds[0].toString() + "/photo";
    check(
      (await request(photoPath, { cookie: admin })).status,
      404,
      "missing profile photo returns not found"
    );
    for (const [record, id] of [
      [employee, inserted.insertedIds[0]],
      [other, inserted.insertedIds[1]],
    ])
      check(
        (
          await request("/api/employees", {
            cookie: admin,
            method: "PUT",
            body: { ...record, id: id.toString(), profilePhoto },
          })
        ).status,
        200,
        "profile photo saved to employee"
      );
    const storedPhoto = (
      await db.collection("employees").findOne({ _id: inserted.insertedIds[0] })
    ).profilePhoto;
    check(
      storedPhoto.data._bsontype,
      "Binary",
      "profile picture stored as MongoDB binary"
    );
    check(
      storedPhoto.contentType,
      "image/webp",
      "photo is normalized for storage"
    );
    const directory = (await request("/api/employees", { cookie: admin })).data
      .employees;
    check(
      directory.every(
        (row) =>
          typeof row.profilePhotoUrl === "string" && !("profilePhoto" in row)
      ),
      true,
      "directory returns protected URLs without image bytes"
    );
    const imageResponse = await fetch(base + photoPath, {
      headers: { cookie: manager },
    });
    check(
      imageResponse.status,
      200,
      "assigned manager can view staff profile picture"
    );
    check(
      imageResponse.headers.get("content-type"),
      "image/webp",
      "photo has correct image content type"
    );
    check(
      imageResponse.headers.get("cache-control"),
      "private, no-store",
      "profile photo is not publicly cached"
    );
    const imageMetadata = await sharp(
      Buffer.from(await imageResponse.arrayBuffer())
    ).metadata();
    check(
      [imageMetadata.width, imageMetadata.height],
      [256, 256],
      "stored profile photo is displayed at bounded dimensions"
    );
    check(
      (await request(photoPath)).status,
      401,
      "anonymous profile photo access denied"
    );
    check(
      (await request(photoPath, { cookie: employeeCookie })).status,
      403,
      "stock-only employee cannot view staff profile photos"
    );
    check(
      (
        await request(
          "/api/employees/" + inserted.insertedIds[1].toString() + "/photo",
          { cookie: manager }
        )
      ).status,
      404,
      "manager cannot view another branch profile picture"
    );
    check(
      (
        await request("/api/employees", {
          cookie: admin,
          method: "PUT",
          body: {
            ...employee,
            id: inserted.insertedIds[0].toString(),
            profilePhoto: "data:image/png;base64,YmFk",
          },
        })
      ).status,
      400,
      "invalid photo upload rejected"
    );
    check(
      (await request(photoPath, { cookie: admin })).status,
      200,
      "invalid upload preserves existing picture"
    );
    const addedPhoto = await request("/api/employees", {
      cookie: admin,
      method: "POST",
      body: {
        ...employee,
        fullName: "Auth photo fixture",
        nationalInsuranceNumber: "PHOTO-TEST",
        email: "photo@example.invalid",
        profilePhoto,
      },
    });
    check(
      addedPhoto.status,
      201,
      "new employee can be created with profile picture"
    );
    const addedPath =
      "/api/employees/" + addedPhoto.data.employee.id + "/photo";
    check(
      (await request(addedPath, { cookie: admin })).status,
      200,
      "new employee photo survives database round trip"
    );
    check(
      (
        await request("/api/employees", {
          cookie: admin,
          method: "PUT",
          body: {
            ...employee,
            id: addedPhoto.data.employee.id,
            fullName: "Auth photo fixture",
            nationalInsuranceNumber: "PHOTO-TEST",
            email: "photo@example.invalid",
          },
        })
      ).status,
      200,
      "editing without selecting photo preserves it"
    );
    check(
      (await request(addedPath, { cookie: admin })).status,
      200,
      "unchanged photo remains available"
    );
    check(
      (
        await request("/api/employees", {
          cookie: admin,
          method: "PUT",
          body: {
            ...employee,
            id: addedPhoto.data.employee.id,
            fullName: "Auth photo fixture",
            nationalInsuranceNumber: "PHOTO-TEST",
            email: "photo@example.invalid",
            profilePhoto: null,
          },
        })
      ).status,
      200,
      "existing profile picture can be removed"
    );
    check(
      (await request(addedPath, { cookie: admin })).status,
      404,
      "removed profile picture no longer served"
    );
    await request("/api/employees", {
      cookie: admin,
      method: "DELETE",
      body: { id: addedPhoto.data.employee.id, confirmed: true },
    });
    for (const page of [
      "default",
      "employees",
      "weekly-orders",
      "weekly-sales-reports",
      "weekly-staff-timetables",
      "branches",
      "users",
    ])
      check(
        (await request("/admin/" + page, { cookie: employeeCookie })).status,
        307,
        "employee blocked from page " + page
      );
    check(
      (await request("/admin/weekly-stock-checks", { cookie: employeeCookie }))
        .status,
      200,
      "employee stock page available"
    );
    for (const page of [
      "employees",
      "weekly-orders",
      "weekly-sales-reports",
      "weekly-staff-timetables",
    ])
      check(
        (await request("/admin/" + page, { cookie: manager })).status,
        200,
        "manager permitted page " + page
      );
    for (const page of ["default", "weekly-stock-checks", "branches", "users"])
      check(
        (await request("/admin/" + page, { cookie: manager })).status,
        307,
        "manager blocked from page " + page
      );
    check(
      (await request("/api/auth/setup", { method: "POST", body: {} })).status,
      404,
      "no public admin setup endpoint"
    );

    check(
      (await request("/api/users", { cookie: manager })).status,
      403,
      "manager cannot list accounts"
    );
    check(
      (await request("/api/employees", { cookie: employeeCookie })).status,
      403,
      "employee cannot read staff data"
    );
    const staff = await request("/api/employees", { cookie: manager });
    check(
      staff.data.employees.map((e) => e.fullName),
      ["Auth fixture A"],
      "manager sees assigned branch only"
    );
    check(
      (
        await request("/api/branches", { cookie: employeeCookie })
      ).data.branches.map((b) => b.name),
      ["Auth test A"],
      "employee sees assigned branch only"
    );
    check(
      (await request("/api/imported-sales", { cookie: manager })).status,
      403,
      "manager cannot read company sales history"
    );
    check(
      (
        await request("/api/users", {
          cookie: admin,
          method: "POST",
          origin: "https://evil.example",
          body: {},
        })
      ).status,
      403,
      "cross-site account mutation denied"
    );
    check(
      (
        await request("/api/employees", {
          cookie: manager,
          method: "PUT",
          body: { ...other, id: inserted.insertedIds[1].toString() },
        })
      ).status,
      404,
      "manager cannot update another branch staff"
    );
    check(
      (
        await request("/api/employees", {
          cookie: manager,
          method: "PUT",
          body: {
            ...employee,
            fullName: "Auth fixture edited",
            id: inserted.insertedIds[0].toString(),
            branchId: b2.toString(),
          },
        })
      ).status,
      200,
      "manager can edit own branch staff"
    );
    check(
      (
        await db
          .collection("employees")
          .findOne({ _id: inserted.insertedIds[0] })
      ).branchId,
      b1.toString(),
      "manager cannot reassign staff branch"
    );
    check(
      (
        await request("/api/users", {
          cookie: admin,
          method: "PATCH",
          body: { id: users[0]._id.toString(), removed: true },
        })
      ).status,
      400,
      "self removal denied"
    );
    check(
      (
        await request("/api/users", {
          cookie: admin,
          method: "POST",
          body: {
            name: "New staff",
            username: "auth.new",
            password,
            role: "Employee",
            branchId: b1.toString(),
          },
        })
      ).status,
      201,
      "admin creates database account"
    );
    check(
      (
        await request("/api/users", {
          cookie: admin,
          method: "PUT",
          body: {
            id: users[1]._id.toString(),
            name: "Auth manager updated",
            username: "auth.manager",
            password: "",
            role: "Branch Manager",
            branchId: b1.toString(),
          },
        })
      ).status,
      200,
      "admin updates account"
    );
    check(
      (await request("/api/auth/session", { cookie: manager })).status,
      401,
      "account update revokes existing session"
    );
    check(
      (
        await request("/api/users", {
          cookie: admin,
          method: "PATCH",
          body: { id: users[2]._id.toString(), removed: true },
        })
      ).status,
      200,
      "admin disables account"
    );
    check(
      (await request("/api/auth/session", { cookie: employeeCookie })).status,
      401,
      "disabled account session rejected immediately"
    );
    check(
      (
        await request("/api/auth/login", {
          method: "POST",
          body: { username: "auth.employee", password },
        })
      ).status,
      401,
      "disabled account cannot log in"
    );

    const staffId = inserted.insertedIds[0].toString();
    check(
      (
        await request("/api/employees", {
          method: "DELETE",
          body: { id: staffId, confirmed: true },
        })
      ).status,
      401,
      "anonymous employee removal denied"
    );
    check(
      (
        await request("/api/employees", {
          cookie: admin,
          method: "DELETE",
          origin: "https://evil.example",
          body: { id: staffId, confirmed: true },
        })
      ).status,
      403,
      "cross-site employee removal denied"
    );
    const managerAgain = await login("auth.manager");
    check(
      (
        await request("/api/employees", {
          cookie: managerAgain,
          method: "DELETE",
          body: { id: staffId, confirmed: true },
        })
      ).status,
      403,
      "manager employee removal denied"
    );
    check(
      (
        await request("/api/employees", {
          cookie: admin,
          method: "DELETE",
          body: { id: "invalid", confirmed: true },
        })
      ).status,
      400,
      "invalid employee removal identifier denied"
    );
    check(
      (
        await request("/api/employees", {
          cookie: admin,
          method: "DELETE",
          body: { id: staffId },
        })
      ).status,
      400,
      "employee removal requires confirmation"
    );
    check(
      (await request("/api/employees", { cookie: admin })).data.employees
        .length,
      2,
      "unconfirmed removal preserves employees"
    );
    check(
      (
        await request("/api/employees", {
          cookie: admin,
          method: "DELETE",
          body: { id: staffId, confirmed: true },
        })
      ).status,
      200,
      "admin removes confirmed employee"
    );
    check(
      (
        await db
          .collection("employees")
          .findOne({ _id: inserted.insertedIds[0] })
      ),
      null,
      "employee record is permanently deleted from MongoDB"
    );
    check(
      (await request("/api/employees", { cookie: admin })).data.employees.map(
        (e) => e.fullName
      ),
      ["Auth fixture B"],
      "removed employee hidden from directory"
    );
    check(
      (await request("/api/employees", { cookie: managerAgain })).data.employees
        .length,
      0,
      "removed employee hidden from manager timetable staff"
    );
    check(
      (
        await request("/api/employees", {
          cookie: admin,
          method: "PUT",
          body: { ...employee, id: staffId },
        })
      ).status,
      404,
      "deleted employee cannot be edited"
    );
    check(
      (
        await request("/api/employees", {
          cookie: admin,
          method: "DELETE",
          body: { id: staffId, confirmed: true },
        })
      ).status,
      404,
      "duplicate removal rejected"
    );
    check(
      (await request("/api/employees/" + staffId + "/photo", { cookie: admin }))
        .status,
      404,
      "deleted staff photo no longer accessible"
    );
    const expired = await db
      .collection("portal_sessions")
      .findOne({ userId: users[0]._id });
    await db
      .collection("portal_sessions")
      .updateOne({ _id: expired._id }, { $set: { expiresAt: new Date(0) } });
    check(
      (await request("/api/auth/session", { cookie: admin })).status,
      401,
      "expired session denied before TTL cleanup"
    );
    const again = await login("auth.admin");
    check(
      (await request("/api/auth/logout", { cookie: again, method: "POST" }))
        .status,
      200,
      "logout succeeds"
    );
    check(
      (await request("/api/auth/session", { cookie: again })).status,
      401,
      "logout token cannot be reused"
    );
    let limited;
    for (let i = 0; i < 11; i++)
      limited = await request("/api/auth/login", {
        method: "POST",
        body: { username: "auth.unknown", password: "incorrect" },
      });
    check(limited.status, 429, "login attempts limited in database");

    const primary = await login("auth.admin");
    check(
      (
        await request("/api/users", {
          cookie: primary,
          method: "POST",
          body: {
            name: "Second admin",
            username: "auth.second",
            password,
            role: "Admin",
            branchId: "",
          },
        })
      ).status,
      201,
      "admin creates second admin"
    );
    const second = await login("auth.second");
    const secondAccount = await db
      .collection("portal_users")
      .findOne({ username: "auth.second" });
    const results = await Promise.all([
      request("/api/users", {
        cookie: primary,
        method: "PATCH",
        body: { id: secondAccount._id.toString(), removed: true },
      }),
      request("/api/users", {
        cookie: second,
        method: "PATCH",
        body: { id: users[0]._id.toString(), removed: true },
      }),
    ]);
    check(
      results.filter((r) => r.status === 200).length,
      1,
      "concurrent admin removals allow only one change"
    );
    check(
      await db
        .collection("portal_users")
        .countDocuments({ role: "Admin", removed: false }),
      1,
      "concurrent changes retain an active admin"
    );
    console.log(passed + " authentication integration checks passed.");
  } finally {
    if (server && server.exitCode === null) {
      const ended = new Promise((r) => server.once("exit", r));
      server.kill();
      await ended;
    }
    if (
      /^horizon_auth_test_[0-9]+_[a-f0-9]+$/.test(database) &&
      client.db(database).databaseName === database
    )
      await client.db(database).dropDatabase();
    await client.close();
  }
}
main().catch((error) => {
  console.error("Authentication integration test failed:", error.message);
  process.exitCode = 1;
});
