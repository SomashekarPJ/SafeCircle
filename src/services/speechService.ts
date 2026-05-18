
/**
 * Simple Speech Service using Web Speech API
 */

export const speechService = {
  speak: (text: string) => {
    if (!window.speechSynthesis) return;

    // Cancel any existing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Find a gentle, natural sounding voice if possible
    const voices = window.speechSynthesis.getVoices();
    // Prefer Google UK English Female or similar if available
    const preferredVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Google UK English Female') || v.name.includes('Samantha'));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.pitch = 1.0;
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  },

  stop: () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
};
