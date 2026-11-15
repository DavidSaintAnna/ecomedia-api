import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "./index.js";
import { categories, users } from "./schema.js";

// `antigo` = nome em inglês de versões anteriores do seed. Se existir, é renomeado em vez de duplicado.
const categoryData = [
  {
    name: "Reciclagem",
    antigo: "Recycling",
    description: "Separação, reaproveitamento e reciclagem de materiais",
  },
  {
    name: "Hortas Urbanas",
    antigo: "Urban Gardening",
    description: "Hortas comunitárias, telhados verdes e plantas na varanda",
  },
  {
    name: "Mobilidade",
    antigo: "Mobility",
    description: "Bicicleta, caminhada e transporte público",
  },
  {
    name: "Energia",
    antigo: "Energy",
    description: "Economia de energia e uso de fontes limpas",
  },
  {
    name: "Água",
    antigo: "Water",
    description: "Economia, reúso e proteção da água",
  },
  {
    name: "Redução de Resíduos",
    antigo: "Waste Reduction",
    description: "Consumir menos, compostagem e evitar descartáveis",
  },
  {
    name: "Mutirão de Limpeza",
    antigo: "Community Cleanup",
    description: "Ações de limpeza em bairros e praias",
  },
];

const adminEmail = (
  process.env.ADMIN_EMAIL ?? "admin@ecomedia.dev"
).toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin12345";

// Pode ser executado várias vezes sem duplicar nada
for (const { name, antigo, description } of categoryData) {
  const [jaExiste] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, name));
  if (jaExiste) continue;
  const [antiga] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, antigo));
  if (antiga) {
    await db
      .update(categories)
      .set({ name, description })
      .where(eq(categories.id, antiga.id));
  } else {
    await db.insert(categories).values({ name, description });
  }
}
console.log(`✅ Categorias prontas (${categoryData.length})`);

const [existing] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, adminEmail));
if (existing) {
  console.log(`ℹ️  Administrador já existe: ${adminEmail}`);
} else {
  await db.insert(users).values({
    name: "Administrador EcoMedia",
    email: adminEmail,
    passwordHash: await bcrypt.hash(adminPassword, 10),
    role: "ADMIN",
    city: "Aracaju",
  });
  console.log(`✅ Administrador criado: ${adminEmail}`);
}

await pool.end();
