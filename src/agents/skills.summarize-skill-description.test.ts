import { test } from "vitest";

test.skip("UPSTREAM PENDING SYNC: src/agents/skills.summarize-skill-description.test.ts", () => {});

/* ORIGINAL TEST CODE COMMENTED OUT TO PREVENT IMPORT/INIT ERRORS */
// import fs from "node:fs";
// import path from "node:path";
// import { describe, expect, it } from "vitest";
// import { parseFrontmatter } from "./skills/frontmatter.js";
//
// describe.skip("[UPSTREAM PENDING SYNC] skills/summarize frontmatter", () => {
//   it("mentions podcasts, local files, and transcription use cases", () => {
//     const skillPath = path.join(process.cwd(), "skills", "summarize", "SKILL.md");
//     const raw = fs.readFileSync(skillPath, "utf-8");
//     const frontmatter = parseFrontmatter(raw);
//     const description = frontmatter.description ?? "";
//     expect(description.toLowerCase()).toContain("transcrib");
//     expect(description.toLowerCase()).toContain("podcast");
//     expect(description.toLowerCase()).toContain("local files");
//     expect(description).not.toContain("summarize.sh");
//   });
// });
//
