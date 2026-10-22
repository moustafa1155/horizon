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
    const admin = await login("auth.admin"),
      manager = await login("auth.manager"),
      employeeCookie = await login("auth.employee");
    check(
      (await request("/api/users", { cookie: admin })).data.users.length,
      3,
      "admin can list accounts"
    );

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
      ).removed,
      true,
      "employee is archived rather than deleted"
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
      "archived employee cannot be edited"
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
      "archived staff photo no longer accessible"
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
