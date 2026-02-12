import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("projects router", () => {
  it("should create a new project", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      title: "Test Book Project",
      description: "A test project for book conversion",
    });

    expect(project).toBeDefined();
    expect(project.title).toBe("Test Book Project");
    expect(project.description).toBe("A test project for book conversion");
    expect(project.userId).toBe(ctx.user!.id);
    expect(project.status).toBe("uploading");
    expect(project.totalPages).toBe(0);
    expect(project.processedPages).toBe(0);
  });

  it("should list projects for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a test project first
    await caller.projects.create({
      title: "Test Project 1",
    });

    const projects = await caller.projects.list();

    expect(projects).toBeDefined();
    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0].userId).toBe(ctx.user!.id);
  });

  it("should get a specific project with pages", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a test project
    const project = await caller.projects.create({
      title: "Test Project for Get",
    });

    const result = await caller.projects.get({
      projectId: project.id,
    });

    expect(result).toBeDefined();
    expect(result.project).toBeDefined();
    expect(result.project.id).toBe(project.id);
    expect(result.pages).toBeDefined();
    expect(Array.isArray(result.pages)).toBe(true);
  });

  it("should update project status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      title: "Test Project for Status Update",
    });

    const result = await caller.projects.updateStatus({
      projectId: project.id,
      status: "processing",
    });

    expect(result.success).toBe(true);

    const updated = await caller.projects.get({
      projectId: project.id,
    });

    expect(updated.project.status).toBe("processing");
  });

  it("should delete a project", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const project = await caller.projects.create({
      title: "Test Project to Delete",
    });

    const result = await caller.projects.delete({
      projectId: project.id,
    });

    expect(result.success).toBe(true);

    // Verify project is deleted
    await expect(
      caller.projects.get({
        projectId: project.id,
      })
    ).rejects.toThrow("Project not found");
  });

  it("should reject access to other user's project", async () => {
    const ctx1 = createAuthContext();
    const caller1 = appRouter.createCaller(ctx1);

    const project = await caller1.projects.create({
      title: "User 1 Project",
    });

    // Create a different user context
    const ctx2 = createAuthContext();
    ctx2.user!.id = 999;
    ctx2.user!.openId = "different-user";
    const caller2 = appRouter.createCaller(ctx2);

    // Try to access user 1's project as user 2
    await expect(
      caller2.projects.get({
        projectId: project.id,
      })
    ).rejects.toThrow("Unauthorized");
  });
});
