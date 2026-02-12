import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, projects, pages, InsertProject, InsertPage, Project, Page } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Project helpers
export async function createProject(data: InsertProject): Promise<Project> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(projects).values(data);
  const insertId = Number(result[0].insertId);
  
  const created = await db.select().from(projects).where(eq(projects.id, insertId)).limit(1);
  if (!created[0]) {
    throw new Error("Failed to retrieve created project");
  }
  
  return created[0];
}

export async function getProjectById(projectId: number): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return result[0];
}

export async function getProjectsByUserId(userId: number): Promise<Project[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
}

export async function updateProject(projectId: number, data: Partial<InsertProject>): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(projects).set(data).where(eq(projects.id, projectId));
}

export async function deleteProject(projectId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Delete all pages first
  await db.delete(pages).where(eq(pages.projectId, projectId));
  // Then delete the project
  await db.delete(projects).where(eq(projects.id, projectId));
}

// Page helpers
export async function createPage(data: InsertPage): Promise<Page> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(pages).values(data);
  const insertId = Number(result[0].insertId);
  
  const created = await db.select().from(pages).where(eq(pages.id, insertId)).limit(1);
  if (!created[0]) {
    throw new Error("Failed to retrieve created page");
  }
  
  // Update project counts
  await updateProjectPageCounts(data.projectId);
  
  return created[0];
}

export async function getPageById(pageId: number): Promise<Page | undefined> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
  return result[0];
}

export async function getPagesByProjectId(projectId: number): Promise<Page[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db.select().from(pages).where(eq(pages.projectId, projectId)).orderBy(pages.sortOrder);
}

export async function updatePage(pageId: number, data: Partial<InsertPage>): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(pages).set(data).where(eq(pages.id, pageId));
}

export async function deletePage(pageId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.delete(pages).where(eq(pages.id, pageId));
}

export async function updatePageStatus(pageId: number, status: "pending" | "processing" | "completed" | "failed", errorMessage?: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const updateData: Partial<InsertPage> = { status };
  if (errorMessage) {
    updateData.errorMessage = errorMessage;
  }

  await db.update(pages).set(updateData).where(eq(pages.id, pageId));
  
  // Update project counts
  const page = await getPageById(pageId);
  if (page) {
    await updateProjectPageCounts(page.projectId);
  }
}

export async function updateProjectPageCounts(projectId: number): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const allPages = await db.select().from(pages).where(eq(pages.projectId, projectId));
  const totalPages = allPages.length;
  const processedPages = allPages.filter(p => p.status === "completed").length;

  await db.update(projects).set({ totalPages, processedPages }).where(eq(projects.id, projectId));
}
