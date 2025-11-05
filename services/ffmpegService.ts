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