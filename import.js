import fs from "fs";
import { parse } from "csv-parse";
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();
// Neon connection string
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});



async function importCSV() {
  try {
    // await createTable();

    const stream = fs
      .createReadStream("./meals.csv")
      .pipe(parse({ columns: true, trim: true }));

    for await (const row of stream) {
      // Convert types
      const available = row.available.toLowerCase() === "true";
      const macros = row.macros ? JSON.parse(row.macros) : null;
      const createdAt = row.createdAt ? new Date(row.createdAt) : null;
      const updatedAt = row.updatedAt ? new Date(row.updatedAt) : null;
      const price = row.price ? parseFloat(row.price) : 0;

      await pool.query(
        `INSERT INTO "Meal"
        (id,name,description,type,available,stock,ingredients,macros,photo,category,"createdAt","updatedAt",price)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.name,
          row.description || null,
          row.type,
          available,
          row.stock || null,
          row.ingredients || null,
          macros,
          row.photo || null,
          row.category || null,
          createdAt,
          updatedAt,
          price,
        ]
      );
    }

    console.log("✅ CSV Imported Successfully!");
  } catch (err) {
    console.error("❌ Error importing CSV:", err);
  } finally {
    await pool.end();
  }
}

importCSV();
