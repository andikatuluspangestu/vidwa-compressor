import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from './types';
import { loadFfmpeg, compressVideo, getVideoMetadata } from './services/ffmpegService';
import { UploadIcon, DownloadIcon, VideoIcon, SpinnerIcon, CopyIcon, TrashIcon, CheckIcon } from './components/icons';
import { Faq } from './components/Faq';

interface CompressionSettings {
  resolution: number;
  removeAudio: boolean;
  targetSizeMB: number;
}

interface VideoMetadata {
  duration: number;
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [compressedVideoBlob, setCompressedVideoBlob] = useState<Blob | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [settings, setSettings] = useState<CompressionSettings>({ resolution: 720, removeAudio: false, targetSizeMB: 8 });
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  
  const inputFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initFfmpeg = async () => {
      setAppState(AppState.LOADING_FFMPEG);
      try {
        await loadFfmpeg();
        setAppState(AppState.READY);
      } catch (err) {
        console.error(err);
        setError('Failed to load FFmpeg. This tool cannot work without it.');
        setAppState(AppState.ERROR);
      }
    };
    initFfmpeg();
  }, []);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      video.src = URL.createObjectURL(file);
      video.onloadeddata = () => {
        video.currentTime = 1;
      };
      video.onseeked = () => {
        const aspectRatio = video.videoWidth / video.videoHeight;
        canvas.width = 300;
        canvas.height = 300 / aspectRatio;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg'));
        URL.revokeObjectURL(video.src);
      };
    });
  };

  const handleFileSelect = useCallback(async (file: File | null) => {
    if (!file || !file.type.startsWith('video/')) {
        setError("Invalid file type. Please select a video file.");
        return;
    }
    setError(null);
    setVideoFile(file);
    setCompressedVideoBlob(null);

    try {
        const thumb = await generateThumbnail(file);
        setThumbnail(thumb);
        const meta = await getVideoMetadata(file);
        setMetadata(meta);
        const maxTargetSize = Math.floor(file.size / (1024 * 1024));
        setSettings(s => ({...s, targetSizeMB: Math.min(s.targetSizeMB, maxTargetSize > 0 ? maxTargetSize : 1)}));
    } catch (err) {
        console.error(err);
        setError("Could not process video metadata. The file might be corrupted.");
        handleReset();
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    handleFileSelect(file || null);
  };
  
  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, isEntering: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(isEntering);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      handleDragEvents(e, false);
      const file = e.dataTransfer.files?.[0];
      handleFileSelect(file || null);
  };

  const handleCompress = async () => {
    if (!videoFile || !metadata) return;
    setAppState(AppState.PROCESSING);
    setProgress(0);
    try {
      const blob = await compressVideo(videoFile, metadata.duration, settings, ({ percentage }) => {
        setProgress(percentage);
      });
      setCompressedVideoBlob(blob);
      setAppState(AppState.DONE);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during compression.');
      setAppState(AppState.ERROR);
    }
  };

  const handleDownload = () => {
    if (!compressedVideoBlob) return;
    const url = URL.createObjectURL(compressedVideoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compressed-${videoFile?.name || 'video.mp4'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    if (!compressedVideoBlob) return;
    try {
      const item = new ClipboardItem({ 'video/mp4': compressedVideoBlob });
      await navigator.clipboard.write([item]);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Copy to clipboard failed. Your browser may not support this feature.');
    }
  };

  const handleReset = () => {
    setVideoFile(null);
    setCompressedVideoBlob(null);
    setProgress(0);
    setError(null);
    setThumbnail(null);
    setMetadata(null);
    setAppState(AppState.READY);
    if (inputFileRef.current) inputFileRef.current.value = "";
  };
  
  const renderInitial = () => (
    <div
        onDragEnter={(e) => handleDragEvents(e, true)}
        onDragLeave={(e) => handleDragEvents(e, false)}
        onDragOver={(e) => handleDragEvents(e, true)}
        onDrop={handleDrop}
    >
        <label htmlFor="file-upload" className={`cursor-pointer group flex flex-col items-center justify-center w-full h-80 bg-white/5 border-2 border-dashed rounded-2xl transition-colors ${isDragging ? 'border-blue-400 bg-white/10' : 'border-white/10'}`}>
            <UploadIcon className="w-16 h-16 text-gray-400 group-hover:text-white transition-colors" />
            <span className="mt-4 text-xl font-medium text-gray-200">
                Drag & Drop or Click to Upload
            </span>
            <p className="text-md text-gray-400 mt-1">MP4, MOV, AVI, etc.</p>
        </label>
        <input ref={inputFileRef} id="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="video/*" />
    </div>
  );
  
  const renderDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white">Video Preview</h3>
            {thumbnail && <img src={thumbnail} alt="Video thumbnail" className="rounded-lg w-full" />}
            <div className="flex justify-between items-center text-gray-300">
                <span className="truncate pr-4">{videoFile?.name}</span>
                <span className="font-mono text-white">{formatBytes(videoFile?.size || 0)}</span>
            </div>
             <button onClick={handleReset} className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors">
                <TrashIcon className="w-4 h-4" /> Remove Video
            </button>
        </div>
        <div className="space-y-6 bg-white/5 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-white">Compression Settings</h3>
            <div>
                <label htmlFor="targetSize" className="flex justify-between text-sm font-medium text-gray-200">
                    <span>Target Size (MB)</span>
                    <span className="font-bold text-blue-300">{settings.targetSizeMB} MB</span>
                </label>
                <input id="targetSize" type="range" min="1" max={Math.max(1, Math.floor((videoFile?.size || 0) / (1024*1024)))} step="1" value={settings.targetSizeMB} onChange={(e) => setSettings({...settings, targetSizeMB: parseInt(e.target.value)})} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
            </div>
            <div>
                <label htmlFor="resolution" className="block text-sm font-medium text-gray-200">Resolution</label>
                <select id="resolution" value={settings.resolution} onChange={(e) => setSettings({...settings, resolution: parseInt(e.target.value)})} className="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                    <option value="1080">1080p (Full HD)</option>
                    <option value="720">720p (HD)</option>
                    <option value="480">480p (SD)</option>
                </select>
            </div>
            <div className="flex items-center">
                <input id="removeAudio" type="checkbox" checked={settings.removeAudio} onChange={(e) => setSettings({...settings, removeAudio: e.target.checked})} className="h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500" />
                <label htmlFor="removeAudio" className="ml-2 block text-sm text-gray-200">Remove Audio</label>
            </div>
            <button onClick={handleCompress} className="w-full px-10 py-4 text-xl font-semibold text-white bg-blue-600 rounded-xl shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 transition-all transform hover:scale-105">
                Compress Video
            </button>
        </div>
    </div>
  );
  
  const renderProcessingState = () => (
    <div className="text-center py-12">
        <SpinnerIcon className="w-12 h-12 mx-auto animate-spin mb-6 text-white" />
        <p className="text-2xl font-semibold text-white">Compressing video...</p>
        <div className="w-full bg-white/10 rounded-full mt-6 h-4 overflow-hidden">
            <div className="bg-blue-500 h-4 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>
        <p className="text-xl font-mono text-white mt-4">{progress}%</p>
    </div>
  );

  const renderDoneState = () => (
    <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 className="text-xl font-semibold text-white mb-3">Original Video</h3>
                <video src={videoFile ? URL.createObjectURL(videoFile) : ''} controls className="w-full rounded-lg shadow-lg bg-black"></video>
                <p className="text-md text-gray-300 mt-3">Size: <span className="font-medium text-white">{videoFile ? formatBytes(videoFile.size) : 'N/A'}</span></p>
            </div>
            <div>
                <h3 className="text-xl font-semibold text-white mb-3">Compressed Video</h3>
                <video src={compressedVideoBlob ? URL.createObjectURL(compressedVideoBlob) : ''} controls className="w-full rounded-lg shadow-lg bg-black"></video>
                <p className="text-md text-gray-300 mt-3">Size: <span className="font-medium text-white">{compressedVideoBlob ? formatBytes(compressedVideoBlob.size) : 'N/A'}</span></p>
            </div>
        </div>
        {videoFile && compressedVideoBlob && (
            <div className="text-center bg-green-500/20 p-4 rounded-xl border border-green-500/30">
                <p className="text-lg text-green-200 font-semibold">
                    Compression saved {formatBytes(videoFile.size - compressedVideoBlob.size)} (
                    {(((videoFile.size - compressedVideoBlob.size) / videoFile.size) * 100).toFixed(1)}% reduction)
                </p>
            </div>
        )}
        <div className="flex justify-center items-center flex-wrap gap-4 pt-4">
            <button onClick={handleDownload} className="flex items-center justify-center px-6 py-3 text-lg font-semibold text-white bg-green-600 rounded-xl shadow-lg hover:bg-green-700 transition-all transform hover:scale-105">
                <DownloadIcon className="w-6 h-6 mr-3" /> Download
            </button>
            <button onClick={handleCopyToClipboard} className="flex items-center justify-center px-6 py-3 text-lg font-semibold text-white bg-indigo-600 rounded-xl shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-105">
                {copyStatus === 'copied' ? <CheckIcon className="w-6 h-6 mr-3" /> : <CopyIcon className="w-6 h-6 mr-3" />}
                {copyStatus === 'copied' ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <button onClick={handleReset} className="px-6 py-3 text-lg font-semibold text-gray-200 bg-white/10 rounded-xl shadow-lg hover:bg-white/20 transition-all transform hover:scale-105">
                Compress Another
            </button>
        </div>
    </div>
  );

  const renderErrorState = () => (
    <div className="text-center p-6 bg-red-500/20 border border-red-500/30 rounded-xl">
        <p className="text-xl font-semibold text-red-200">An Error Occurred</p>
        <p className="text-red-300 mt-2">{error}</p>
        <button onClick={handleReset} className="mt-6 px-6 py-2 font-semibold text-white bg-red-600/80 rounded-lg hover:bg-red-700">
            Try Again
        </button>
    </div>
  );

  const getContent = () => {
    if (appState === AppState.ERROR) return renderErrorState();
    if (appState === AppState.IDLE || appState === AppState.LOADING_FFMPEG) {
      return (
        <div className="text-center py-12">
            <SpinnerIcon className="w-12 h-12 mx-auto animate-spin text-white" />
            <p className="mt-6 text-lg text-gray-300">Loading FFmpeg core...</p>
            <p className="text-sm text-gray-400">This may take a moment on first visit.</p>
        </div>
      );
    }
    if (appState === AppState.PROCESSING) return renderProcessingState();
    if (appState === AppState.DONE) return renderDoneState();
    if (!videoFile) return renderInitial();
    return renderDashboard();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 font-sans antialiased bg-gradient-to-br from-[#0c111d] via-[#1a233e] to-[#3a4e8a]">
        <div className="w-full max-w-5xl mx-auto my-8">
            <div className="bg-black/20 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-6 md:p-12 space-y-8">
                <header className="text-center">
                    <div className="flex items-center justify-center space-x-4">
                        <VideoIcon className="w-12 h-12 text-blue-400" />
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">VidWA Compressor</h1>
                    </div>
                    <p className="mt-4 text-lg md:text-xl text-gray-300">Compress HD videos for your WhatsApp Status without losing quality.</p>
                </header>
                <main className="mt-8">
                    {getContent()}
                </main>
            </div>
            <Faq />
             <footer className="text-center text-gray-400 text-sm mt-8">
                <p>
                    Made with ❤️. Inspired by <a href="https://github.com/julianromli/fastcompress" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">FastCompress</a>.
                </p>
            </footer>
        </div>
    </div>
  );
};

export default App;