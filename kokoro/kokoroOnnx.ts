import * as FileSystem from 'expo-file-system';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { Audio } from 'expo-av';
import { VOICES, getVoiceData } from './voices';
import { Platform } from 'react-native';
import { MODELS } from './models';

// Constants
const SAMPLE_RATE = 24000;
const STYLE_DIM = 256;
const MAX_PHONEME_LENGTH = 510;

// Voice data URL
const VOICE_DATA_URL = "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices";

// Complete vocabulary from Python code
const VOCAB = (() => {
  const _pad = "$";
  const _punctuation = ';:,.!?¡¿—…"«»"" ';
  const _letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const _letters_ipa = "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ";
  
  const symbols = [_pad, ..._punctuation.split(''), ..._letters.split(''), ..._letters_ipa.split('')];
  const dicts = {};
  
  for (let i = 0; i < symbols.length; i++) {
    dicts[symbols[i]] = i;
  }
  
  return dicts;
})();

// Common English phoneme mappings for basic phonemization
const ENGLISH_PHONEME_MAP = {
  'a': 'ə',
  'e': 'ɛ',
  'i': 'ɪ',
  'o': 'oʊ',
  'u': 'ʌ',
  'th': 'θ',
  'sh': 'ʃ',
  'ch': 'tʃ',
  'ng': 'ŋ',
  'j': 'dʒ',
  'r': 'ɹ',
  'er': 'ɝ',
  'ar': 'ɑɹ',
  'or': 'ɔɹ',
  'ir': 'ɪɹ',
  'ur': 'ʊɹ',
};

// Common word to phoneme mappings
const COMMON_WORD_PHONEMES = {
  'hello': 'hɛˈloʊ',
  'world': 'wˈɝld',
  'this': 'ðˈɪs',
  'is': 'ˈɪz',
  'a': 'ə',
  'test': 'tˈɛst',
  'of': 'ʌv',
  'the': 'ðə',
  'kokoro': 'kˈoʊkəɹoʊ',
  'text': 'tˈɛkst',
  'to': 'tˈuː',
  'speech': 'spˈiːtʃ',
  'system': 'sˈɪstəm',
  'running': 'ɹˈʌnɪŋ',
  'on': 'ˈɑːn',
  'expo': 'ˈɛkspoʊ',
  'with': 'wˈɪð',
  'onnx': 'ˈɑːnɛks',
  'runtime': 'ɹˈʌntaɪm',
};

class KokoroOnnx {
  constructor() {
    this.session = null;
    this.isModelLoaded = false;
    this.voiceCache = new Map();
    this.isOnnxAvailable = true;
    this.currentModelId = null;
    this.isStreaming = false;
    this.streamingSound = null;
    this.streamingStartTime = null;
    this.tokensProcessed = 0;
    this.tokensPerSecond = 0;
    this.timeToFirstToken = 0;
    this.streamingTokens = [];
    this.streamingPhonemes = "";
    this.streamingCallback = null;
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
   * Load a specific ONNX model
   * @param {string} modelId - The model ID to load
   * @returns {Promise<boolean>} Whether the model was loaded successfully
   */
  async loadModel(modelId = 'model_q8f16.onnx') {
    try {
      // First check if ONNX runtime is available
      if (!this.checkOnnxAvailability()) {
        console.error('ONNX Runtime is not available on this platform');
        return false;
      }
      
      // Check if model exists
      const modelPath = FileSystem.cacheDirectory + modelId;
      const fileInfo = await FileSystem.getInfoAsync(modelPath);
      if (!fileInfo.exists) {
        console.error('Model file not found at', modelPath);
        return false;
      }

      console.log('Creating inference session with model at:', modelPath);
      
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
        this.session = await InferenceSession.create(modelPath, options);
      } catch (optionsError) {
        console.warn('Failed to create session with options, trying without options:', optionsError);
        // Fallback to creating session without options
        this.session = await InferenceSession.create(modelPath);
      }
      
      if (!this.session) {
        console.error('Failed to create inference session');
        return false;
      }
      
      this.isModelLoaded = true;
      this.currentModelId = modelId;
      console.log('Model loaded successfully:', modelId);
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
   * Get the currently loaded model ID
   * @returns {string|null} The current model ID or null if no model is loaded
   */
  getCurrentModelId() {
    return this.currentModelId;
  }

  /**
   * Get the current tokens per second rate
   * @returns {number} Tokens per second
   */
  getTokensPerSecond() {
    return this.tokensPerSecond;
  }

  /**
   * Get the time to first token in milliseconds
   * @returns {number} Time to first token in ms
   */
  getTimeToFirstToken() {
    return this.timeToFirstToken;
  }

  /**
   * Check if audio is currently streaming
   * @returns {boolean} Whether audio is streaming
   */
  isAudioStreaming() {
    return this.isStreaming;
  }

  /**
   * Get the current streaming phonemes
   * @returns {string} Current phonemes being processed
   */
  getStreamingPhonemes() {
    return this.streamingPhonemes;
  }

  /**
   * Stop the current streaming audio
   * @returns {Promise<void>}
   */
  async stopStreaming() {
    if (this.streamingSound) {
      try {
        await this.streamingSound.stopAsync();
        await this.streamingSound.unloadAsync();
      } catch (error) {
        console.error('Error stopping streaming audio:', error);
      }
      this.streamingSound = null;
    }
    this.isStreaming = false;
    this.streamingStartTime = null;
    this.tokensProcessed = 0;
    this.tokensPerSecond = 0;
    this.timeToFirstToken = 0;
    this.streamingTokens = [];
    this.streamingPhonemes = "";
    this.streamingCallback = null;
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
   * Normalize text for phonemization
   * @param {string} text The input text
   * @returns {string} Normalized text
   */
  normalizeText(text) {
    // Remove leading/trailing whitespace
    text = text.trim();
    
    // Replace multiple spaces with a single space
    text = text.replace(/\s+/g, ' ');
    
    // Replace curly quotes with straight quotes
    text = text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
    
    // Replace other special characters
    text = text.replace(/…/g, '...');
    
    return text;
  }

  /**
   * Basic phonemization function
   * @param {string} text The input text
   * @returns {string} Phonemized text
   */
  phonemize(text) {
    // Normalize the text first
    text = this.normalizeText(text);
    
    // Split text into words
    const words = text.split(/\s+/);
    
    // Phonemize each word
    const phonemizedWords = words.map(word => {
      // Check if we have a pre-defined phoneme for this word
      const lowerWord = word.toLowerCase().replace(/[.,!?;:'"]/g, '');
      if (COMMON_WORD_PHONEMES[lowerWord]) {
        return COMMON_WORD_PHONEMES[lowerWord];
      }
      
      // Otherwise, do a simple character-by-character phonemization
      let phonemes = '';
      let i = 0;
      
      while (i < word.length) {
        // Check for digraphs (two-letter phonemes)
        if (i < word.length - 1) {
          const digraph = word.substring(i, i + 2).toLowerCase();
          if (ENGLISH_PHONEME_MAP[digraph]) {
            phonemes += ENGLISH_PHONEME_MAP[digraph];
            i += 2;
            continue;
          }
        }
        
        // Check for single character phonemes
        const char = word[i].toLowerCase();
        if (ENGLISH_PHONEME_MAP[char]) {
          phonemes += ENGLISH_PHONEME_MAP[char];
        } else if (/[a-z]/.test(char)) {
          // For other alphabetic characters, just use the character itself
          phonemes += char;
        } else if (/[.,!?;:'"]/g.test(char)) {
          // For punctuation, keep it as is
          phonemes += char;
        }
        
        i++;
      }
      
      // Add stress marker to the first syllable if the word is long enough
      if (phonemes.length > 2 && !/[.,!?;:'"]/g.test(phonemes)) {
        // Find the first vowel
        const firstVowelMatch = phonemes.match(/[ɑɐɒæəɘɚɛɜɝɞɨɪʊʌɔoeiuaɑː]/);
        if (firstVowelMatch) {
          const vowelIndex = firstVowelMatch.index;
          phonemes = phonemes.substring(0, vowelIndex) + 'ˈ' + phonemes.substring(vowelIndex);
        }
      }
      
      return phonemes;
    });
    
    // Join the phonemized words with spaces
    return phonemizedWords.join(' ');
  }

  /**
   * Tokenize phonemized text
   * @param {string} phonemes The phonemized text
   * @returns {number[]} Tokenized input
   */
  tokenize(phonemes) {
    // If input is regular text, phonemize it first
    if (!/[ɑɐɒæəɘɚɛɜɝɞɨɪʊʌɔˈˌː]/.test(phonemes)) {
      phonemes = this.phonemize(phonemes);
    }
    
    console.log('Phonemized text:', phonemes);
    this.streamingPhonemes = phonemes;
    
    const tokens = [];
    
    // Add start token (0)
    tokens.push(0);
    
    // Convert each character to a token if it exists in VOCAB
    for (const char of phonemes) {
      if (VOCAB[char] !== undefined) {
        tokens.push(VOCAB[char]);
      } else {
        console.warn(`Character not in vocabulary: "${char}" (code: ${char.charCodeAt(0)})`);
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
   * Generate and stream audio in real-time
   * @param {string} text The input text
   * @param {string} voiceId The voice ID to use
   * @param {number} speed The speaking speed (0.5-2.0)
   * @param {function} onProgress Callback for streaming progress updates
   * @returns {Promise<void>}
   */
  async streamAudio(text, voiceId = 'af_heart', speed = 1.0, onProgress = null) {
    if (this.isStreaming) {
      await this.stopStreaming();
    }

    if (!this.isOnnxAvailable) {
      throw new Error('ONNX Runtime is not available on this platform');
    }
    
    if (!this.isModelLoaded) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    try {
      this.isStreaming = true;
      this.streamingStartTime = Date.now();
      this.tokensProcessed = 0;
      this.timeToFirstToken = 0;
      this.streamingTokens = [];
      this.streamingPhonemes = "";
      this.streamingCallback = onProgress;
      
      // Ensure voice is downloaded
      await this.downloadVoice(voiceId);
      
      // 1. Tokenize the input text
      const tokens = this.tokenize(text);
      this.streamingTokens = tokens;
      const numTokens = Math.min(Math.max(tokens.length - 2, 0), 509);
      this.tokensProcessed = numTokens;
      
      // 2. Get voice style data
      const voiceData = await getVoiceData(voiceId);
      const offset = numTokens * STYLE_DIM;
      const styleData = voiceData.slice(offset, offset + STYLE_DIM);
      
      // 3. Prepare input tensors
      const inputs = {};
      
      try {
        inputs['input_ids'] = new Tensor('int64', new Int32Array(tokens), [1, tokens.length]);
      } catch (error) {
        inputs['input_ids'] = new Tensor('int64', tokens, [1, tokens.length]);
      }
      
      inputs['style'] = new Tensor('float32', new Float32Array(styleData), [1, STYLE_DIM]);
      inputs['speed'] = new Tensor('float32', new Float32Array([speed]), [1]);
      
      // Start timing for tokens per second calculation and time to first token
      const inferenceStartTime = Date.now();
      
      // 4. Run inference
      const outputs = await this.session.run(inputs);
      
      // Calculate time to first token
      this.timeToFirstToken = Date.now() - inferenceStartTime;
      
      // Calculate tokens per second
      const inferenceEndTime = Date.now();
      const inferenceTimeSeconds = (inferenceEndTime - inferenceStartTime) / 1000;
      this.tokensPerSecond = inferenceTimeSeconds > 0 ? numTokens / inferenceTimeSeconds : 0;
      
      if (!outputs || !outputs['waveform'] || !outputs['waveform'].data) {
        throw new Error('Invalid output from model inference');
      }
      
      // 5. Process the output waveform
      const waveform = outputs['waveform'].data;
      
      // 6. Convert to audio buffer and start streaming
      const audioUri = await this._floatArrayToAudioFile(waveform);
      
      // 7. Create and play the sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true },
        (status) => {
          // Provide progress updates
          if (onProgress && status.isLoaded) {
            const progress = status.positionMillis / status.durationMillis;
            onProgress({
              progress,
              tokensPerSecond: this.tokensPerSecond,
              timeToFirstToken: this.timeToFirstToken,
              position: status.positionMillis,
              duration: status.durationMillis,
              phonemes: this.streamingPhonemes
            });
          }
          
          // Clean up when playback finishes
          if (status.didJustFinish) {
            this.isStreaming = false;
            this.streamingSound = null;
          }
        }
      );
      
      this.streamingSound = sound;
      
      // Return the tokens per second for immediate feedback
      return {
        tokensPerSecond: this.tokensPerSecond,
        timeToFirstToken: this.timeToFirstToken,
        totalTokens: numTokens
      };
    } catch (error) {
      this.isStreaming = false;
      console.error('Error streaming audio:', error);
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

// Create a singleton instance
const kokoroInstance = new KokoroOnnx();

// Export the singleton instance
export default kokoroInstance; 