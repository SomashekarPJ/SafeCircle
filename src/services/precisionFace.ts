import { identifyPersonFromImage } from './aiService';
import { Person } from '../types';

interface RecognitionResult {
  identified: boolean;
  name: string | null;
  confidence: number;
  message: string;
  shouldLearn: boolean;
  analysis?: string;
  enhancedImage?: string; // Added to allow saving the optimized frame
  quality?: {
    brightness: number;
    sharpness: number;
    isRejected: boolean;
    reason?: string;
  };
}

interface StabilizedState {
  currentIdentity: string | null;
  confidence: number;
  lastIdentifiedAt: number;
}

export class PrecisionFaceEngine {
  private history: string[] = [];
  private readonly MAX_HISTORY = 10; // Deeper history for production stability
  private readonly STABILITY_THRESHOLD = 0.6; 
  private isProcessing = false;
  private currentStabilizedResult: RecognitionResult | null = null;
  private consecutiveHighConfidence = 0;

  async processFrame(base64Frame: string, people: Person[]): Promise<RecognitionResult | null> {
    if (this.isProcessing) return this.currentStabilizedResult;
    
    // Step 1: Pre-process and Analyze Quality
    const { error, enhancedBase64, analysis, metrics } = await this.analyzeAndEnhance(base64Frame);
    
    if (error) {
      const result: RecognitionResult = {
        identified: false,
        name: null,
        confidence: 0,
        message: error,
        shouldLearn: false,
        analysis: "Fast pass rejected: " + error,
        quality: { ...metrics, isRejected: true, reason: error }
      };
      return result;
    }
    
    this.isProcessing = true;
    try {
      // Use enhanced frame for AI vision
      const result = await identifyPersonFromImage(enhancedBase64 || base64Frame, people);
      if (analysis) result.analysis = (result.analysis || "") + " | " + analysis;
      result.quality = { ...metrics, isRejected: false };
      result.enhancedImage = enhancedBase64 || base64Frame;
      
      // Step 6: Temporal Confidence Stabilization
      this.updateHistory(result.identified ? result.name : 'Unknown');
      const stabilizedName = this.getStabilizedResult();
      
      // Step 7: Adaptive Live Learning logic
      const isVeryStable = this.isIdentityStable();
      if (result.identified && result.confidence > 0.9 && isVeryStable) {
        this.consecutiveHighConfidence++;
        // If we've seen them clearly for 3 frames, suggest learning
        if (this.consecutiveHighConfidence >= 3) {
          result.shouldLearn = true;
        }
      } else {
        this.consecutiveHighConfidence = 0;
      }
      
      if (stabilizedName && stabilizedName !== 'Unknown' && stabilizedName !== result.name) {
        const person = people.find(p => p.name === stabilizedName);
        if (person) {
          this.currentStabilizedResult = {
            ...result,
            identified: true,
            name: person.name,
            confidence: 0.98, // Temporal boost
            message: `I recognize your ${person.relationship} ${person.name}.`,
            shouldLearn: result.shouldLearn // Propagate learning flag
          };
          return this.currentStabilizedResult;
        }
      }

      this.currentStabilizedResult = result;
      return result;
    } finally {
      this.isProcessing = false;
    }
  }

  private async analyzeAndEnhance(base64: string): Promise<{ error: string | null; enhancedBase64: string | null; analysis: string | null; metrics: { brightness: number; sharpness: number } }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve({ error: null, enhancedBase64: base64, analysis: null, metrics: { brightness: 0, sharpness: 0 } });

        // Use a better resolution for analysis and enhancement (400x400)
        const targetWidth = 400;
        const targetHeight = 400;
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        try {
          const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          const data = imageData.data;
          let brightness = 0;
          let totalDiff = 0;
          
          // Sample every 4th pixel for speed while maintaining high res for enhancement
          for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            brightness += luma;
            
            if (i + 4 < data.length) {
              const nextLuma = 0.2126 * data[i+4] + 0.7152 * data[i+5] + 0.0722 * data[i+6];
              totalDiff += Math.abs(luma - nextLuma);
            }
          }
          
          const samples = data.length / 16;
          brightness /= samples;
          const edgeSharpness = totalDiff / samples;
          
          let analysis = `Brightness: ${brightness.toFixed(1)}, Sharpness: ${edgeSharpness.toFixed(1)}`;
          const metrics = { brightness, sharpness: edgeSharpness };
          let enhancedBase64 = base64;
          let error = null;

          if (brightness < 20) { // Extremely forgiving
            error = "Environment too dark for reliable recognition.";
          } else if (brightness > 252) {
            error = "Excessive glare detected. Please adjust lighting.";
          } else if (edgeSharpness < 1.0) { // Very forgiving on blur to solve "blur bug"
            error = "Motion blur detected. Please hold still.";
          }

          // Step 1: Adaptive Contrast Enhancement for Low Light (25-100 brightness)
          if (!error && brightness < 100) {
            analysis += " | Applied Adaptive Gain (Low Light)";
            ctx.filter = 'contrast(1.5) brightness(1.2) saturate(1.2)';
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            enhancedBase64 = canvas.toDataURL('image/jpeg', 0.82);
          } else if (!error) {
            // Even in good light, send the 400x400 optimized version
            enhancedBase64 = canvas.toDataURL('image/jpeg', 0.82);
          }

          resolve({ error, enhancedBase64, analysis, metrics });
        } catch (e) {
          resolve({ error: null, enhancedBase64: base64, analysis: "Analysis failed", metrics: { brightness: 0, sharpness: 0 } });
        }
      };
      img.onerror = () => resolve({ error: "Failed to load frame image", enhancedBase64: null, analysis: null, metrics: { brightness: 0, sharpness: 0 } });
      img.src = base64;
    });
  }

  private isIdentityStable(): boolean {
    if (this.history.length < 5) return false;
    const last = this.history[this.history.length - 1];
    return this.history.slice(-3).every(h => h === last && h !== 'Unknown');
  }

  private updateHistory(name: string | null) {
    const entry = name || 'Unknown';
    this.history.push(entry);
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }
  }

  private getStabilizedResult(): string | null {
    if (this.history.length < 3) return null;
    
    const counts: Record<string, number> = {};
    for (const name of this.history) {
      counts[name] = (counts[name] || 0) + 1;
    }
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const [topName, count] = sorted[0];
    
    // Require at least 60% consistency
    if (count / this.history.length >= 0.6) {
      return topName;
    }
    
    return 'Unknown';
  }

  reset() {
    this.history = [];
    this.isProcessing = false;
  }
}

export const precisionFaceEngine = new PrecisionFaceEngine();
