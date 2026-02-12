import { drizzle } from 'drizzle-orm/mysql2';
import { eq, desc } from 'drizzle-orm';
import { projects } from './drizzle/schema.ts';

const db = drizzle(process.env.DATABASE_URL);

// Simulate what the API does
const result = await db.select().from(projects).where(eq(projects.userId, 1)).orderBy(desc(projects.createdAt));

console.log('First 3 projects:');
result.slice(0, 3).forEach(p => {
  console.log(`ID: ${p.id}, Title: ${p.title}, Total: ${p.totalPages}, Processed: ${p.processedPages}`);
});
