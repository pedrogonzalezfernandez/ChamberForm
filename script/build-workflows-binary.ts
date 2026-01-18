import { rm, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { spawn } from "child_process";
import path from "path";

function run(cmd: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`));
    });
    proc.on("error", reject);
  });
}

async function main() {
  const python = process.env.PYTHON_BIN || "python3";
  const distDir = path.resolve("dist", "workflows-bin");
  const workDir = path.resolve("server", "python");

  if (!existsSync(path.join(workDir, "workflows.py"))) {
    throw new Error("workflows.py not found; expected at server/python/workflows.py");
  }

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  // Ensure pyinstaller is present
  await run(python, ["-m", "PyInstaller", "--version"], workDir);

  await run(
    python,
    [
      "-m",
      "PyInstaller",
      "--onefile",
      "--name",
      "workflows",
      "--distpath",
      distDir,
      "--workpath",
      path.join(workDir, ".pyi-build"),
      "--specpath",
      path.join(workDir, ".pyi-spec"),
      "workflows.py",
    ],
    workDir,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
