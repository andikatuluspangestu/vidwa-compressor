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
    
    const audioBitrate = removeAudio ? 0 : 128; // in kbps
    const targetVideoBitrate = Math.floor(((targetSizeMB * 1024 * 8) / duration) - audioBitrate);
    
    if (targetVideoBitrate <= 0) {
        throw new Error('Target size is too small for the video duration. Please choose a larger size or compress without audio.');
    }

    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';
    
    await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

    const commonArgs = [
        '-i', inputFileName,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-b:v', `${targetVideoBitrate}k`,
        '-vf', `scale=-2:${resolution}`,
        '-y',
    ];

    const pass1Command = [ ...commonArgs, '-pass', '1', '-f', 'mp4', '/dev/null'];
    if (removeAudio) {
      pass1Command.splice(5, 0, '-an');
    }

    const pass2Command = [ ...commonArgs, '-pass', '2' ];
    if (removeAudio) {
      pass2Command.splice(5, 0, '-an');
    } else {
      pass2Command.push('-c:a', 'aac', '-b:a', '128k');
    }
    pass2Command.push(outputFileName);

    let currentPass: 1 | 2 = 1;

    const progressListener = ({ progress }) => {
        const percentage = Math.round(Math.min(progress, 1) * 100);
        const totalPercentage = currentPass === 1
            ? Math.round(percentage * 0.3)
            : 30 + Math.round(percentage * 0.7);
        onProgress({ percentage: totalPercentage });
    };

    ffmpeg.on('progress', progressListener);
    
    try {
        await ffmpeg.exec(pass1Command);
        currentPass = 2;
        await ffmpeg.exec(pass2Command);
    } finally {
        ffmpeg.off('progress', progressListener);
        await ffmpeg.deleteFile(inputFileName);
        // Don't delete outputFileName, we need to read it
    }
  
    const data = await ffmpeg.readFile(outputFileName);
    await ffmpeg.deleteFile(outputFileName);

    return new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
}