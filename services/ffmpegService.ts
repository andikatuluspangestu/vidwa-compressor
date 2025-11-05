import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

export const loadFfmpeg = async (): Promise<void> => {
  if (ffmpeg) {
    return;
  }
  ffmpeg = new FFmpeg();
  
  // Base URL for FFmpeg core files
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
};

export const getVideoMetadata = async (file: File): Promise<VideoInfo> => {
  if (!ffmpeg) {
    await loadFfmpeg();
  }
  // This non-null assertion is safe because loadFfmpeg initializes it.
  const ffmpegInstance = ffmpeg!;

  const fileName = 'input.video';
  await ffmpegInstance.writeFile(fileName, await fetchFile(file));

  let duration = 0;
  let width = 0;
  let height = 0;
  let fps = 0;

  const logs: string[] = [];
  const logListener = ({ type, message }: {type: string, message: string}) => {
    if (type === 'stderr') {
      logs.push(message);
    }
  };
  ffmpegInstance.on('log', logListener);

  try {
    // This command will fail, but that's expected. The metadata is in stderr logs.
    await ffmpegInstance.exec(['-i', fileName]);
  } catch (e) {
    // ffmpeg throws an error when called with -i and no output, which is expected.
  }

  const output = logs.join('\n');
  
  const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.\d{2}/);
  if (durationMatch) {
    const hours = parseInt(durationMatch[1], 10);
    const minutes = parseInt(durationMatch[2], 10);
    const seconds = parseInt(durationMatch[3], 10);
    duration = hours * 3600 + minutes * 60 + seconds;
  }

  const streamMatch = output.match(/Stream #\d:\d.*: Video: .* (\d+)x(\d+).* (\d+(\.\d+)?) fps/);
  if (streamMatch) {
    width = parseInt(streamMatch[1], 10);
    height = parseInt(streamMatch[2], 10);
    fps = parseFloat(streamMatch[3]);
  }

  // Reset log handler
  ffmpegInstance.off('log', logListener);

  await ffmpegInstance.deleteFile(fileName);

  if (duration === 0 || width === 0) {
    console.error("FFmpeg output:", output);
    throw new Error("Could not parse video metadata. The file might be corrupted or in an unsupported format.");
  }

  return { duration, width, height, fps };
};

interface VideoCompressionSettings {
  resolution: number;
  removeAudio: boolean;
  targetSizeMB: number;
  startTime: string;
  endTime: string;
}

export const compressVideo = async (
  file: File,
  duration: number,
  settings: VideoCompressionSettings,
  onProgress: (progress: { percentage: number }) => void
): Promise<Blob> => {
  if (!ffmpeg) {
    await loadFfmpeg();
  }
  const ffmpegInstance = ffmpeg!;

  const { resolution, removeAudio, targetSizeMB, startTime, endTime } = settings;

  const totalBitrate = (targetSizeMB * 1024 * 8) / duration; // in kbit/s

  const audioBitrate = removeAudio ? 0 : 128; // kbit/s, a reasonable default
  const videoBitrate = totalBitrate - audioBitrate;

  if (videoBitrate <= 0) {
    throw new Error(`Target size is too small for the video duration. Try increasing the target size.`);
  }

  const inputFilename = 'input.video';
  const outputFilename = 'output.mp4';
  await ffmpegInstance.writeFile(inputFilename, await fetchFile(file));

  const progressListener = ({ progress }: { progress: number }) => {
    // Progress can sometimes exceed 1, clamp it.
    onProgress({ percentage: Math.round(Math.min(progress, 1) * 100) });
  };
  ffmpegInstance.on('progress', progressListener);

  const args = ['-y']; // Overwrite output file if it exists

  if (startTime) {
    args.push('-ss', startTime);
  }
  
  args.push('-i', inputFilename);

  if (endTime) {
    args.push('-to', endTime);
  }

  args.push(
    '-c:v', 'libx264',
    '-b:v', `${Math.round(videoBitrate)}k`,
    '-preset', 'medium',
    '-vf', `scale=-2:${resolution}`,
    '-movflags', '+faststart',
  );

  if (removeAudio) {
    args.push('-an');
  } else {
    args.push('-c:a', 'aac', '-b:a', `${audioBitrate}k`);
  }

  args.push(outputFilename);

  await ffmpegInstance.exec(args);

  ffmpegInstance.off('progress', progressListener);

  const data = await ffmpegInstance.readFile(outputFilename);
  await ffmpegInstance.deleteFile(inputFilename);
  await ffmpegInstance.deleteFile(outputFilename);

  return new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
};

interface GifSettings {
  resolution: number;
  fps: number;
  startTime: string;
  endTime: string;
}

export const convertToGif = async (
  file: File,
  settings: GifSettings,
  onProgress: (progress: { percentage: number; step: string }) => void
): Promise<Blob> => {
  if (!ffmpeg) {
    await loadFfmpeg();
  }
  const ffmpegInstance = ffmpeg!;

  const { resolution, fps, startTime, endTime } = settings;

  const inputFilename = 'input.video';
  const paletteFilename = 'palette.png';
  const outputFilename = 'output.gif';

  await ffmpegInstance.writeFile(inputFilename, await fetchFile(file));

  // Pass 1: Generate palette for better quality
  onProgress({ percentage: 0, step: 'Generating color palette...' });
  const paletteArgs = ['-y'];
  if (startTime) paletteArgs.push('-ss', startTime);
  paletteArgs.push('-i', inputFilename);
  if (endTime) paletteArgs.push('-to', endTime);
  paletteArgs.push(
    '-vf', `fps=${fps},scale=${resolution}:-1:flags=lanczos,palettegen`,
    paletteFilename
  );
  await ffmpegInstance.exec(paletteArgs);
  onProgress({ percentage: 50, step: 'Generating color palette...' });

  // Pass 2: Convert to GIF using the palette
  onProgress({ percentage: 50, step: 'Converting video to GIF...' });
  const gifArgs = [];
  if (startTime) gifArgs.push('-ss', startTime);
  gifArgs.push('-i', inputFilename, '-i', paletteFilename);
  if (endTime) gifArgs.push('-to', endTime);
  gifArgs.push(
    '-filter_complex', `fps=${fps},scale=${resolution}:-1:flags=lanczos[x];[x][1:v]paletteuse`,
    outputFilename
  );
  await ffmpegInstance.exec(gifArgs);
  onProgress({ percentage: 100, step: 'Finalizing...' });

  const data = await ffmpegInstance.readFile(outputFilename);

  await ffmpegInstance.deleteFile(inputFilename);
  await ffmpegInstance.deleteFile(paletteFilename);
  await ffmpegInstance.deleteFile(outputFilename);

  return new Blob([(data as Uint8Array).buffer], { type: 'image/gif' });
};
