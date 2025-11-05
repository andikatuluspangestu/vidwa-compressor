import React, { useState, useEffect, useRef } from 'react';
import { AppState } from './types';
import { loadFfmpeg, compressVideo } from './services/ffmpegService';
import { UploadIcon, DownloadIcon, VideoIcon, SpinnerIcon } from './components/icons';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [compressedVideoBlob, setCompressedVideoBlob] = useState<Blob | null>(null);
  const [progress, setProgress] = useState(0);
  const [processedBytes, setProcessedBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initFfmpeg = async () => {
      setAppState(AppState.LOADING_FFMPEG);
      try {
        await loadFfmpeg();
        setAppState(AppState.READY);
      } catch (err) {
        console.error(err);
        setError('Failed to load FFmpeg. Please check the console for details.');
        setAppState(AppState.ERROR);
      }
    };
    initFfmpeg();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setCompressedVideoBlob(null);
      setProgress(0);
      setProcessedBytes(0);
      setError(null);
    }
  };

  const handleCompress = async () => {
    if (!videoFile) {
      setError('Please select a video file first.');
      return;
    }

    setAppState(AppState.PROCESSING);
    setError(null);
    setProgress(0);
    setProcessedBytes(0);

    try {
      const blob = await compressVideo(videoFile, ({ percentage, processedBytes }) => {
        setProgress(percentage);
        setProcessedBytes(processedBytes);
      });
      setCompressedVideoBlob(blob);
      setAppState(AppState.DONE);
    } catch (err) {
      console.error(err);
      let errorMessage = 'An error occurred during video compression.';
      if (err instanceof Error) {
        errorMessage += ` Details: ${err.message}`;
      }
      setError(errorMessage);
      setAppState(AppState.ERROR);
    }
  };

  const handleDownload = () => {
    if (compressedVideoBlob) {
      const url = URL.createObjectURL(compressedVideoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compressed-${videoFile?.name || 'video.mp4'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleReset = () => {
    setVideoFile(null);
    setCompressedVideoBlob(null);
    setProgress(0);
    setProcessedBytes(0);
    setError(null);
    setAppState(AppState.READY);
    if (inputFileRef.current) {
        inputFileRef.current.value = "";
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  const renderReadyState = () => (
    <div className="space-y-8 text-center">
        <div>
            <label htmlFor="file-upload" className="cursor-pointer group">
                <div className="flex flex-col items-center justify-center w-full h-64 bg-white/5 border border-white/10 rounded-2xl group-hover:bg-white/10 transition-colors">
                    <UploadIcon className="w-12 h-12 text-gray-400 group-hover:text-white transition-colors" />
                    <span className="mt-4 text-lg font-medium text-gray-200">
                        {videoFile ? videoFile.name : "Click to upload a video"}
                    </span>
                    <p className="text-sm text-gray-400 mt-1">MP4, MOV, AVI, etc.</p>
                </div>
                <input ref={inputFileRef} id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="video/*" />
            </label>
        </div>
        {videoFile && (
            <div className="flex justify-center">
                <button
                    onClick={handleCompress}
                    className="px-10 py-4 text-xl font-semibold text-white bg-blue-600/50 rounded-xl shadow-lg hover:bg-blue-600/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 transition-all transform hover:scale-105"
                >
                    Compress Video
                </button>
            </div>
        )}
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
        {videoFile && (
            <p className="text-md text-gray-300 mt-1">
                {formatBytes(processedBytes)} / {formatBytes(videoFile.size)}
            </p>
        )}
    </div>
  );
  
  const renderDoneState = () => (
    <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 className="text-xl font-semibold text-white mb-3">Original Video</h3>
                <video src={videoFile ? URL.createObjectURL(videoFile) : ''} controls className="w-full rounded-lg shadow-lg"></video>
                <p className="text-md text-gray-300 mt-3">Size: <span className="font-medium text-white">{videoFile ? formatBytes(videoFile.size) : 'N/A'}</span></p>
            </div>
            <div>
                <h3 className="text-xl font-semibold text-white mb-3">Compressed Video</h3>
                <video src={compressedVideoBlob ? URL.createObjectURL(compressedVideoBlob) : ''} controls className="w-full rounded-lg shadow-lg"></video>
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
        <div className="flex justify-center items-center space-x-6 pt-4">
            <button
                onClick={handleDownload}
                className="flex items-center justify-center px-8 py-3 text-lg font-semibold text-white bg-green-600/80 rounded-xl shadow-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-green-500 transition-all transform hover:scale-105"
            >
                <DownloadIcon className="w-6 h-6 mr-3" /> Download
            </button>
            <button
                onClick={handleReset}
                className="px-8 py-3 text-lg font-semibold text-gray-200 bg-white/10 rounded-xl shadow-lg hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-400 transition-all transform hover:scale-105"
            >
                Compress Another
            </button>
        </div>
    </div>
  );
  
  const renderErrorState = () => (
    <div className="text-center p-6 bg-red-500/20 border border-red-500/30 rounded-xl">
        <p className="text-2xl font-semibold text-red-200">An Error Occurred</p>
        <p className="text-red-300 mt-2">{error}</p>
        <button
            onClick={handleReset}
            className="mt-6 px-6 py-2 font-semibold text-white bg-red-600/80 rounded-lg hover:bg-red-700"
        >
            Try Again
        </button>
    </div>
  );
  
  const getContent = () => {
    switch(appState) {
        case AppState.IDLE:
        case AppState.LOADING_FFMPEG:
            return (
                <div className="text-center py-12">
                    <SpinnerIcon className="w-12 h-12 mx-auto animate-spin text-white" />
                    <p className="mt-6 text-lg text-gray-300">Loading FFmpeg core...</p>
                    <p className="text-sm text-gray-400">This may take a moment on first visit.</p>
                </div>
            );
        case AppState.READY:
            return renderReadyState();
        case AppState.PROCESSING:
            return renderProcessingState();
        case AppState.DONE:
            return renderDoneState();
        case AppState.ERROR:
            return renderErrorState();
        default: return null;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans antialiased bg-gradient-to-br from-[#0c111d] via-[#1a233e] to-[#3a4e8a]">
        <div className="w-full max-w-5xl mx-auto bg-black/20 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8 md:p-12 space-y-8">
            <header className="text-center">
                <div className="flex items-center justify-center space-x-4">
                    <VideoIcon className="w-12 h-12 text-blue-400" />
                    <h1 className="text-5xl font-extrabold text-white tracking-tight">VidWA Compressor</h1>
                </div>
                <p className="mt-4 text-xl text-gray-300">Compress HD videos for your WhatsApp Status.</p>
            </header>
            <main className="mt-8">
                {getContent()}
            </main>
        </div>
    </div>
  );
};

export default App;
