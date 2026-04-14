import React, { useState, useCallback } from 'react';
import { FileText, Upload, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { storage, ref, uploadBytesResumable, getDownloadURL } from '../firebase';
import { processPDFWithAI } from '../services/aiService';
import { UserRole, Project } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface ReportPDFUploaderProps {
  project: Project;
  discipline: UserRole;
  onDataExtracted: (data: any, pdfUrl: string) => void;
}

export default function ReportPDFUploader({ project, discipline, onDataExtracted }: ReportPDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState('');

  const handleFile = useCallback(async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') {
      setError('Please upload a PDF file only.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setStatus('uploading');
    setCurrentStep('Uploading PDF to secure storage...');

    const date = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const storagePath = `reports/${project.id}/${discipline}/${date}/${timestamp}_${selectedFile.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, selectedFile);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (err) => {
        console.error('Upload error:', err);
        setError('Failed to upload PDF. Please check your connection.');
        setStatus('error');
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        setStatus('processing');
        setCurrentStep('AI is reading your report...');
        
        try {
          // Small delay to simulate "scanning" effect and ensure stability
          await new Promise(resolve => setTimeout(resolve, 1500));
          setCurrentStep('Extracting data fields...');
          
          const extractedData = await processPDFWithAI(selectedFile, discipline, project);
          
          setStatus('done');
          setCurrentStep('Data extracted successfully!');
          onDataExtracted(extractedData, downloadURL);
        } catch (err: any) {
          console.error('AI Processing error:', err);
          setError(err.message || 'AI failed to process the PDF. You may need to fill the form manually.');
          setStatus('error');
        }
      }
    );
  }, [project.id, discipline, onDataExtracted]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFile(selectedFile);
  };

  const reset = () => {
    setFile(null);
    setStatus('idle');
    setError(null);
    setUploadProgress(0);
    setCurrentStep('');
  };

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {status === 'idle' || status === 'error' ? (
          <motion.div
            key="upload-area"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById('pdf-upload-input')?.click()}
              className={`
                border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer
                ${isDragging ? 'border-emerald-500 bg-emerald-500/5' : 'border-neutral-700 bg-neutral-900/50 hover:border-emerald-500/50'}
                ${status === 'error' ? 'border-red-500/50 bg-red-500/5' : ''}
              `}
            >
              <input
                id="pdf-upload-input"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={onFileSelect}
              />
              <FileText className={`w-12 h-12 mx-auto mb-4 ${status === 'error' ? 'text-red-500' : 'text-neutral-600'}`} />
              <p className="text-sm font-bold text-white">
                {status === 'error' ? 'Upload Failed' : 'Drop PDF Report Here'}
              </p>
              <p className="text-xs text-neutral-500 mt-1">or click to browse</p>
              <p className="text-[10px] text-neutral-600 mt-3 font-mono uppercase">
                PDF only • Max 10MB • AI will auto-fill your form
              </p>
            </div>
            {error && (
              <div className="mt-3 flex items-center gap-2 text-red-500 text-xs bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
                <button onClick={reset} className="ml-auto text-white hover:underline">Retry</button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="processing-area"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-8 text-center space-y-6"
          >
            <div className="relative w-24 h-24 mx-auto">
              {status === 'uploading' && (
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-neutral-800"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="44"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={276}
                    strokeDashoffset={276 - (276 * uploadProgress) / 100}
                    className="text-emerald-500 transition-all duration-300"
                  />
                </svg>
              )}
              {status === 'processing' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
                  <motion.div 
                    initial={{ top: 0 }}
                    animate={{ top: '100%' }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] z-10"
                  />
                </div>
              )}
              {status === 'done' && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 flex items-center justify-center bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle2 className="w-12 h-12 text-black" />
                </motion.div>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText className={`w-10 h-10 ${status === 'done' ? 'hidden' : 'text-white'}`} />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">
                {status === 'uploading' ? 'Uploading Report...' : 
                 status === 'processing' ? 'AI Processing...' : 'Extraction Complete!'}
              </h3>
              <p className="text-sm text-neutral-400">{currentStep}</p>
            </div>

            {status === 'uploading' && (
              <div className="w-full bg-neutral-800 rounded-full h-1.5 max-w-xs mx-auto">
                <div 
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {status === 'done' && (
              <button
                onClick={reset}
                className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-bold rounded-xl transition-all"
              >
                Upload Another
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
