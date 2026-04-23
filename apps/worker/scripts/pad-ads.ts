// Append 1 second of trailing silence to every ad mp3 in
// apps/web/public/ads/ (English) and apps/web/public/ads/es/ (Spanish).
// The player chains items immediately on `ended`, and Fish renders cut
// just close enough to the final word to clip the tail. A second of
// padding makes the transition land cleanly.

import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const DIRS = [
  "/app/apps/web/public/ads",
  "/app/apps/web/public/ads/es",
];

const TRAILING_SILENCE_SECONDS = 1;

async function runFfmpeg(args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (c) => (stderr += c.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(`ffmpeg exit ${code}: ${stderr.slice(-500) || "(no log)"}`),
        );
    });
  });
}

async function padOne(filePath: string): Promise<void> {
  const workDir = await mkdtemp(join(tmpdir(), "pad-ads-"));
  try {
    const inPath = join(workDir, "in.mp3");
    const outPath = join(workDir, "out.mp3");
    const buf = await readFile(filePath);
    await writeFile(inPath, buf);
    // apad=pad_dur=N appends N seconds of silence after the input ends.
    // Re-encode to a uniform 44.1 kHz mono 128 kbps mp3 — same canonical
    // form the worker uses for scene concat, so playback stays consistent.
    await runFfmpeg([
      "-y",
      "-i",
      inPath,
      "-af",
      `apad=pad_dur=${TRAILING_SILENCE_SECONDS}`,
      "-ar",
      "44100",
      "-ac",
      "1",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      outPath,
    ]);
    const padded = await readFile(outPath);
    // Atomic-ish swap via a sibling temp file in the same directory, so a
    // partial write can't leave a half-padded ad in place.
    const tmpDest = `${filePath}.padded.${Date.now()}.mp3`;
    await writeFile(tmpDest, padded);
    await rename(tmpDest, filePath);
    console.log(
      `[pad-ads]   ${filePath} (${(buf.length / 1024).toFixed(1)} KB → ${(padded.length / 1024).toFixed(1)} KB)`,
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  for (const dir of DIRS) {
    const entries = await readdir(dir);
    const ads = entries
      .filter((n) => /^ad-\d+\.mp3$/i.test(n))
      .sort();
    console.log(`[pad-ads] ${dir} — ${ads.length} ad(s)`);
    for (const name of ads) {
      await padOne(join(dir, name));
    }
  }
  console.log("[pad-ads] done");
}

main().catch((err) => {
  console.error("[pad-ads] failed:", err);
  process.exit(1);
});
