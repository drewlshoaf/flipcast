import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface SegmentAudio {
  index: number;
  buffer: Buffer;
  pauseMsAfter: number;
}

export async function stitchSegments(
  segments: SegmentAudio[],
): Promise<{ mp3: Buffer; durationMs: number }> {
  const workDir = await mkdtemp(join(tmpdir(), "flipcast-"));
  try {
    const concatParts: string[] = [];
    for (const seg of segments.sort((a, b) => a.index - b.index)) {
      const segPath = join(workDir, `seg-${seg.index}.mp3`);
      await writeFile(segPath, seg.buffer);
      concatParts.push(`file '${segPath}'`);
      if (seg.pauseMsAfter > 0) {
        const silencePath = join(workDir, `silence-${seg.index}.mp3`);
        await generateSilence(silencePath, seg.pauseMsAfter);
        concatParts.push(`file '${silencePath}'`);
      }
    }

    const listPath = join(workDir, "concat.txt");
    await writeFile(listPath, concatParts.join("\n"));

    const outPath = join(workDir, "final.mp3");
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "128k",
      outPath,
    ]);

    const mp3 = await readFile(outPath);
    const durationMs = await probeDurationMs(outPath);
    return { mp3, durationMs };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function generateSilence(path: string, ms: number): Promise<void> {
  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=24000:cl=mono`,
    "-t",
    (ms / 1000).toFixed(3),
    "-c:a",
    "libmp3lame",
    "-b:a",
    "128k",
    path,
  ]);
}

async function probeDurationMs(path: string): Promise<number> {
  return await new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      path,
    ]);
    let out = "";
    proc.stdout.on("data", (c) => (out += c.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exit ${code}`));
      const secs = Number(out.trim());
      if (!Number.isFinite(secs)) return reject(new Error("bad duration"));
      resolve(Math.round(secs * 1000));
    });
  });
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (c) => (stderr += c.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
    });
  });
}
