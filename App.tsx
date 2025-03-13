import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Button, ScrollView, ActivityIndicator, Platform, SafeAreaView, KeyboardAvoidingView, Alert, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { VOICES } from './kokoro/voices';
import KokoroOnnx from './kokoro/kokoroOnnx';

// Model URL from Hugging Face
const MODEL_URL = 'https://huggingface.co/onnx-community/Kokoro-82M-ONNX/resolve/main/onnx/model_q8f16.onnx';
const MODEL_FILENAME = 'model_q8f16.onnx';
const MODEL_LOCAL_PATH = FileSystem.cacheDirectory + MODEL_FILENAME;

export default function App() {
  const [text, setText] = useState("Hello, this is a test of the Kokoro text to speech system running on Expo with ONNX Runtime.");
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Loading TTS Model...');
  const [availableVoices, setAvailableVoices] = useState<string[]>(Object.keys(VOICES));
  const [selectedVoice, setSelectedVoice] = useState<string>("af_heart");
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1.0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isModelDownloaded, setIsModelDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isModelInitialized, setIsModelInitialized] = useState(false);
  const [isVoiceDownloading, setIsVoiceDownloading] = useState(false);
  const [downloadedVoices, setDownloadedVoices] = useState<Set<string>>(new Set());

  // Check if model is already downloaded
  useEffect(() => {
    checkIfModelExists();
    checkDownloadedVoices();
  }, []);

  // Initialize audio
  useEffect(() => {
    async function setupAudio() {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    }
    
    setupAudio();
    
    return () => {
      // Clean up sound when component unmounts
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  // Initialize model when downloaded
  useEffect(() => {
    if (isModelDownloaded && !isModelInitialized) {
      initializeModel();
    }
  }, [isModelDownloaded]);

  const checkIfModelExists = async () => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(MODEL_LOCAL_PATH);
      setIsModelDownloaded(fileInfo.exists);
      if (fileInfo.exists) {
        console.log('Model already downloaded at:', MODEL_LOCAL_PATH);
      } else {
        console.log('Model not found locally');
      }
    } catch (err) {
      console.error('Error checking if model exists:', err);
      setError('Error checking if model exists');
    }
  };

  const checkDownloadedVoices = async () => {
    try {
      const voiceDirPath = `${FileSystem.documentDirectory}voices`;
      const dirInfo = await FileSystem.getInfoAsync(voiceDirPath);
      
      if (!dirInfo.exists) {
        return;
      }
      
      const voiceFiles = await FileSystem.readDirectoryAsync(voiceDirPath);
      const voices = new Set<string>();
      
      voiceFiles.forEach(file => {
        if (file.endsWith('.bin')) {
          const voiceId = file.replace('.bin', '');
          voices.add(voiceId);
        }
      });
      
      setDownloadedVoices(voices);
      console.log('Downloaded voices:', voices);
    } catch (err) {
      console.error('Error checking downloaded voices:', err);
    }
  };

  const downloadModel = async () => {
    if (isModelDownloaded) {
      Alert.alert('Model already downloaded', 'The model is already installed on your device.');
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      setError(null);

      const downloadResumable = FileSystem.createDownloadResumable(
        MODEL_URL,
        MODEL_LOCAL_PATH,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          setDownloadProgress(progress);
        }
      );

      const { uri } = await downloadResumable.downloadAsync();
      
      if (uri) {
        setIsModelDownloaded(true);
        Alert.alert('Success', 'Model downloaded successfully!');
      }
    } catch (err) {
      console.error('Error downloading model:', err);
      setError('Error downloading model. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadVoice = async () => {
    if (downloadedVoices.has(selectedVoice)) {
      Alert.alert('Voice already downloaded', `The voice "${VOICES[selectedVoice].name}" is already installed on your device.`);
      return;
    }

    try {
      setIsVoiceDownloading(true);
      setError(null);
      
      const success = await KokoroOnnx.downloadVoice(selectedVoice);
      
      if (success) {
        setDownloadedVoices(prev => new Set([...prev, selectedVoice]));
        Alert.alert('Success', `Voice "${VOICES[selectedVoice].name}" downloaded successfully!`);
      } else {
        setError(`Failed to download voice "${VOICES[selectedVoice].name}". Please try again.`);
      }
    } catch (err) {
      console.error('Error downloading voice:', err);
      setError('Error downloading voice. Please try again.');
    } finally {
      setIsVoiceDownloading(false);
    }
  };

  const initializeModel = async () => {
    try {
      setIsModelLoading(true);
      setLoadingMessage('Initializing TTS Model...');
      
      const success = await KokoroOnnx.loadModel();
      
      if (success) {
        setIsModelInitialized(true);
        setLoadingMessage('Model initialized successfully!');
      } else {
        setError('Failed to initialize model');
      }
    } catch (err) {
      console.error('Error initializing model:', err);
      setError('Error initializing model. Please try again.');
    } finally {
      setIsModelLoading(false);
    }
  };

  const generateSpeech = async () => {
    if (!isModelInitialized) {
      Alert.alert('Model not initialized', 'Please wait for the model to initialize or download it first.');
      return;
    }

    if (!downloadedVoices.has(selectedVoice)) {
      Alert.alert('Voice not downloaded', `Please download the "${VOICES[selectedVoice].name}" voice first.`);
      return;
    }

    try {
      setIsGeneratingAudio(true);
      setError(null);
      
      // Unload previous sound if exists
      if (sound) {
        await sound.unloadAsync();
      }
      
      // Generate new audio
      const newSound = await KokoroOnnx.generateAudio(text, selectedVoice, speed);
      setSound(newSound);
      
      // Play the sound
      await newSound.playAsync();
      
    } catch (err) {
      console.error('Error generating speech:', err);
      setError('Error generating speech. Please try again.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const playSound = async () => {
    if (!sound) {
      Alert.alert('No audio', 'Please generate audio first.');
      return;
    }

    try {
      // Get sound status
      const status = await sound.getStatusAsync();
      
      if (status.isLoaded) {
        if (status.isPlaying) {
          await sound.pauseAsync();
        } else {
          await sound.playAsync();
        }
      } else {
        Alert.alert('Audio not loaded', 'Please generate audio first.');
      }
    } catch (err) {
      console.error('Error playing sound:', err);
      setError('Error playing sound. Please try again.');
    }
  };

  const stopSound = async () => {
    if (!sound) return;
    
    try {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
    } catch (err) {
      console.error('Error stopping sound:', err);
    }
  };

  const adjustSpeed = (newSpeed: number) => {
    setSpeed(Math.max(0.5, Math.min(2.0, newSpeed)));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar style="auto" />
        
        <View style={styles.header}>
          <Text style={styles.title}>Kokoro TTS Demo</Text>
          <Text style={styles.subtitle}>Using Native ONNX Runtime</Text>
        </View>
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Model Download Section */}
          <View style={styles.modelSection}>
            <Text style={styles.sectionTitle}>Model Status</Text>
            <Text style={styles.modelStatus}>
              {isModelDownloaded ? 'Model is installed ✓' : 'Model needs to be downloaded'}
            </Text>
            
            {isDownloading ? (
              <View style={styles.downloadProgress}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={styles.progressText}>{`Downloading... ${Math.round(downloadProgress * 100)}%`}</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={[
                  styles.downloadButton, 
                  isModelDownloaded ? styles.downloadButtonDisabled : null
                ]} 
                onPress={downloadModel}
                disabled={isModelDownloaded}
              >
                <Text style={styles.downloadButtonText}>
                  {isModelDownloaded ? 'Model Installed' : 'Download Model'}
                </Text>
              </TouchableOpacity>
            )}
            
            {isModelLoading && (
              <View style={styles.downloadProgress}>
                <ActivityIndicator size="small" color="#0000ff" />
                <Text style={styles.progressText}>{loadingMessage}</Text>
              </View>
            )}
            
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
          
          {/* Text Input Section */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Text to Speak</Text>
            <TextInput
              style={styles.textInput}
              multiline
              value={text}
              onChangeText={setText}
              placeholder="Enter text to convert to speech"
            />
          </View>
          
          {/* Voice Selection Section */}
          <View style={styles.voiceSection}>
            <Text style={styles.sectionTitle}>Select Voice</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.voiceList}>
              {availableVoices.map((voice) => (
                <TouchableOpacity
                  key={voice}
                  style={[
                    styles.voiceButton,
                    selectedVoice === voice ? styles.selectedVoiceButton : null,
                    downloadedVoices.has(voice) ? styles.downloadedVoiceButton : null
                  ]}
                  onPress={() => setSelectedVoice(voice)}
                >
                  <Text 
                    style={[
                      styles.voiceButtonText,
                      selectedVoice === voice ? styles.selectedVoiceButtonText : null
                    ]}
                  >
                    {VOICES[voice].name}
                    {downloadedVoices.has(voice) ? ' ✓' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Voice Download Button */}
            {isVoiceDownloading ? (
              <View style={styles.downloadProgress}>
                <ActivityIndicator size="small" color="#0000ff" />
                <Text style={styles.progressText}>Downloading voice...</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={[
                  styles.voiceDownloadButton, 
                  downloadedVoices.has(selectedVoice) ? styles.downloadButtonDisabled : null
                ]} 
                onPress={downloadVoice}
                disabled={downloadedVoices.has(selectedVoice)}
              >
                <Text style={styles.downloadButtonText}>
                  {downloadedVoices.has(selectedVoice) 
                    ? `Voice "${VOICES[selectedVoice].name}" Installed` 
                    : `Download Voice "${VOICES[selectedVoice].name}"`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Speed Control Section */}
          <View style={styles.speedSection}>
            <Text style={styles.sectionTitle}>Speaking Speed: {speed.toFixed(1)}x</Text>
            <View style={styles.speedButtons}>
              <TouchableOpacity 
                style={styles.speedButton} 
                onPress={() => adjustSpeed(speed - 0.1)}
              >
                <Text style={styles.speedButtonText}>-</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.speedButton} 
                onPress={() => setSpeed(1.0)}
              >
                <Text style={styles.speedButtonText}>Reset</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.speedButton} 
                onPress={() => adjustSpeed(speed + 0.1)}
              >
                <Text style={styles.speedButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Playback Controls */}
          <View style={styles.playbackSection}>
            {isGeneratingAudio ? (
              <View style={styles.generatingContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={styles.generatingText}>Generating audio...</Text>
              </View>
            ) : (
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={[
                    styles.playButton, 
                    (!isModelInitialized || !downloadedVoices.has(selectedVoice)) ? styles.buttonDisabled : null
                  ]} 
                  onPress={generateSpeech}
                  disabled={!isModelInitialized || !downloadedVoices.has(selectedVoice)}
                >
                  <Text style={styles.buttonText}>Generate & Play</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.controlButton, !sound ? styles.buttonDisabled : null]} 
                  onPress={playSound}
                  disabled={!sound}
                >
                  <Text style={styles.buttonText}>Play/Pause</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.controlButton, !sound ? styles.buttonDisabled : null]} 
                  onPress={stopSound}
                  disabled={!sound}
                >
                  <Text style={styles.buttonText}>Stop</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
     </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 30,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 15,
    minHeight: 120,
    fontSize: 16,
    marginBottom: 20,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  voiceSection: {
    marginBottom: 20,
  },
  inputSection: {
    marginBottom: 20,
  },
  speedSection: {
    marginBottom: 20,
  },
  playbackSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  voiceList: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  voiceButton: {
    marginRight: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedVoiceButton: {
    backgroundColor: '#4285F4',
    borderColor: '#2979FF',
  },
  downloadedVoiceButton: {
    borderColor: '#4CAF50',
  },
  voiceButtonText: {
    fontSize: 14,
    color: '#333',
  },
  selectedVoiceButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  speedContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  speedButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  speedButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  playButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  controlButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    height: 300,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
  loadingNote: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    marginVertical: 10,
    textAlign: 'center',
  },
  modelSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  modelStatus: {
    fontSize: 16,
    marginBottom: 15,
  },
  downloadButton: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  voiceDownloadButton: {
    backgroundColor: '#4285F4',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  downloadButtonDisabled: {
    backgroundColor: '#A4C2F4',
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  downloadProgress: {
    alignItems: 'center',
    marginVertical: 10,
  },
  progressText: {
    marginTop: 10,
    fontSize: 14,
  },
  generatingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  generatingText: {
    marginTop: 10,
    fontSize: 16,
  },
}); 