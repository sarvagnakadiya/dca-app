const { PrismaClient } = require("@prisma/client");

async function checkDatabase() {
  console.log("Checking database connection...");

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is not set");
    return;
  }

  console.log("✅ DATABASE_URL is set");
  console.log(
    "Database URL:",
    process.env.DATABASE_URL.replace(/:[^:@]*@/, ":****@")
  ); // Hide password

  const prisma = new PrismaClient();

  try {
    console.log("🔍 Testing database connection...");

    // Test basic connection
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Database connection successful");

    // Test a simple query
    const userCount = await prisma.user.count();
    console.log(`✅ Database query successful. User count: ${userCount}`);

    // Test plan count
    const planCount = await prisma.dCAPlan.count();
    console.log(`✅ Plan count: ${planCount}`);
  } catch (error) {
    console.error("❌ Database connection failed:");
    console.error(error.message);

    if (error.message.includes("Can't reach database server")) {
      console.log("\n🔧 Possible solutions:");
      console.log("1. Check if your Neon database is active");
      console.log("2. Verify the DATABASE_URL is correct");
      console.log(
        "3. Check if your IP is whitelisted (if using IP restrictions)"
      );
      console.log(
        "4. Try connecting from the Neon console to verify the connection"
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase().catch(console.error);
