import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

const FFMPEG_CORE_VERSION = '0.12.6';
const BASE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

export async function loadFfmpeg(): Promise<void> {
  if (ffmpeg && ffmpeg.loaded) {
    return;
  }
  
  ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    console.log(message);
  });
  
  await ffmpeg.load({
      coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
}

export async function compressVideo(
  videoFile: File,
  onProgress: (details: { percentage: number; processedBytes: number }) => void
): Promise<Blob> {
  if (!ffmpeg || !ffmpeg.loaded) {
    throw new Error('FFMPEG is not loaded.');
  }

  const progressListener = ({ progress }) => {
    // The progress property from ffmpeg is a ratio from 0 to 1.
    const percentage = Math.round(Math.min(progress, 1) * 100);
    const processedBytes = Math.min(videoFile.size, Math.min(progress, 1) * videoFile.size);
    onProgress({
        percentage,
        processedBytes,
    });
  };

  ffmpeg.on('progress', progressListener);

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
  
  try {
    await ffmpeg.exec(command);
  } finally {
    // Clean up the listener to prevent memory leaks
    ffmpeg.off('progress', progressListener);
  }
  
  const data = await ffmpeg.readFile(outputFileName);

  return new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
}