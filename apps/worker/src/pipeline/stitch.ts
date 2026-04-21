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
    // Collect every concatenable input (TTS segment and silence) in playback
    // order. We pass them as separate -i files to ffmpeg, then stitch with
    // the concat filter. This decodes + resamples each input to canonical
    // params before encoding, which tolerates format drift between providers
    // (e.g. Fish Audio vs ElevenLabs outputs) that the concat *demuxer*
    // cannot — that mismatch was producing sporadic "libmp3lame exit -22
    // (Invalid argument)" finalization failures.
    const inputFiles: string[] = [];
    for (const seg of segments.sort((a, b) => a.index - b.index)) {
      const segPath = join(workDir, `seg-${seg.index}.mp3`);
      await writeFile(segPath, seg.buffer);
      inputFiles.push(segPath);
      if (seg.pauseMsAfter > 0) {
        const silencePath = join(workDir, `silence-${seg.index}.mp3`);
        await generateSilence(silencePath, seg.pauseMsAfter);
        inputFiles.push(silencePath);
      }
    }

    const outPath = join(workDir, "final.mp3");
    const inputArgs = inputFiles.flatMap((p) => ["-i", p]);
    // [0:a][1:a]...concat=n=N:v=0:a=1[out]
    const filterComplex =
      inputFiles.map((_, i) => `[${i}:a]`).join("") +
      `concat=n=${inputFiles.length}:v=0:a=1[out]`;

    await runFfmpeg([
      "-y",
      ...inputArgs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[out]",
      "-ar",
      String(OUTPUT_SAMPLE_RATE),
      "-ac",
      String(OUTPUT_CHANNELS),
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
