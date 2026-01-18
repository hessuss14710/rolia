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
      className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all shrink-0 select-none ${
        recording
          ? 'bg-red-500 scale-110 ptt-recording'
          : processing
          ? 'bg-yellow-500'
          : disabled
          ? 'bg-gray-600'
          : 'bg-rolia-600 hover:bg-rolia-500 active:scale-95'
      }`}
      style={{ touchAction: 'none' }}
    >
      {processing ? (
        <div className="spinner"></div>
      ) : recording ? (
        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="6" />
        </svg>
      ) : (
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      )}
    </button>
  );
}
