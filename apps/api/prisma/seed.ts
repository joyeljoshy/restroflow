import "dotenv/config";

import { Argon2PasswordHasher } from "../src/modules/auth/auth.service.js";
import { createPrismaClient } from "../src/lib/prisma.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the seed script.");
}

const prisma = createPrismaClient(databaseUrl);

try {
  await prisma.$queryRaw`SELECT 1`;
  console.info("Database connection verified.");

  const seed = {
    email: process.env.ADMIN_SEED_EMAIL,
    password: process.env.ADMIN_SEED_PASSWORD,
    displayName: process.env.ADMIN_SEED_NAME,
    restaurantSlug: process.env.ADMIN_SEED_RESTAURANT_SLUG,
    restaurantName: process.env.ADMIN_SEED_RESTAURANT_NAME,
  };
  const suppliedValues = Object.values(seed).filter(Boolean).length;

  if (suppliedValues === 0) {
    console.info(
      "No admin seed variables supplied. Connectivity check completed without writes.",
    );
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error("The initial admin seed is disabled in production.");
    }
    if (suppliedValues !== Object.keys(seed).length) {
      throw new Error(
        "Set every ADMIN_SEED_* variable together to create the development admin.",
      );
    }

    const email = seed.email!.trim().toLowerCase();
    const password = seed.password!;
    const displayName = seed.displayName!.trim();
    const restaurantSlug = seed.restaurantSlug!.trim().toLowerCase();
    const restaurantName = seed.restaurantName!.trim();

    if (!email.includes("@") || password.length < 12) {
      throw new Error(
        "ADMIN_SEED_EMAIL must be an email and ADMIN_SEED_PASSWORD must contain at least 12 characters.",
      );
    }
    if (
      !displayName ||
      !restaurantName ||
      !/^[a-z0-9-]+$/.test(restaurantSlug)
    ) {
      throw new Error(
        "Admin and restaurant names are required; the restaurant slug may contain lowercase letters, numbers, and hyphens.",
      );
    }

    const passwordHash = await new Argon2PasswordHasher().hash(password);
    await prisma.$transaction(async (transaction) => {
      const restaurant = await transaction.restaurant.upsert({
        where: { slug: restaurantSlug },
        update: {},
        create: { slug: restaurantSlug, name: restaurantName },
      });
      const user = await transaction.user.upsert({
        where: { email },
        update: { displayName, passwordHash, isActive: true },
        create: { email, displayName, passwordHash },
      });
      await transaction.staffMembership.upsert({
        where: {
          userId_restaurantId: {
            userId: user.id,
            restaurantId: restaurant.id,
          },
        },
        update: { role: "ADMIN", isActive: true },
        create: {
          userId: user.id,
          restaurantId: restaurant.id,
          role: "ADMIN",
        },
      });
    });
    console.info(`Development admin prepared for ${email}.`);
  }
} finally {
  await prisma.$disconnect();
}
