import { describe, it, expect } from "vitest";
import { parseSkillFrontmatter, parseSkillBody, validateSkillContent } from "./parser";

describe("parseSkillFrontmatter", () => {
  it("extracts name and description from frontmatter", () => {
    const content = `---
name: deep-research
description: Multi-source research
category: Research
---

# Deep Research`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe("deep-research");
    expect(result.description).toBe("Multi-source research");
    expect(result.category).toBe("Research");
  });

  it("extracts domains array for site playbooks", () => {
    const content = `---
domains: ["amazon.com", "amazon.co.uk"]
platform: amazon
---

# Amazon Navigation`;

    const result = parseSkillFrontmatter(content);
    expect(result.domains).toEqual(["amazon.com", "amazon.co.uk"]);
    expect(result.platform).toBe("amazon");
  });

  it("returns empty strings for missing required fields", () => {
    const content = `---
category: Test
---

# No name or description`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe("");
    expect(result.description).toBe("");
    expect(result.category).toBe("Test");
  });

  it("returns undefined for missing optional fields", () => {
    const content = `---
name: minimal
description: A minimal skill
---

# Minimal`;

    const result = parseSkillFrontmatter(content);
    expect(result.category).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.domains).toBeUndefined();
    expect(result.platform).toBeUndefined();
  });

  it("handles content with no frontmatter", () => {
    const content = `# Just markdown, no frontmatter`;
    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe("");
    expect(result.description).toBe("");
  });

  it("coerces non-string domains to strings", () => {
    const content = `---
domains: [123, true]
---
body`;

    const result = parseSkillFrontmatter(content);
    expect(result.domains).toEqual(["123", "true"]);
  });
});

describe("parseSkillBody", () => {
  it("extracts body content without frontmatter", () => {
    const content = `---
name: test
description: test skill
---

# Test Skill

Some body content here.`;

    const body = parseSkillBody(content);
    expect(body).toBe("# Test Skill\n\nSome body content here.");
  });

  it("returns full content when no frontmatter", () => {
    const content = `# No Frontmatter

Just body text.`;

    const body = parseSkillBody(content);
    expect(body).toBe("# No Frontmatter\n\nJust body text.");
  });

  it("trims whitespace from body", () => {
    const content = `---
name: test
---

  Body with whitespace

`;

    const body = parseSkillBody(content);
    expect(body).toBe("Body with whitespace");
  });

  it("handles empty body after frontmatter", () => {
    const content = `---
name: empty
description: nothing
---`;

    const body = parseSkillBody(content);
    expect(body).toBe("");
  });
});

describe("validateSkillContent", () => {
  it("validates a correct SKILL.md", () => {
    const content = `---\nname: test-skill\ndescription: A test skill\n---\n\n# Test\n\nDo the thing.`;
    const result = validateSkillContent(content);
    expect(result.valid).toBe(true);
    expect(result.slug).toBe("test-skill");
    expect(result.errors).toEqual([]);
  });

  it("rejects missing name", () => {
    const content = `---\ndescription: No name\n---\n\n# Body`;
    const result = validateSkillContent(content);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: name");
  });

  it("rejects missing description", () => {
    const content = `---\nname: no-desc\n---\n\n# Body`;
    const result = validateSkillContent(content);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: description");
  });

  it("rejects empty body", () => {
    const content = `---\nname: empty\ndescription: Has frontmatter\n---`;
    const result = validateSkillContent(content);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Empty body (no content after frontmatter)");
  });

  it("slugifies names with spaces", () => {
    const content = `---\nname: My Cool Skill\ndescription: Test\n---\n\n# Content`;
    const result = validateSkillContent(content);
    expect(result.valid).toBe(true);
    expect(result.slug).toBe("my-cool-skill");
  });

  it("handles no frontmatter", () => {
    const result = validateSkillContent("# Just markdown");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: name");
    expect(result.errors).toContain("Missing required field: description");
  });
});
