const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");
const root = join(__dirname, "..");
const files = ["server.js", ...["services", "scripts", "test"].flatMap(dir =>
  readdirSync(join(root, dir)).filter(file => file.endsWith(".js")).map(file => join(dir, file)))];
for (const file of files) execFileSync(process.execPath, ["--check", join(root, file)], { stdio: "inherit" });
console.log(`Syntax valid: ${files.length} JavaScript files`);
