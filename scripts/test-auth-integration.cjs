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

    check(
      (await request("/api/media")).status,
      401,
      "media library denies anonymous access"
    );
    check(
      (await request("/api/media", { cookie: admin })).status,
      200,
      "admin can open media library"
    );
    for (const cookie of [manager, employeeCookie]) {
      check(
        (await request("/api/media", { cookie })).status,
        403,
        "media library denies non-admin access"
      );
      check(
        (await request("/api/media", { cookie, method: "POST", body: {} }))
          .status,
        403,
        "non-admin media upload denied"
      );
      check(
        (await request("/admin/media", { cookie })).status,
        404,
        "non-admin media page denied"
      );
      check(
        (
          await request("/api/media/" + new ObjectId().toString() + "/file", {
            cookie,
          })
        ).status,
        403,
        "non-admin media download denied"
      );
    }
    check(
      (
        await request("/api/media", {
          cookie: admin,
          method: "POST",
          origin: "https://evil.example",
          body: {},
        })
      ).status,
      403,
      "cross-site media upload denied"
    );
    check(
      (
        await request("/api/media/" + new ObjectId().toString() + "/file", {
          cookie: admin,
        })
      ).status,
      404,
      "missing media cannot be downloaded"
    );

    if (process.env.RUN_BUNNY_LIVE_TEST === "1") {
      const sharp = require("sharp");
      const { createBunnyStorage } = await import(
        "../src/lib/bunnyStorage.mjs"
      );
      const storage = createBunnyStorage();
      let livePath;
      try {
        const bytes = await sharp({
          create: { width: 2, height: 2, channels: 3, background: "#668800" },
        })
          .png()
          .toBuffer();
        const uploaded = await fetch(base + "/api/media", {
          method: "POST",
          headers: {
            cookie: admin,
            origin: base,
            "content-type": "image/png",
            "x-file-name": encodeURIComponent(
              "Test-only integration image.png"
            ),
          },
          body: bytes,
        });
        const result = await uploaded.json();
        check(uploaded.status, 201, "live authenticated media upload succeeds");
        const saved = await db
          .collection("media_files")
          .findOne({ _id: new ObjectId(result.file.id) });
        livePath = saved?.storagePath;
        check(saved.provider, "bunny", "media metadata records Bunny provider");
        check(
          saved.uploadedBy,
          users[0]._id.toString(),
          "media metadata records uploader"
        );
        check(
          result.file.name,
          "Test-only integration image.webp",
          "image download name matches stored format"
        );
        check(
          "storagePath" in result.file,
          false,
          "media response hides internal storage paths"
        );
        const loaded = await fetch(base + result.file.url, {
          headers: { cookie: admin },
        });
        check(
          loaded.status,
          200,
          "live uploaded media can be retrieved through protected API"
        );
        check(
          loaded.headers.get("cache-control"),
          "private, no-store",
          "live media remains private"
        );
        check(
          (await sharp(Buffer.from(await loaded.arrayBuffer())).metadata())
            .format,
          "webp",
          "live media content matches the stored image format"
        );
        check(
          (
            await request("/api/media/" + result.file.id + "/file", {
              cookie: manager,
            })
          ).status,
          403,
          "manager cannot retrieve live uploaded media"
        );
      } finally {
        if (livePath) {
          assert.ok(
            livePath.startsWith("portal-media/") &&
              /^[a-f0-9-]+[.]webp$/.test(livePath.slice("portal-media/".length))
          );
          await storage.remove(livePath);
          console.log("PASS temporary live upload removed after verification");
        }
      }
    }

    const attachmentsPath =
      "/api/employees/" + inserted.insertedIds[0].toString() + "/attachments";
    const otherAttachmentsPath =
      "/api/employees/" + inserted.insertedIds[1].toString() + "/attachments";
    check(
      (await request(attachmentsPath)).status,
      401,
      "anonymous employee attachment access denied"
    );
    check(
      (await request(attachmentsPath, { cookie: employeeCookie })).status,
      403,
      "stock-only employee cannot read staff attachments"
    );
    check(
      (await request(attachmentsPath, { cookie: admin })).data.files.length,
      0,
      "admin can view employee attachments"
    );
    check(
      (await request(attachmentsPath, { cookie: manager })).status,
      200,
      "manager can view own branch employee attachments"
    );
    check(
      (await request(otherAttachmentsPath, { cookie: manager })).status,
      404,
      "manager cannot list another branch attachments"
    );
    check(
      (
        await request(otherAttachmentsPath, {
          cookie: manager,
          method: "POST",
          body: {},
        })
      ).status,
      404,
      "manager cannot upload to another branch employee"
    );
    check(
      (
        await request(attachmentsPath, {
          cookie: employeeCookie,
          method: "POST",
          body: {},
        })
      ).status,
      403,
      "stock-only employee cannot upload staff files"
    );
    check(
      (
        await request(attachmentsPath, {
          cookie: admin,
          method: "POST",
          origin: "https://evil.example",
          body: {},
        })
      ).status,
      403,
      "cross-site employee attachment upload denied"
    );
    check(
      (
        await request(attachmentsPath, {
          cookie: admin,
          method: "POST",
          body: {},
        })
      ).status,
      400,
      "employee file upload requires a name"
    );
    const attachmentFixtureId = new ObjectId();
    await db
      .collection("employee_attachments")
      .insertOne({
        _id: attachmentFixtureId,
        employeeId: inserted.insertedIds[1].toString(),
        name: "Other branch fixture",
        originalName: "fixture.txt",
        size: 1,
        createdAt: new Date(),
      });
    check(
      (
        await request(attachmentsPath + "/" + attachmentFixtureId + "/file", {
          cookie: admin,
        })
      ).status,
      404,
      "attachment cannot be downloaded through the wrong employee"
    );
    check(
      (
        await request(
          otherAttachmentsPath + "/" + attachmentFixtureId + "/file",
          { cookie: manager }
        )
      ).status,
      404,
      "manager cannot download another branch attachment"
    );
    if (process.env.RUN_BUNNY_LIVE_TEST === "1") {
      const { createBunnyStorage } = await import(
        "../src/lib/bunnyStorage.mjs"
      );
      const storage = createBunnyStorage();
      let livePath;
      try {
        const bytes = Buffer.from(
          "Employee attachment integration test. No personal data."
        );
        const upload = await fetch(base + attachmentsPath, {
          method: "POST",
          headers: {
            cookie: manager,
            origin: base,
            "content-type": "text/plain",
            "x-file-name": "fixture.txt",
            "x-attachment-name": encodeURIComponent("Test contract"),
          },
          body: bytes,
        });
        const result = await upload.json();
        check(
          upload.status,
          201,
          "manager can upload a named attachment for assigned branch"
        );
        const record = await db
          .collection("employee_attachments")
          .findOne({ _id: new ObjectId(result.file.id) });
        livePath = record.storagePath;
        check(record.name, "Test contract", "custom attachment name saved");
        check(
          record.employeeId,
          inserted.insertedIds[0].toString(),
          "file is linked to selected employee"
        );
        check(
          record.uploadedBy,
          users[1]._id.toString(),
          "file records the uploading user"
        );
        check(
          "storagePath" in result.file,
          false,
          "attachment response hides private storage location"
        );
        const list = await request(attachmentsPath, { cookie: manager });
        check(
          list.data.files[0].name,
          "Test contract",
          "saved attachment appears after reload"
        );
        const download = await fetch(base + result.file.url, {
          headers: { cookie: manager },
        });
        check(
          download.status,
          200,
          "authorized manager can download employee attachment"
        );
        check(
          download.headers.get("content-disposition").startsWith("attachment;"),
          true,
          "employee file downloads rather than executing inline"
        );
        check(
          download.headers
            .get("content-disposition")
            .includes("Test%20contract.txt"),
          true,
          "download uses chosen file name"
        );
        check(
          Buffer.from(await download.arrayBuffer()).equals(bytes),
          true,
          "Bunny attachment preserves original bytes"
        );
        check(
          (await request(result.file.url, { cookie: employeeCookie })).status,
          403,
          "employee cannot retrieve uploaded staff attachment"
        );
      } finally {
        if (livePath) {
          assert.ok(
            livePath.startsWith("portal-media/employee-attachments/") &&
              /^[a-f0-9-]+[.]txt$/.test(livePath.split("/").pop())
          );
          await storage.remove(livePath);
          console.log(
            "PASS temporary employee attachment removed after verification"
          );
        }
      }
    }
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
    check(
      (await request(attachmentsPath, { cookie: admin })).status,
      404,
      "archived employee attachments are no longer accessible"
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
