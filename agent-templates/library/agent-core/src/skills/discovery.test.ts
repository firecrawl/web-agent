import { describe, it, expect } from "vitest";
import { discoverSkills, buildDomainIndex, getDefaultSkillsDir } from "./discovery";
import fs from "fs/promises";

describe("getDefaultSkillsDir", () => {
  it("returns a path that exists", async () => {
    const dir = getDefaultSkillsDir();
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("contains built-in skill definitions", async () => {
    const dir = getDefaultSkillsDir();
    const entries = await fs.readdir(dir);
    expect(entries).toContain("deep-research");
    expect(entries).toContain("e-commerce");
    expect(entries).toContain("structured-extraction");
  });
});

describe("discoverSkills", () => {
  it("discovers built-in skills", async () => {
    const skills = await discoverSkills();
    expect(skills.length).toBeGreaterThan(0);

    const names = skills.map((s) => s.name);
    expect(names).toContain("deep-research");
    expect(names).toContain("e-commerce");
  });

  it("returns skill metadata with required fields", async () => {
    const skills = await discoverSkills();
    const deepResearch = skills.find((s) => s.name === "deep-research");

    expect(deepResearch).toBeDefined();
    expect(deepResearch!.description).toBeTruthy();
    expect(deepResearch!.category).toBe("Research");
    expect(deepResearch!.directory).toContain("deep-research");
  });

  it("returns skills without site playbooks when none exist", async () => {
    const skills = await discoverSkills();
    const ecommerce = skills.find((s) => s.name === "e-commerce");

    expect(ecommerce).toBeDefined();
    // site playbooks are optional — e-commerce skill currently has none
    expect(ecommerce!.sitePlaybooks ?? []).toEqual([]);
  });

  it("returns empty array for nonexistent directory", async () => {
    const skills = await discoverSkills("/nonexistent/path");
    expect(skills).toEqual([]);
  });

  it("returns empty array for directory with no valid skills", async () => {
    const skills = await discoverSkills("/tmp");
    expect(skills).toEqual([]);
  });
});

describe("buildDomainIndex", () => {
  it("returns empty map when no skills have playbooks", async () => {
    const skills = await discoverSkills();
    const index = buildDomainIndex(skills);

    // no built-in skills currently have site playbooks
    expect(index.size).toBe(0);
  });

  it("returns empty map for skills without playbooks", () => {
    const index = buildDomainIndex([
      {
        name: "no-playbooks",
        description: "test",
        directory: "/tmp",
        resources: [],
      },
    ]);
    expect(index.size).toBe(0);
  });
});
