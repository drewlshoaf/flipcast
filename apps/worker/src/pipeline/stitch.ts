import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface SegmentAudio {
  index: number;
  buffer: Buffer;
  pauseMsAfter: number;
}

// Canonical output format. Every segment (TTS + silence) is resampled and
// re-channeled to these params via the concat filter, so libmp3lame sees a
// single consistent stream at the end.
const OUTPUT_SAMPLE_RATE = 44100;
const OUTPUT_CHANNELS = 1;

export async function stitchSegments(
  segments: SegmentAudio[],
): Promise<{ mp3: Buffer; durationMs: number }> {
  const workDir = await mkdtemp(join(tmpdir(), "flipcast-"));
  try {
    // Two-pass stitch to work around libmp3lame's "-22 (Invalid argument) /
    // 4 frames left in the queue on closing" on complex filter-graph output:
    //   Pass 1: for each input (TTS segment and silence), run a standalone
    //           ffmpeg call that decodes and re-encodes to canonical
    //           44.1kHz/mono mp3. Each call is a clean single-input encode
    //           that libmp3lame finalizes reliably.
    //   Pass 2: concat demuxer with -c copy — pure frame-level splicing of
    //           the (now identically-formatted) normalized mp3s. libmp3lame
    //           isn't invoked, so no finalization failure is possible.
    const normalized: string[] = [];
    let i = 0;
    for (const seg of segments.sort((a, b) => a.index - b.index)) {
      const rawPath = join(workDir, `raw-${seg.index}.mp3`);
      await writeFile(rawPath, seg.buffer);
      normalized.push(await normalizeToCanonical(rawPath, workDir, i++));
      if (seg.pauseMsAfter > 0) {
        const silenceRaw = join(workDir, `silence-raw-${seg.index}.mp3`);
        await generateSilence(silenceRaw, seg.pauseMsAfter);
        normalized.push(await normalizeToCanonical(silenceRaw, workDir, i++));
      }
    }

    const listPath = join(workDir, "concat.txt");
    await writeFile(
      listPath,
      normalized.map((p) => `file '${p}'`).join("\n"),
    );

    const outPath = join(workDir, "final.mp3");
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c",
      "copy",
      outPath,
    ]);

    const mp3 = await readFile(outPath);
    const durationMs = await probeDurationMs(outPath);
    return { mp3, durationMs };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function normalizeToCanonical(
  srcPath: string,
  workDir: string,
  index: number,
): Promise<string> {
  const outPath = join(workDir, `norm-${index}.mp3`);
  await runFfmpeg([
    "-y",
    "-i",
    srcPath,
    "-ar",
    String(OUTPUT_SAMPLE_RATE),
    "-ac",
    String(OUTPUT_CHANNELS),
    "-c:a",
    "libmp3lame",
    "-b:a",
    "128k",
    outPath,
  ]);
  return outPath;
}

async function generateSilence(path: string, ms: number): Promise<void> {
  // Matches OUTPUT_SAMPLE_RATE / OUTPUT_CHANNELS so the concat filter has
  // nothing to resample for silence in the happy case.
  await runFfmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=${OUTPUT_SAMPLE_RATE}:cl=mono`,
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
