const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { MongoClient } = require("mongodb");
require("@next/env").loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
async function main() {
  const products = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/data/orderProducts.json"), "utf8"));
  if (!Array.isArray(products) || products.some(row => typeof row.name !== "string" || !row.name.trim() || row.name.length > 160 || typeof row.category !== "string")) throw Error("Invalid product catalog.");
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const name = process.env.MONGODB_DATABASE || process.env.MONGODB_DB_NAME || new URL(process.env.MONGODB_URI).pathname.slice(1).split("/")[0] || "taste_the_best";
    const collection = client.db(name).collection("products");
    await collection.createIndex({ catalogKey: 1 }, { unique: true, partialFilterExpression: { catalogKey: { $type: "string" } } });
    let inserted = 0;
    for (const product of products) {
      const catalogKey = createHash("sha256").update(product.name.toLowerCase()).digest("hex");
      const result = await collection.updateOne({ catalogKey }, { $setOnInsert: { ...product, catalogKey, removed: false, createdAt: new Date() } }, { upsert: true });
      inserted += result.upsertedCount;
    }
    console.log(JSON.stringify({ sourceProducts: products.length, inserted, existing: products.length - inserted }));
  } finally { await client.close(); }
}
main().catch(() => { console.error("Products could not be imported. Check the database configuration."); process.exitCode = 1; });
