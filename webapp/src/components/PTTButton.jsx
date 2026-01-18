import React, { useState, useRef } from 'react';
import api from '../services/api';
import socketService from '../services/socket';

export default function PTTButton({ roomCode, onResult, onProcessing, disabled }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessingLocal] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        await processRecording();
      };

      mediaRecorder.start();
      setRecording(true);
      socketService.startSpeaking();
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('No se pudo acceder al microfono. Verifica los permisos.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      socketService.stopSpeaking();
    }
  }

  async function processRecording() {
    if (chunksRef.current.length === 0) return;

    setProcessingLocal(true);
    onProcessing(true);

    try {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const response = await api.sendVoice(roomCode, audioBlob);
      onResult(response);
    } catch (err) {
      console.error('Error processing voice:', err);
      alert('Error al procesar audio: ' + err.message);
    } finally {
      setProcessingLocal(false);
      onProcessing(false);
      chunksRef.current = [];
    }
  }

  function handleTouchStart(e) {
    e.preventDefault();
    if (!disabled && !processing) {
      startRecording();
    }
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    if (recording) {
      stopRecording();
    }
  }

  function handleMouseDown(e) {
    if (!disabled && !processing && e.button === 0) {
      startRecording();
    }
  }

  function handleMouseUp() {
    if (recording) {
      stopRecording();
    }
  }

  function handleMouseLeave() {
    if (recording) {
      stopRecording();
    }
  }

  return (
    <button
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      disabled={disabled || processing}
      className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all shrink-0 select-none ${
        recording
          ? 'bg-gradient-to-br from-red-500 to-pink-500 scale-110 ptt-recording shadow-xl shadow-red-500/50'
          : processing
          ? 'bg-gradient-to-br from-yellow-500 to-amber-500'
          : disabled
          ? 'bg-gray-700 opacity-50 cursor-not-allowed'
          : 'bg-gradient-to-br from-neon-purple to-neon-pink hover:scale-105 hover:shadow-lg hover:shadow-neon-purple/40 active:scale-95'
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* Glow effect */}
      <div className={`absolute inset-0 rounded-2xl blur-xl transition-opacity ${
        recording ? 'bg-red-500 opacity-50' : 'bg-neon-purple opacity-0'
      }`} />

      {/* Icon */}
      <div className="relative z-10">
        {processing ? (
          <div className="spinner" />
        ) : recording ? (
          <div className="relative">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="6" />
            </svg>
            {/* Pulse rings */}
            <div className="absolute inset-0 -m-2 rounded-full border-2 border-white/50 animate-ping" />
          </div>
        ) : (
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </div>

      {/* Label */}
      {!processing && !recording && !disabled && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap font-medium">
          Mantener
        </div>
      )}
    </button>
  );
}
