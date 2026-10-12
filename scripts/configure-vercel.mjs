import { spawn } from "node:child_process";

const target = process.argv[2] || "preview";
if (!["preview", "production"].includes(target))
  throw new Error("Unsupported deployment environment");
for (const name of [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
]) {
  if (!process.env[name]) throw new Error(`${name} missing`);
  await new Promise((resolve, reject) => {
    const child = spawn(
      "npx.cmd",
      [
        "--yes",
        "vercel@62.4.0",
        "env",
        "add",
        name,
        target,
        "--sensitive",
        "--yes",
        "--scope",
        "team_X0Q8jDTplrCZFyglK8C5QAer",
      ],
      { shell: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    child.stdin.end(process.env[name]);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        console.log(`${name}: ${target} configured`);
        resolve();
      } else {
        console.error(output.replaceAll(process.env[name], "[redacted]"));
        reject(new Error(`${name}: configuration failed`));
      }
    });
  });
}
