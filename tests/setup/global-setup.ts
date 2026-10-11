import fs from "fs";
import path from "path";

/**
 * Test isolation: every run works on a copy of the seeded database
 * (data/applyswipe.test.json) so tests never mutate the developer's data store
 * and never touch PostgreSQL.
 */
export default function globalSetup() {
  const root = process.cwd();
  const source = path.join(root, "data", "applyswipe.json");
  const target = path.join(root, "data", "applyswipe.test.json");

  if (!fs.existsSync(source)) {
    // Fall back to an empty database: tests create the records they need.
    fs.writeFileSync(target, JSON.stringify({}, null, 2), "utf-8");
    return;
  }

  fs.copyFileSync(source, target);
}
