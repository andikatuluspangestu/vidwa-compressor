import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from './types';
import { loadFfmpeg, compressVideo } from './services/ffmpegService';
import { UploadIcon, DownloadIcon, VideoIcon } from './components/icons';

interface FileInfoProps {
  file: File;
}

const FileInfo: React.FC<FileInfoProps> = ({ file }) => (
  <div className="flex items-center space-x-4 bg-white/60 backdrop-blur-sm p-4 rounded-lg border border-white/30">
    <VideoIcon className="h-10 w-10 text-brand-green flex-shrink-0" />
    <div className="min-w-0">
      <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
    </div>
  </div>
);

interface ProcessingViewProps {
  progress: number;
  message: string;
  processedBytes?: number;
  totalBytes?: number;
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ progress, message, processedBytes, totalBytes }) => (
    <div className="w-full text-center p-8 bg-white/60 backdrop-blur-sm rounded-xl border border-white/30">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">{message}</h2>
        <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
            <div
                className="bg-brand-green h-4 rounded-full transition-all duration-300 ease-linear"
                style={{ width: `${progress}%` }}
            ></div>
        </div>
        <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-slate-500">
                {processedBytes !== undefined && totalBytes !== undefined 
                    ? `${(processedBytes / 1024 / 1024).toFixed(2)} MB / ${(totalBytes / 1024 / 1024).toFixed(2)} MB`
                    : ''
                }
            </span>
            <p className="text-brand-green text-xl font-bold">{progress}%</p>
        </div>
    </div>
);

interface ResultViewProps {
    outputUrl: string;
    originalSize: number;
    compressedSize: number;
    onReset: () => void;
}

const ResultView: React.FC<ResultViewProps> = ({ outputUrl, originalSize, compressedSize, onReset }) => {
    const sizeReduction = originalSize > 0 ? ((originalSize - compressedSize) / originalSize) * 100 : 0;

    return (
        <div className="w-full flex flex-col gap-6 items-center">
            <h2 className="text-2xl font-bold text-center text-slate-800">Kompresi Selesai!</h2>
            <div className="w-full max-w-lg bg-slate-900 rounded-xl overflow-hidden shadow-lg">
                <video src={outputUrl} controls className="w-full aspect-video"></video>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-lg text-center">
                <div className="bg-white/50 backdrop-blur-sm p-4 rounded-lg border border-white/30">
                    <p className="text-sm text-slate-500">Ukuran Asli</p>
                    <p className="text-lg font-bold text-slate-800">{(originalSize / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <div className="bg-white/50 backdrop-blur-sm p-4 rounded-lg border border-white/30">
                    <p className="text-sm text-slate-500">Ukuran Baru</p>
                    <p className="text-lg font-bold text-brand-green">{(compressedSize / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <div className="bg-white/50 backdrop-blur-sm p-4 rounded-lg border border-white/30">
                    <p className="text-sm text-slate-500">Pengurangan</p>
                    <p className="text-lg font-bold text-slate-800">{sizeReduction.toFixed(1)}%</p>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
                <a
                    href={outputUrl}
                    download={`compressed_${Date.now()}.mp4`}
                    className="flex-1 flex items-center justify-center gap-2 w-full bg-brand-green text-white font-bold py-3 px-6 rounded-lg hover:bg-green-500 transition-colors duration-300 shadow-md"
                >
                    <DownloadIcon className="h-5 w-5" />
                    Unduh Video
                </a>
                <button
                    onClick={onReset}
                    className="flex-1 w-full bg-white/80 text-slate-700 font-bold py-3 px-6 rounded-lg hover:bg-white transition-colors duration-300 shadow-md"
                >
                    Kompres Video Lain
                </button>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>(AppState.IDLE);
    const [inputFile, setInputFile] = useState<File | null>(null);
    const [outputUrl, setOutputUrl] = useState<string>('');
    const [progress, setProgress] = useState({ percentage: 0, processedBytes: 0 });
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [message, setMessage] = useState('');
    const [originalSize, setOriginalSize] = useState(0);
    const [compressedSize, setCompressedSize] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const loadingIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        const initFfmpeg = async () => {
            try {
                setAppState(AppState.LOADING_FFMPEG);
                setMessage('Mengunduh komponen inti...');
                
                setLoadingProgress(0);
                const SIMULATED_DURATION_MS = 15000;
                const INTERVAL_MS = 100;
                const MAX_SIMULATED_PROGRESS = 95;
                
                loadingIntervalRef.current = window.setInterval(() => {
                    setLoadingProgress(prev => {
                        const newProgress = prev + (MAX_SIMULATED_PROGRESS / (SIMULATED_DURATION_MS / INTERVAL_MS));
                        if (newProgress >= MAX_SIMULATED_PROGRESS) {
                            if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
                            return MAX_SIMULATED_PROGRESS;
                        }
                        return newProgress;
                    });
                }, INTERVAL_MS);

                await loadFfmpeg();

                if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
                setLoadingProgress(100);

                setTimeout(() => {
                    setAppState(AppState.READY);
                    setMessage('');
                }, 500);

            } catch (err) {
                if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
                console.error('Failed to load ffmpeg', err);
                setError('Gagal memuat komponen kompresi. Coba muat ulang halaman.');
                setAppState(AppState.ERROR);
            }
        };
        initFfmpeg();

        return () => {
            if (loadingIntervalRef.current) {
                clearInterval(loadingIntervalRef.current);
            }
        };
    }, []);


    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('video/')) {
            setInputFile(file);
            setOriginalSize(file.size);
            setError(null);
        } else {
            setError('Silakan pilih file video yang valid.');
            setInputFile(null);
        }
    };

    const handleCompress = useCallback(async () => {
        if (!inputFile) return;

        setAppState(AppState.PROCESSING);
        setProgress({ percentage: 0, processedBytes: 0 });
        setMessage('Mempersiapkan video...');
        
        try {
            const onProgress = (p: { percentage: number; processedBytes: number }) => {
                setProgress(p);
                 if (p.percentage < 99) {
                    setMessage(`Mengompres video...`);
                } else {
                    setMessage(`Menyelesaikan... sedikit lagi!`);
                }
            };

            const outputBlob = await compressVideo(inputFile, onProgress);
            const url = URL.createObjectURL(outputBlob);
            
            setOutputUrl(url);
            setCompressedSize(outputBlob.size);
            setAppState(AppState.DONE);
            setMessage('');
        } catch (err) {
            console.error('Compression failed', err);
            setError('Terjadi kesalahan saat kompresi. Pastikan video tidak rusak.');
            setAppState(AppState.READY);
        }
    }, [inputFile]);

    const resetState = () => {
        if (outputUrl) URL.revokeObjectURL(outputUrl);
        setInputFile(null);
        setOutputUrl('');
        setProgress({ percentage: 0, processedBytes: 0 });
        setOriginalSize(0);
        setCompressedSize(0);
        setAppState(AppState.READY);
    };

    const renderContent = () => {
        switch (appState) {
            case AppState.IDLE:
            case AppState.LOADING_FFMPEG:
                return (
                    <div className="w-full">
                        <ProcessingView progress={Math.round(loadingProgress)} message={message} />
                        <p className="text-center text-slate-700 text-sm mt-4 max-w-xs mx-auto">
                            Proses ini hanya terjadi sekali saat membuka web. Harap tunggu sebentar (±32 MB).
                        </p>
                    </div>
                );
            case AppState.READY:
                return (
                    <div className="w-full flex flex-col gap-6">
                        {!inputFile ? (
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full p-10 border-2 border-dashed border-gray-200/50 rounded-xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-brand-green hover:bg-white/60 transition-all duration-300"
                            >
                                <UploadIcon className="h-12 w-12 text-slate-500" />
                                <span className="text-lg font-semibold text-slate-900">Klik untuk Pilih Video</span>
                                <span className="text-sm text-slate-600">Atau seret & lepas file di sini</span>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    accept="video/*"
                                    className="hidden"
                                />
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center gap-4">
                                <FileInfo file={inputFile} />
                                <button
                                    onClick={handleCompress}
                                    className="w-full max-w-md bg-brand-green text-white font-bold py-3 px-6 rounded-lg hover:bg-green-500 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                >
                                    Kompres Video
                                </button>
                            </div>
                        )}
                    </div>
                );
            case AppState.PROCESSING:
                return <ProcessingView progress={progress.percentage} message={message} processedBytes={progress.processedBytes} totalBytes={originalSize} />;
            case AppState.DONE:
                return <ResultView outputUrl={outputUrl} originalSize={originalSize} compressedSize={compressedSize} onReset={resetState} />;
            case AppState.ERROR:
                 return (
                    <div className="text-center p-8 bg-white/80 border border-red-300 rounded-lg">
                        <h2 className="text-xl font-semibold text-red-700">Terjadi Kesalahan</h2>
                        <p className="text-red-600 mt-2">{error}</p>
                    </div>
                 );
            default:
                return null;
        }
    };
    
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
            <main className="w-full max-w-2xl mx-auto flex flex-col items-center gap-6">
                <header className="text-center">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.3)' }}>
                        Video Compressor <span className="text-brand-green">untuk WhatsApp</span>
                    </h1>
                    <p className="mt-2 text-md text-gray-200 max-w-prose" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.2)' }}>
                        Kompres video Anda agar tetap HD saat diunggah ke Story WhatsApp. Cepat, mudah, dan langsung di browser Anda.
                    </p>
                </header>
                <div className="w-full bg-white/50 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-2xl border border-white/30 min-h-[20rem] flex items-center justify-center">
                    {renderContent()}
                </div>
                 {error && appState !== AppState.ERROR && (
                    <p className="text-red-100 bg-red-800/50 px-4 py-2 rounded-md text-sm mt-2">{error}</p>
                )}
                <footer className="text-center text-white/70 text-sm mt-4">
                    <p>Ditenagai oleh FFMPEG.wasm. Privasi Anda terjamin, video tidak pernah diunggah ke server.</p>
                </footer>
            </main>
        </div>
    );
};

export default App;
