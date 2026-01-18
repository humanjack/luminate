import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the database module
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        orderBy: vi.fn(() => Promise.resolve([])),
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "test-id", name: "Test" }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: "test-id", name: "Updated" }])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  },
  projects: { id: "id", updatedAt: "updatedAt" },
}));

// Mock uuid
vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-123"),
}));

import { GET, POST } from "@/app/api/projects/route";
import { db } from "@/lib/db";

// Helper to create mock NextRequest
function createMockRequest(
  method: string,
  body?: any,
  url = "http://localhost:3000/api/projects"
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(url, init);
}

describe("Projects API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/projects", () => {
    it("should return list of projects", async () => {
      const mockProjects = [
        { id: "1", name: "Project 1", currentStep: 1, status: "draft" },
        { id: "2", name: "Project 2", currentStep: 3, status: "in_progress" },
      ];

      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockProjects),
        }),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockProjects);
    });

    it("should return empty array when no projects exist", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it("should return 500 on database error", async () => {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockRejectedValue(new Error("Database error")),
        }),
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch projects");

      consoleSpy.mockRestore();
    });
  });

  describe("POST /api/projects", () => {
    it("should create a new project with valid name", async () => {
      const mockProject = {
        id: "mock-uuid-123",
        name: "My New Project",
        currentStep: 1,
        status: "draft",
      };

      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockProject]),
        }),
      });

      const request = createMockRequest("POST", { name: "My New Project" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe("My New Project");
      expect(data.id).toBe("mock-uuid-123");
    });

    it("should return 400 when name is missing", async () => {
      const request = createMockRequest("POST", {});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Project name is required");
    });

    it("should return 400 when name is empty string", async () => {
      const request = createMockRequest("POST", { name: "" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Project name is required");
    });

    it("should return 500 on database error", async () => {
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error("Insert failed")),
        }),
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const request = createMockRequest("POST", { name: "Test" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to create project");

      consoleSpy.mockRestore();
    });

    it("should set default values for new project", async () => {
      let insertedValues: any;

      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          insertedValues = vals;
          return {
            returning: vi.fn().mockResolvedValue([vals]),
          };
        }),
      });

      const request = createMockRequest("POST", { name: "Test Project" });
      await POST(request);

      expect(insertedValues.currentStep).toBe(1);
      expect(insertedValues.status).toBe("draft");
      expect(insertedValues.createdAt).toBeInstanceOf(Date);
      expect(insertedValues.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("workflow data saving scenarios", () => {
    it("should handle sequential saves for workflow progression", async () => {
      // This test verifies the API would handle saving workflow data correctly
      // In actual implementation, each step would call its respective endpoint

      const mockProject = {
        id: "workflow-test-id",
        name: "Workflow Test",
        currentStep: 1,
        status: "draft",
      };

      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockProject]),
        }),
      });

      // Create project
      const createRequest = createMockRequest("POST", { name: "Workflow Test" });
      const createResponse = await POST(createRequest);
      expect(createResponse.status).toBe(201);

      // Verify project can be created for workflow
      const data = await createResponse.json();
      expect(data.currentStep).toBe(1);
    });

    it("should validate project name for workflow creation", async () => {
      // Test that workflow projects require valid names
      const invalidRequests = [
        { name: "" },
        { name: "   " },
        {},
      ];

      for (const body of invalidRequests) {
        const request = createMockRequest("POST", body);
        const response = await POST(request);
        expect(response.status).toBe(400);
      }
    });
  });
});
