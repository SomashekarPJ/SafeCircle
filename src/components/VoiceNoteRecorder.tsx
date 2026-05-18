import React, { useState, useRef } from 'react';
import { Mic, Square, Play, Trash2, Heart, Check, Loader2 } from 'lucide-react';
import { uploadVoiceNote } from '../services/voiceNoteService';

interface VoiceNoteRecorderProps {
  userId: string;
  routineId: string;
  routineName: string;
  onUploaded: (url: string) => void;
}

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({ userId, routineId, routineName, onUploaded }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [senderName, setSenderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setSuccess(false);

      // Max 60 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          stopRecording();
        }
      }, 60000);
    } catch (err) {
      console.error('[Recorder] Error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSave = async () => {
    if (!audioBlob || !senderName) {
      alert("Please enter your name and record a message.");
      return;
    }
    
    setUploading(true);
    try {
      const url = await uploadVoiceNote(userId, routineId, audioBlob, senderName);
      setSuccess(true);
      setAudioUrl(null);
      setAudioBlob(null);
      onUploaded(url);
    } catch (err) {
      console.error('[Recorder] Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 space-y-6">
      <div className="space-y-4">
        <h4 className="text-xl font-bold text-gray-900">Record a message for {routineName}</h4>
        <input 
          value={senderName}
          onChange={e => setSenderName(e.target.value)}
          placeholder="Your name (e.g. Emma, your granddaughter)"
          className="w-full p-4 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="flex flex-col items-center space-y-6">
        {!audioUrl && !isRecording && (
          <button 
            onClick={startRecording}
            className="h-20 w-20 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Mic className="h-8 w-8" />
          </button>
        )}

        {isRecording && (
          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-2 text-blue-500 font-bold animate-pulse">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <span>RECORDING...</span>
            </div>
            <button 
              onClick={stopRecording}
              className="h-20 w-20 rounded-full bg-ink-charcoal text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <Square className="h-8 w-8" />
            </button>
          </div>
        )}

        {audioUrl && !uploading && (
          <div className="w-full space-y-6">
            <audio src={audioUrl} controls className="w-full" />
            <div className="flex space-x-4">
              <button 
                onClick={() => setAudioUrl(null)}
                className="flex-1 flex items-center justify-center space-x-2 p-4 rounded-xl border border-gray-200 text-gray-500 font-bold"
              >
                <Trash2 className="h-5 w-5" />
                <span>Discard</span>
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 flex items-center justify-center space-x-2 p-4 rounded-xl bg-green-500 text-white font-bold shadow-lg"
              >
                <Check className="h-5 w-5" />
                <span>Save Message</span>
              </button>
            </div>
          </div>
        )}

        {uploading && (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            <p className="font-bold text-blue-500">Sending your love...</p>
          </div>
        )}

        {success && (
          <div className="flex flex-col items-center space-y-4 text-green-600">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <Heart className="h-8 w-8 fill-current" />
            </div>
            <p className="font-bold text-lg text-center">Your message has been saved! ❤️</p>
          </div>
        )}
      </div>
    </div>
  );
};
