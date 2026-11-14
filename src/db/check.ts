import { pool } from "./index.js";

const result = await pool.query("select now()");
console.log("✅ Connected to Postgres:", result.rows[0]);
await pool.end();
