const { loadEnvConfig } = require("@next/env");
const { MongoClient, ObjectId } = require("mongodb");
const { createInterface } = require("node:readline/promises");
const { Writable } = require("node:stream");
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
async function main() {
  if (!process.stdin.isTTY)
    throw Error("Run this command in an interactive terminal.");
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  let rl;
  try {
    await client.connect();
    const name =
      process.env.MONGODB_DATABASE ||
      process.env.MONGODB_DB_NAME ||
      new URL(process.env.MONGODB_URI).pathname.slice(1).split("/")[0] ||
      "taste_the_best";
    const db = client.db(name);
    if (await db.collection("portal_users").countDocuments())
      throw Error(
        "Accounts already exist. An existing admin must create additional accounts."
      );
    let muted = false;
    const output = new Writable({
      write(chunk, encoding, done) {
        if (!muted) process.stdout.write(chunk);
        done();
      },
    });
    rl = createInterface({ input: process.stdin, output, terminal: true });
    const fullName = await rl.question("Your full name: ");
    const username = (await rl.question("Admin username: "))
      .trim()
      .toLowerCase();
    process.stdout.write("Admin password (12–128 characters, hidden): ");
    muted = true;
    const password = await rl.question("");
    muted = false;
    process.stdout.write("\nConfirm password (hidden): ");
    muted = true;
    const confirmation = await rl.question("");
    muted = false;
    process.stdout.write("\n");
    if (password !== confirmation) throw Error("Passwords do not match.");
    const { validateUser } = await import("../src/data/userHelpers.mjs");
    const { hashPassword } = await import("../src/lib/authCore.mjs");
    const error = validateUser(
      { name: fullName, username, password, role: "Admin" },
      []
    );
    if (error) throw Error(error);
    if (fullName.length > 120) throw Error("Name is too long.");
    await db
      .collection("portal_users")
      .createIndex({ username: 1 }, { unique: true });
    const result = await db
      .collection("portal_users")
      .insertOne({
        _id: new ObjectId("000000000000000000000001"),
        name: fullName.trim(),
        username,
        role: "Admin",
        branchId: "",
        removed: false,
        authVersion: 1,
        credentials: await hashPassword(password),
        createdAt: new Date(),
      });
    await db
      .collection("portal_audit")
      .insertOne({
        actorId: result.insertedId,
        targetId: result.insertedId,
        action: "bootstrap-admin",
        at: new Date(),
      });
    console.log("Admin account created. You can now sign in to the website.");
  } finally {
    rl?.close();
    await client.close();
  }
}
main().catch(() => {
  console.error(
    "Admin setup could not complete. Check your entries, database connection and whether an admin already exists."
  );
  process.exitCode = 1;
});
