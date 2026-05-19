function hasPgParts() {
  return !!(
    process.env.PGHOST &&
    process.env.PGUSER &&
    process.env.PGPASSWORD &&
    process.env.PGDATABASE
  );
}

export function getDatabaseUrl() {
  if (hasPgParts()) {
    const user = encodeURIComponent(process.env.PGUSER!);
    const password = encodeURIComponent(process.env.PGPASSWORD!);
    const host = process.env.PGHOST!;
    const port = process.env.PGPORT || "5432";
    const database = encodeURIComponent(process.env.PGDATABASE!);

    return `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=require`;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE must be set.",
    );
  }

  return process.env.DATABASE_URL;
}
