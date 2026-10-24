const fs = require("fs");
const { MongoClient } = require("mongodb");
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
async function main() {
  const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const { validFinancialValues, validFinancialWeek } = await import(
    "../src/data/financialSummary.mjs"
  );
  if (
    input.branch !== "Meadowhall" ||
    !Array.isArray(input.records) ||
    !input.records.every(
      (row) =>
        validFinancialWeek(row.week) &&
        validFinancialValues(row) &&
        row.source?.sha256 === input.sourceHash
    )
  )
    throw Error("Invalid source");
  const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  try {
    await client.connect();
    const name =
      process.env.MONGODB_DATABASE ||
      process.env.MONGODB_DB_NAME ||
      new URL(process.env.MONGODB_URI).pathname.slice(1).split("/")[0] ||
      "taste_the_best";
    const db = client.db(name);
    const branch = await db
      .collection("branches")
      .findOne({ name: "Meadowhall" });
    if (!branch) throw Error("Meadowhall branch missing");
    const branchId = String(branch._id);
    const collection = db.collection("weekly_financial_summaries");
    await collection.createIndex(
      { branchId: 1, week: 1 },
      { unique: true, name: "financial_branch_week" }
    );
    let inserted = 0,
      preserved = 0;
    for (const row of input.records) {
      const now = new Date();
      const result = await collection.updateOne(
        { branchId, week: row.week },
        {
          $setOnInsert: {
            ...row,
            branchId,
            branchName: branch.name,
            revision: 1,
            createdAt: now,
            updatedAt: now,
            importedAt: now,
          },
        },
        { upsert: true }
      );
      inserted += result.upsertedCount;
      preserved += result.matchedCount;
    }
    const stored = await collection
      .find({ branchId, "source.sha256": input.sourceHash })
      .toArray();
    const keys = [
      "totalSaleCents",
      "expensesCents",
      "goodsCents",
      "rentCents",
      "profitLossCents",
    ];
    const unchanged = stored.every(
      (row) =>
        row.updatedBy ||
        keys.every(
          (key) =>
            row[key] ===
            input.records.find((source) => source.week === row.week)?.[key]
        )
    );
    console.log(
      JSON.stringify({
        inserted,
        existingPreserved: preserved,
        verifiedImportedWeeks: stored.length,
        sourceValuesMatch: unchanged,
      })
    );
    if (!unchanged) process.exitCode = 2;
  } finally {
    await client.close();
  }
}
main().catch(() => {
  console.error(
    "Financial import did not complete. Existing records were not overwritten; no credentials were displayed."
  );
  process.exitCode = 1;
});
