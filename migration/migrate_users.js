import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Create connections
const oldDb = await mysql.createConnection({
  host: process.env.OLD_DB_HOST,
  user: process.env.OLD_DB_USER,
  password: process.env.OLD_DB_PASSWORD,
  database: process.env.OLD_DB_NAME,
});

const newDb = await mysql.createConnection({
  host: process.env.NEW_DB_HOST,
  user: process.env.NEW_DB_USER,
  password: process.env.NEW_DB_PASSWORD,
  database: process.env.NEW_DB_NAME,
});

async function migrateUsers() {
  console.log("Migrating users...");

  const [rows] = await oldDb.query("SELECT id, username, password, email FROM mdl_user");

  for (const row of rows) {
    await newDb.execute(
      "INSERT INTO users (id, username, password, email) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE username = VALUES(username), email = VALUES(email), password = VALUES(password);",
      [row.id, row.username, row.password, row.email]
    );
  }

  console.log(`✅ Migrated ${rows.length} users`);
}

async function migrateCourses() {
  console.log("Migrating courses...");

  const [rows] = await oldDb.query("SELECT id, fullname, shortname FROM mdl_course");

  for (const row of rows) {
    await newDb.execute(
      "INSERT INTO courses (id, title, code) VALUES (?, ?, ?)",
      [row.id, row.fullname, row.shortname]
    );
  }

  console.log(`✅ Migrated ${rows.length} courses`);
}

async function main() {
  try {
    await migrateUsers();
    // await migrateCourses();
    console.log("🎉 Migration complete!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await oldDb.end();
    await newDb.end();
  }
}

main();
