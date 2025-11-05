import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

const FFMPEG_CORE_VERSION = '0.12.6';
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

// Helper to fetch files and report progress
async function fetchWithProgress(url: string, onProgress: (loaded: number) => void): Promise<Response> {
    const response = await fetch(url);
    if (!response.body) {
        throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    let loaded = 0;

    const stream = new ReadableStream({
        async start(controller) {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                loaded += value.length;
                onProgress(loaded);
                controller.enqueue(value);
            }
            controller.close();
        },
    });

    return new Response(stream);
}

export async function loadFfmpeg(onProgress: (progress: number) => void): Promise<void> {
  if (ffmpeg && ffmpeg.loaded) {
    onProgress(100);
    return;
  }
  
  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log(message);
  });

  const CORE_JS_SIZE = 185000;
  const CORE_WASM_SIZE = 32500000;
  const TOTAL_SIZE = CORE_JS_SIZE + CORE_WASM_SIZE;

  const coreJsUrl = `${BASE_URL}/ffmpeg-core.js`;
  const wasmUrl = `${BASE_URL}/ffmpeg-core.wasm`;

  let coreJsLoaded = 0;
  let wasmLoaded = 0;

  const updateProgress = () => {
      const totalLoaded = coreJsLoaded + wasmLoaded;
      const percentage = Math.round((totalLoaded / TOTAL_SIZE) * 100);
      onProgress(Math.min(100, percentage));
  };
  
  const [coreJsBlob, wasmBlob] = await Promise.all([
      fetchWithProgress(coreJsUrl, (loaded) => {
          coreJsLoaded = loaded;
          updateProgress();
      }).then(res => res.blob()),
      fetchWithProgress(wasmUrl, (loaded) => {
          wasmLoaded = loaded;
          updateProgress();
      }).then(res => res.blob()),
  ]);
  
  await ffmpeg.load({
      coreURL: URL.createObjectURL(coreJsBlob),
      wasmURL: URL.createObjectURL(wasmBlob),
  });
}

export async function compressVideo(
  videoFile: File,
  duration: number,
  onProgress: (details: { percentage: number; processedBytes: number }) => void
): Promise<Blob> {
  if (!ffmpeg || !ffmpeg.loaded) {
    throw new Error('FFMPEG is not loaded.');
  }

  ffmpeg.on('progress', ({ time }) => {
    if (duration > 0) {
      const percentage = Math.round((time / duration) * 100);
      const processedBytes = Math.min(videoFile.size, (time / duration) * videoFile.size);
      onProgress({
        percentage: Math.min(100, percentage),
        processedBytes,
      });
    }
  });

  const inputFileName = 'input.mp4';
  const outputFileName = 'output.mp4';

  await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

  const command = [
    '-i', inputFileName,
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '23',
    '-vf', 'scale=-2:720',
    '-c:a', 'aac',
    '-b:a', '128k',
    outputFileName,
  ];
  
  await ffmpeg.exec(command);
  
  const data = await ffmpeg.readFile(outputFileName);

  return new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
}