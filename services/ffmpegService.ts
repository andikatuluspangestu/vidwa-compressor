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

export interface VideoInfo {
    duration: number;
    width: number;
    height: number;
    fps: number;
}

export async function getVideoMetadata(videoFile: File): Promise<VideoInfo> {
    if (!ffmpeg || !ffmpeg.loaded) {
        throw new Error('FFMPEG is not loaded.');
    }

    const inputFileName = `meta_${Date.now()}_${videoFile.name}`;
    await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

    let duration = 0;
    let width = 0;
    let height = 0;
    let fps = 0;
    
    const logListener = ({ message }: { message: string }) => {
        const durationMatch = message.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d+)/);
        if (durationMatch) {
            const hours = parseInt(durationMatch[1], 10);
            const minutes = parseInt(durationMatch[2], 10);
            const seconds = parseInt(durationMatch[3], 10);
            const deciseconds = parseInt(durationMatch[4], 10);
            duration = hours * 3600 + minutes * 60 + seconds + deciseconds / 100;
        }

        const streamMatch = message.match(/Stream #.*: Video: .*, (\d{3,5})x(\d{3,5}).*, (\d{1,3}(\.\d{1,2})?)\s+fps/);
        if (streamMatch) {
            width = parseInt(streamMatch[1], 10);
            height = parseInt(streamMatch[2], 10);
            fps = parseFloat(streamMatch[3]);
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

    return { duration, width, height, fps };
}


export async function compressVideo(
  videoFile: File,
  duration: number,
  settings: { 
    resolution: number; 
    removeAudio: boolean; 
    targetSizeMB: number;
    startTime: string;
    endTime: string;
  },
  onProgress: (details: { percentage: number }) => void
): Promise<Blob> {
    if (!ffmpeg || !ffmpeg.loaded) {
        throw new Error('FFMPEG is not loaded.');
    }

    const { resolution, removeAudio, targetSizeMB, startTime, endTime } = settings;
    
    let effectiveDuration = duration;
    if (startTime && endTime) {
        const startSeconds = startTime.split(':').reduce((acc, time) => (60 * acc) + +time, 0);
        const endSeconds = endTime.split(':').reduce((acc, time) => (60 * acc) + +time, 0);
        effectiveDuration = endSeconds - startSeconds;
    }

    if (effectiveDuration <= 0) {
        effectiveDuration = duration;
    }

    const totalBitrate = (targetSizeMB * 1024 * 8) / effectiveDuration;
    const audioBitrate = removeAudio ? 0 : 128;
    const targetVideoBitrate = Math.floor(totalBitrate - audioBitrate);
    
    if (targetVideoBitrate <= 0) {
        throw new Error('Target size is too small for the video duration. Please choose a larger size or compress without audio.');
    }

    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';
    
    await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

    const command: string[] = [];
    if (startTime) command.push('-ss', startTime);
    if (endTime) command.push('-to', endTime);
    
    command.push(
        '-i', inputFileName,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-b:v', `${targetVideoBitrate}k`,
        '-maxrate', `${Math.floor(targetVideoBitrate * 1.2)}k`,
        '-bufsize', `${Math.floor(targetVideoBitrate * 1.5)}k`,
        '-vf', `scale=-2:${resolution}`,
        '-y'
    );

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

export async function convertToGif(
  videoFile: File,
  settings: {
    resolution: number;
    fps: number;
    startTime: string;
    endTime: string;
  },
  onProgress: (details: { percentage: number; step: string }) => void
): Promise<Blob> {
    if (!ffmpeg || !ffmpeg.loaded) {
        throw new Error('FFMPEG is not loaded.');
    }

    const { resolution, fps, startTime, endTime } = settings;
    const inputFileName = 'input.mp4';
    const paletteFileName = 'palette.png';
    const outputFileName = 'output.gif';
    
    await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));
    
    const paletteCommand: string[] = [];
    if (startTime) paletteCommand.push('-ss', startTime);
    if (endTime) paletteCommand.push('-to', endTime);
    paletteCommand.push(
        '-i', inputFileName,
        '-vf', `fps=${fps},scale=${resolution}:-1:flags=lanczos,palettegen`,
        '-y',
        paletteFileName
    );

    onProgress({ percentage: 0, step: 'Step 1/2: Generating color palette...' });
    await ffmpeg.exec(paletteCommand);
    onProgress({ percentage: 50, step: 'Step 1/2: Palette generated.' });

    const gifCommand: string[] = [];
    if (startTime) gifCommand.push('-ss', startTime);
    if (endTime) gifCommand.push('-to', endTime);
    gifCommand.push(
        '-i', inputFileName,
        '-i', paletteFileName,
        '-filter_complex', `fps=${fps},scale=${resolution}:-1:flags=lanczos[x];[x][1:v]paletteuse`,
        '-y',
        outputFileName
    );

    const progressListener = ({ progress }) => {
        const percentage = 50 + Math.round(Math.min(progress, 1) * 50);
        onProgress({ percentage, step: 'Step 2/2: Creating GIF...' });
    };
    ffmpeg.on('progress', progressListener);

    try {
        await ffmpeg.exec(gifCommand);
    } finally {
        ffmpeg.off('progress', progressListener);
        await ffmpeg.deleteFile(inputFileName);
        await ffmpeg.deleteFile(paletteFileName);
    }

    const data = await ffmpeg.readFile(outputFileName);
    await ffmpeg.deleteFile(outputFileName);

    return new Blob([(data as Uint8Array).buffer], { type: 'image/gif' });
}