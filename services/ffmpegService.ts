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
    // console.log(message); // Can be noisy, disable for production builds
  });
  
  await ffmpeg.load({
      coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
}

export async function getVideoMetadata(videoFile: File): Promise<{ duration: number }> {
    if (!ffmpeg || !ffmpeg.loaded) {
        throw new Error('FFMPEG is not loaded.');
    }

    const inputFileName = `meta_${Date.now()}_${videoFile.name}`;
    await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

    let duration = 0;
    const logListener = ({ message }) => {
        const durationMatch = message.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d+)/);
        if (durationMatch) {
            const hours = parseInt(durationMatch[1], 10);
            const minutes = parseInt(durationMatch[2], 10);
            const seconds = parseInt(durationMatch[3], 10);
            const deciseconds = parseInt(durationMatch[4], 10);
            duration = hours * 3600 + minutes * 60 + seconds + deciseconds / 100;
        }
    };
    ffmpeg.on('log', logListener);

    try {
        await ffmpeg.exec(['-i', inputFileName, '-hide_banner']);
    } catch (e) {
        // exec throws an error as it's not a complete transcode, but metadata is still logged.
    } finally {
        ffmpeg.off('log', logListener);
        await ffmpeg.deleteFile(inputFileName);
    }
    
    if (duration === 0) {
        throw new Error("Could not determine video duration from its metadata.");
    }

    return { duration };
}

export async function compressVideo(
  videoFile: File,
  duration: number,
  settings: { resolution: number; removeAudio: boolean; targetSizeMB: number },
  onProgress: (details: { percentage: number }) => void
): Promise<Blob> {
    if (!ffmpeg || !ffmpeg.loaded) {
        throw new Error('FFMPEG is not loaded.');
    }

    const { resolution, removeAudio, targetSizeMB } = settings;
    
    // Total desired bitrate in kbps. (Size in MB * 1024 KB/MB * 8 bits/byte) / duration in seconds
    const totalBitrate = (targetSizeMB * 1024 * 8) / duration;
    const audioBitrate = removeAudio ? 0 : 128; // in kbps
    const targetVideoBitrate = Math.floor(totalBitrate - audioBitrate);
    
    if (targetVideoBitrate <= 0) {
        throw new Error('Target size is too small for the video duration. Please choose a larger size or compress without audio.');
    }

    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';
    
    await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

    // Use a more reliable single-pass encoding
    const command = [
        '-i', inputFileName,
        '-c:v', 'libx264',
        '-preset', 'medium', // 'medium' is a good balance of speed and quality
        '-b:v', `${targetVideoBitrate}k`,
        '-maxrate', `${Math.floor(targetVideoBitrate * 1.2)}k`, // Prevent bitrate spikes
        '-bufsize', `${Math.floor(targetVideoBitrate * 1.5)}k`, // VBV buffer size
        '-vf', `scale=-2:${resolution}`,
        '-y',
    ];

    if (removeAudio) {
      command.push('-an');
    } else {
      command.push('-c:a', 'aac', '-b:a', `${audioBitrate}k`);
    }

    command.push(outputFileName);

    const progressListener = ({ progress }) => {
        const percentage = Math.round(Math.min(progress, 1) * 100);
        onProgress({ percentage });
    };

    ffmpeg.on('progress', progressListener);
    
    try {
        await ffmpeg.exec(command);
    } finally {
        ffmpeg.off('progress', progressListener);
        await ffmpeg.deleteFile(inputFileName);
    }
  
    const data = await ffmpeg.readFile(outputFileName);
    await ffmpeg.deleteFile(outputFileName);

    return new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
}
