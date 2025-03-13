import * as FileSystem from 'expo-file-system';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { Audio } from 'expo-av';
import { VOICES, getVoiceData } from './voices';
import { Platform } from 'react-native';

// Constants
const SAMPLE_RATE = 24000;
const STYLE_DIM = 256;
const MAX_PHONEME_LENGTH = 510;

// Model paths
const MODEL_FILENAME = 'model_q8f16.onnx';
const MODEL_PATH = FileSystem.cacheDirectory + MODEL_FILENAME;

// Voice data URL
const VOICE_DATA_URL = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices";

// Simplified vocabulary for tokenization
// This is a simplified version of the Python VOCAB
const VOCAB = {
  // Basic punctuation
  ' ': 6, ',': 2, '.': 3, '!': 4, '?': 5, 
  // Some common phonemes (simplified for this example)
  'a': 33, 'b': 34, 'c': 35, 'd': 36, 'e': 37, 'f': 38, 'g': 39, 'h': 40, 
  'i': 41, 'j': 42, 'k': 43, 'l': 44, 'm': 45, 'n': 46, 'o': 47, 'p': 48, 
  'q': 49, 'r': 50, 's': 51, 't': 52, 'u': 53, 'v': 54, 'w': 55, 'x': 56, 
  'y': 57, 'z': 58,
  // Add more phonemes as needed
};

class KokoroOnnx {
  constructor() {
    this.session = null;
    this.isModelLoaded = false;
    this.voiceCache = new Map();
    this.isOnnxAvailable = true;
  }

  /**
   * Check if ONNX runtime is available on this platform
   * @returns {boolean} Whether ONNX runtime is available
   */
  checkOnnxAvailability() {
    try {
      // Check if InferenceSession is defined and has the create method
      if (typeof InferenceSession === 'undefined' || typeof InferenceSession.create !== 'function') {
        console.error('ONNX Runtime is not properly initialized');
        this.isOnnxAvailable = false;
        return false;
      }
      
      // Additional platform-specific checks
      if (Platform.OS === 'web') {
        console.warn('ONNX Runtime may not be fully supported on web platform');
      }
      
      this.isOnnxAvailable = true;
      return true;
    } catch (error) {
      console.error('Error checking ONNX availability:', error);
      this.isOnnxAvailable = false;
      return false;
    }
  }

  /**
   * Load the ONNX model
   * @returns {Promise<boolean>} Whether the model was loaded successfully
   */
  async loadModel() {
    try {
      // First check if ONNX runtime is available
      if (!this.checkOnnxAvailability()) {
        console.error('ONNX Runtime is not available on this platform');
        return false;
      }
      
      // Check if model exists
      const fileInfo = await FileSystem.getInfoAsync(MODEL_PATH);
      if (!fileInfo.exists) {
        console.error('Model file not found at', MODEL_PATH);
        return false;
      }

      console.log('Creating inference session with model at:', MODEL_PATH);
      
      // Create inference session with explicit options
      const options = {
        executionProviders: ['cpuexecutionprovider'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'sequential'
      };
      
      try {
        // Try to create the session with options first
        this.session = await InferenceSession.create(MODEL_PATH, options);
      } catch (optionsError) {
        console.warn('Failed to create session with options, trying without options:', optionsError);
        // Fallback to creating session without options
        this.session = await InferenceSession.create(MODEL_PATH);
      }
      
      if (!this.session) {
        console.error('Failed to create inference session');
        return false;
      }
      
      this.isModelLoaded = true;
      console.log('Model loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading model:', error);
      
      // Provide more detailed error information
      if (error.message && error.message.includes('binding')) {
        console.error('ONNX Runtime binding error. This may be due to incompatibility with the current platform.');
      }
      
      return false;
    }
  }

  /**
   * Download a voice file if it doesn't exist locally
   * @param {string} voiceId The voice ID to download
   * @returns {Promise<boolean>} Whether the voice was downloaded successfully
   */
  async downloadVoice(voiceId) {
    try {
      // Check if voice directory exists
      const voiceDirPath = `${FileSystem.documentDirectory}voices`;
      const dirInfo = await FileSystem.getInfoAsync(voiceDirPath);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(voiceDirPath, { intermediates: true });
      }
      
      // Check if voice file exists
      const voiceFilePath = `${voiceDirPath}/${voiceId}.bin`;
      const fileInfo = await FileSystem.getInfoAsync(voiceFilePath);
      
      if (fileInfo.exists) {
        console.log(`Voice ${voiceId} already exists locally`);
        return true;
      }
      
      // Download voice file
      const voiceUrl = `${VOICE_DATA_URL}/${voiceId}.bin`;
      console.log(`Downloading voice from ${voiceUrl}`);
      
      const downloadResult = await FileSystem.downloadAsync(
        voiceUrl,
        voiceFilePath
      );
      
      if (downloadResult.status === 200) {
        console.log(`Voice ${voiceId} downloaded successfully`);
        return true;
      } else {
        console.error(`Failed to download voice ${voiceId}: ${downloadResult.status}`);
        return false;
      }
    } catch (error) {
      console.error(`Error downloading voice ${voiceId}:`, error);
      return false;
    }
  }

  /**
   * Simple tokenization function (placeholder for the actual phonemization)
   * In a real implementation, this would use a proper phonemizer
   * @param {string} text The input text
   * @returns {number[]} Tokenized input
   */
  tokenize(text) {
    // This is a simplified tokenization - in a real implementation,
    // you would use a proper phonemizer like in the Python code
    const tokens = [];
    
    // Add start token (0)
    tokens.push(0);
    
    // Convert each character to a token if it exists in VOCAB
    for (const char of text.toLowerCase()) {
      if (VOCAB[char] !== undefined) {
        tokens.push(VOCAB[char]);
      }
    }
    
    // Add end token (0)
    tokens.push(0);
    
    return tokens;
  }

  /**
   * Generate audio from text
   * @param {string} text The input text
   * @param {string} voiceId The voice ID to use
   * @param {number} speed The speaking speed (0.5-2.0)
   * @returns {Promise<Audio.Sound>} The generated audio as an Expo Audio Sound object
   */
  async generateAudio(text, voiceId = 'af_heart', speed = 1.0) {
    if (!this.isOnnxAvailable) {
      throw new Error('ONNX Runtime is not available on this platform');
    }
    
    if (!this.isModelLoaded) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    try {
      // Ensure voice is downloaded
      await this.downloadVoice(voiceId);
      
      // 1. Tokenize the input text
      const tokens = this.tokenize(text);
      const numTokens = Math.min(Math.max(tokens.length - 2, 0), 509);
      
      // 2. Get voice style data
      const voiceData = await getVoiceData(voiceId);
      const offset = numTokens * STYLE_DIM;
      const styleData = voiceData.slice(offset, offset + STYLE_DIM);
      
      // 3. Prepare input tensors - using regular arrays instead of Int64Array
      const inputs = {};
      
      try {
        // Try with Int32Array first (more compatible)
        inputs['input_ids'] = new Tensor('int64', new Int32Array(tokens), [1, tokens.length]);
      } catch (error) {
        console.warn('Failed to create int64 tensor with Int32Array, trying with regular array:', error);
        // Fallback to regular array
        inputs['input_ids'] = new Tensor('int64', tokens, [1, tokens.length]);
      }
      
      inputs['style'] = new Tensor('float32', new Float32Array(styleData), [1, STYLE_DIM]);
      inputs['speed'] = new Tensor('float32', new Float32Array([speed]), [1]);
      
      console.log('Running inference with inputs:', {
        tokens_length: tokens.length,
        style_length: styleData.length,
        speed
      });
      
      // 4. Run inference
      const outputs = await this.session.run(inputs);
      
      if (!outputs || !outputs['waveform'] || !outputs['waveform'].data) {
        throw new Error('Invalid output from model inference');
      }
      
      // 5. Process the output waveform
      const waveform = outputs['waveform'].data;
      console.log('Generated waveform with length:', waveform.length);
      
      // 6. Convert to audio buffer
      const audioUri = await this._floatArrayToAudioFile(waveform);
      
      // 7. Create and return an Expo Audio Sound object
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: false }
      );
      
      return sound;
    } catch (error) {
      console.error('Error generating audio:', error);
      throw error;
    }
  }

  /**
   * Convert a Float32Array to an audio file that can be played by Expo Audio
   * @param {Float32Array} floatArray The float array containing audio data
   * @returns {Promise<string>} URI to the temporary audio file
   */
  async _floatArrayToAudioFile(floatArray) {
    try {
      // 1. Convert float array to WAV format
      const wavBuffer = this._floatArrayToWav(floatArray, SAMPLE_RATE);
      
      // 2. Convert ArrayBuffer to base64 string
      const base64Data = this._arrayBufferToBase64(wavBuffer);
      
      // 3. Save to a temporary file
      const tempFilePath = `${FileSystem.cacheDirectory}temp_audio_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(
        tempFilePath, 
        base64Data, 
        { encoding: FileSystem.EncodingType.Base64 }
      );
      
      console.log('Audio saved to:', tempFilePath);
      return tempFilePath;
    } catch (error) {
      console.error('Error converting float array to audio file:', error);
      throw error;
    }
  }

  /**
   * Convert ArrayBuffer to base64 string
   * @param {ArrayBuffer} buffer The buffer to convert
   * @returns {string} Base64 string
   */
  _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert a Float32Array to a WAV buffer
   * @param {Float32Array} floatArray The float array containing audio data
   * @param {number} sampleRate The sample rate of the audio
   * @returns {ArrayBuffer} WAV buffer
   */
  _floatArrayToWav(floatArray, sampleRate) {
    // Convert float array to Int16Array (16-bit PCM)
    const numSamples = floatArray.length;
    const int16Array = new Int16Array(numSamples);
    
    for (let i = 0; i < numSamples; i++) {
      // Convert float in range [-1, 1] to int16 in range [-32768, 32767]
      int16Array[i] = Math.max(-32768, Math.min(32767, Math.floor(floatArray[i] * 32767)));
    }
    
    // Create WAV header
    const headerLength = 44;
    const dataLength = int16Array.length * 2; // 2 bytes per sample
    const buffer = new ArrayBuffer(headerLength + dataLength);
    const view = new DataView(buffer);
    
    // Write WAV header
    // "RIFF" chunk descriptor
    view.setUint8(0, 'R'.charCodeAt(0));
    view.setUint8(1, 'I'.charCodeAt(0));
    view.setUint8(2, 'F'.charCodeAt(0));
    view.setUint8(3, 'F'.charCodeAt(0));
    
    // Chunk size
    view.setUint32(4, 36 + dataLength, true);
    
    // "WAVE" format
    view.setUint8(8, 'W'.charCodeAt(0));
    view.setUint8(9, 'A'.charCodeAt(0));
    view.setUint8(10, 'V'.charCodeAt(0));
    view.setUint8(11, 'E'.charCodeAt(0));
    
    // "fmt " subchunk
    view.setUint8(12, 'f'.charCodeAt(0));
    view.setUint8(13, 'm'.charCodeAt(0));
    view.setUint8(14, 't'.charCodeAt(0));
    view.setUint8(15, ' '.charCodeAt(0));
    
    // Subchunk size
    view.setUint32(16, 16, true);
    
    // Audio format (PCM)
    view.setUint16(20, 1, true);
    
    // Number of channels
    view.setUint16(22, 1, true);
    
    // Sample rate
    view.setUint32(24, sampleRate, true);
    
    // Byte rate
    view.setUint32(28, sampleRate * 2, true);
    
    // Block align
    view.setUint16(32, 2, true);
    
    // Bits per sample
    view.setUint16(34, 16, true);
    
    // "data" subchunk
    view.setUint8(36, 'd'.charCodeAt(0));
    view.setUint8(37, 'a'.charCodeAt(0));
    view.setUint8(38, 't'.charCodeAt(0));
    view.setUint8(39, 'a'.charCodeAt(0));
    
    // Subchunk size
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    for (let i = 0; i < numSamples; i++) {
      view.setInt16(headerLength + i * 2, int16Array[i], true);
    }
    
    return buffer;
  }
}

export default new KokoroOnnx(); 