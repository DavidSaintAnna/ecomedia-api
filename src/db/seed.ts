import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "./index.js";
import { categories, users } from "./schema.js";

const categoryData = [
  {
    name: "Recycling",
    description: "Sorting, reusing and recycling materials",
  },
  {
    name: "Urban Gardening",
    description: "Community gardens, rooftops and balcony plants",
  },
  { name: "Mobility", description: "Cycling, walking and public transport" },
  { name: "Energy", description: "Saving energy and using clean sources" },
  { name: "Water", description: "Saving, reusing and protecting water" },
  {
    name: "Waste Reduction",
    description: "Using less, composting and avoiding single-use items",
  },
  {
    name: "Community Cleanup",
    description: "Neighborhood and beach cleanup actions",
  },
];

const adminEmail = (
  process.env.ADMIN_EMAIL ?? "admin@ecomedia.dev"
).toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin12345";

await db.insert(categories).values(categoryData).onConflictDoNothing();
console.log(`✅ Categories ready (${categoryData.length})`);

const [existing] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, adminEmail));
if (existing) {
  console.log(`ℹ️  Admin already exists: ${adminEmail}`);
} else {
  await db.insert(users).values({
    name: "EcoMedia Admin",
    email: adminEmail,
    passwordHash: await bcrypt.hash(adminPassword, 10),
    role: "ADMIN",
    city: "Aracaju",
  });
  console.log(`✅ Admin created: ${adminEmail}`);
}

await pool.end();
