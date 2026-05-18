import { describe, it, expect } from "vitest";
import { z } from "zod";

// Inline schema matching app/api/submit/route.ts
const SubmissionSchema = z.object({
  name_latin: z.string().min(1).max(200),
  name_farsi: z.string().max(200).optional(),
  date_of_birth: z.string().max(50).optional(),
  date_of_death: z.string().max(50).optional(),
  place_of_death: z.string().max(200).optional(),
  province: z.string().max(100).optional(),
  cause_of_death: z.string().max(200).optional(),
  details: z.string().min(10).max(5000),
  sources: z.string().max(2000).optional(),
  submitter_email: z.string().email().max(254).optional().nullable(),
  submitter_name: z.string().max(200).optional().nullable(),
});

describe("SubmissionSchema", () => {
  it("accepts minimal valid submission (name + details)", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "Test Name",
      details: "At least ten characters long for validation.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts full valid submission with all fields", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "Mahsa Amini",
      name_farsi: "مهسا امینی",
      date_of_birth: "2000-09-21",
      date_of_death: "2022-09-16",
      place_of_death: "Tehran",
      province: "Tehran",
      cause_of_death: "Head injuries",
      details: "Died in morality police custody after detention.",
      sources: "https://example.com/report",
      submitter_email: "test@example.com",
      submitter_name: "John Doe",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null submitter_email", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "Test Name",
      details: "Valid details here more than ten chars.",
      submitter_email: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name_latin", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "",
      details: "Valid details here more than ten chars.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name_latin", () => {
    const result = SubmissionSchema.safeParse({
      details: "Valid details here more than ten chars.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects details shorter than 10 characters", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "Test Name",
      details: "Too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing details", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "Test Name",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name_latin exceeding 200 characters", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "x".repeat(201),
      details: "Valid details here more than ten chars.",
    });
    expect(result.success).toBe(false);
  });

  it("rejects details exceeding 5000 characters", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "Test Name",
      details: "x".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "Test Name",
      details: "Valid details here more than ten chars.",
      submitter_email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts details with exactly 10 characters", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "Test Name",
      details: "1234567890",
    });
    expect(result.success).toBe(true);
  });

  it("accepts name_latin with 1 character", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "A",
      details: "Valid details here more than ten chars.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid email", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "Test Name",
      details: "Valid details here more than ten chars.",
      submitter_email: "user@domain.org",
    });
    expect(result.success).toBe(true);
  });

  it("provides field-specific error messages on failure", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "",
      details: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      expect(flat.name_latin).toBeDefined();
      expect(flat.details).toBeDefined();
    }
  });

  it("rejects sources exceeding 2000 characters", () => {
    const result = SubmissionSchema.safeParse({
      name_latin: "Test Name",
      details: "Valid details here more than ten chars.",
      sources: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
