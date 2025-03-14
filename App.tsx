import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Button, ScrollView, ActivityIndicator, Platform, SafeAreaView, KeyboardAvoidingView, Alert, TouchableOpacity, Modal, FlatList, Slider } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { VOICES } from './kokoro/voices';
import KokoroOnnx from './kokoro/kokoroOnnx';
import { MODELS, downloadModel, isModelDownloaded, getDownloadedModels, deleteModel } from './kokoro/models';

// Default model
const DEFAULT_MODEL_ID = 'model_q8f16.onnx';

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
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_MODEL_ID);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [tokensPerSecond, setTokensPerSecond] = useState(0);
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamDuration, setStreamDuration] = useState(0);
  const [streamPosition, setStreamPosition] = useState(0);
  const [timeToFirstToken, setTimeToFirstToken] = useState(0);
  const [streamingPhonemes, setStreamingPhonemes] = useState("");

  // Check if model is already downloaded
  useEffect(() => {
    checkDownloadedModels();
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
    if (downloadedModels.length > 0 && !isModelInitialized) {
      initializeModel(selectedModelId);
    }
  }, [downloadedModels]);

  const checkDownloadedModels = async () => {
    try {
      const models = await getDownloadedModels();
      setDownloadedModels(models);
      
      if (models.length > 0) {
        // If the default model is downloaded, select it
        if (models.includes(DEFAULT_MODEL_ID)) {
          setSelectedModelId(DEFAULT_MODEL_ID);
        } else {
          // Otherwise select the first downloaded model
          setSelectedModelId(models[0]);
        }
        setIsModelDownloaded(true);
      } else {
        setIsModelDownloaded(false);
      }
    } catch (err) {
      console.error('Error checking downloaded models:', err);
      setError('Error checking downloaded models');
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

  const downloadSelectedModel = async () => {
    if (isDownloading) {
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      setError(null);

      const success = await downloadModel(selectedModelId, (progress) => {
        setDownloadProgress(progress);
      });

      if (success) {
        setDownloadedModels(prev => [...prev, selectedModelId]);
        Alert.alert('Success', `Model ${MODELS[selectedModelId].name} downloaded successfully!`);
      } else {
        setError(`Failed to download model ${MODELS[selectedModelId].name}. Please try again.`);
      }
    } catch (err) {
      console.error('Error downloading model:', err);
      setError('Error downloading model. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const deleteSelectedModel = async (modelId: string) => {
    try {
      // Don't delete the currently loaded model
      if (modelId === currentModelId) {
        Alert.alert('Cannot Delete', 'Cannot delete the currently loaded model. Please load a different model first.');
        return;
      }

      const success = await deleteModel(modelId);
      
      if (success) {
        setDownloadedModels(prev => prev.filter(id => id !== modelId));
        Alert.alert('Success', `Model ${MODELS[modelId].name} deleted successfully!`);
      } else {
        setError(`Failed to delete model ${MODELS[modelId].name}. Please try again.`);
      }
    } catch (err) {
      console.error('Error deleting model:', err);
      setError('Error deleting model. Please try again.');
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

  const initializeModel = async (modelId: string) => {
    try {
      setIsModelLoading(true);
      setLoadingMessage(`Initializing ${MODELS[modelId].name} model...`);
      
      const success = await KokoroOnnx.loadModel(modelId);
      
      if (success) {
        setIsModelInitialized(true);
        setCurrentModelId(modelId);
        setLoadingMessage('Model initialized successfully!');
      } else {
        setError(`Failed to initialize model ${MODELS[modelId].name}`);
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
      
      // Stop any existing streaming audio
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      
      setIsStreaming(true);
      setStreamProgress(0);
      setTokensPerSecond(0);
      setTimeToFirstToken(0);
      setStreamingPhonemes("");
      
      // Generate and stream audio
      const result = await KokoroOnnx.streamAudio(
        text,
        selectedVoice,
        speed,
        (status) => {
          setStreamProgress(status.progress);
          setTokensPerSecond(status.tokensPerSecond);
          setStreamPosition(status.position);
          setStreamDuration(status.duration);
          setStreamingPhonemes(status.phonemes);
        }
      );
      
      // Update initial metrics
      setTokensPerSecond(result.tokensPerSecond);
      setTimeToFirstToken(result.timeToFirstToken);
      
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
    if (!sound) {
      return;
    }

    try {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
    } catch (err) {
      console.error('Error stopping sound:', err);
      setError('Error stopping sound. Please try again.');
    }
  };

  const renderModelItem = ({ item }: { item: string }) => {
    const model = MODELS[item];
    const isDownloaded = downloadedModels.includes(item);
    const isSelected = item === selectedModelId;
    const isLoaded = item === currentModelId;
    
    return (
      <View style={[
        styles.modelItem, 
        isSelected && styles.selectedModelItem,
        isLoaded && styles.loadedModelItem
      ]}>
        <TouchableOpacity 
          style={styles.modelItemContent}
          onPress={() => {
            setSelectedModelId(item);
            if (isDownloaded && !isLoaded) {
              setShowModelSelector(false);
              initializeModel(item);
            }
          }}
        >
          <View style={styles.modelItemHeader}>
            <Text style={styles.modelName}>{model.name}</Text>
            <Text style={styles.modelSize}>{model.size}</Text>
          </View>
          <Text style={styles.modelDescription}>{model.description}</Text>
          <View style={styles.modelItemFooter}>
            {isDownloaded ? (
              <>
                <Text style={styles.modelStatus}>
                  {isLoaded ? '✓ Currently Loaded' : '✓ Downloaded'}
                </Text>
                {!isLoaded && (
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => deleteSelectedModel(item)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <TouchableOpacity 
                style={styles.downloadButton}
                onPress={() => {
                  setShowModelSelector(false);
                  downloadSelectedModel();
                }}
              >
                <Text style={styles.downloadButtonText}>Download</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const SpeedSelector = () => (
    <View style={styles.speedSelectorContainer}>
      <View style={styles.speedControls}>
        <TouchableOpacity 
          style={styles.speedButton}
          onPress={() => setSpeed(Math.max(0.5, speed - 0.1))}
          disabled={speed <= 0.5}
        >
          <Text style={styles.speedButtonText}>-</Text>
        </TouchableOpacity>
        
        <View style={styles.speedValueContainer}>
          <Text style={styles.speedValue}>{speed.toFixed(1)}x</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.speedButton}
          onPress={() => setSpeed(Math.min(2.0, speed + 0.1))}
          disabled={speed >= 2.0}
        >
          <Text style={styles.speedButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView contentContainerStyle={styles.scrollView}>
        <StatusBar style="auto" />
        
        <View style={styles.header}>
          <Text style={styles.title}>Kokoro TTS Demo</Text>
            <Text style={styles.subtitle}>Text-to-Speech with ONNX Runtime</Text>
          </View>
          
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Model</Text>
            <View style={styles.modelSection}>
              <TouchableOpacity 
                style={styles.modelSelector}
                onPress={() => setShowModelSelector(true)}
              >
                <Text style={styles.modelSelectorText}>
                  {currentModelId ? MODELS[currentModelId].name : 'Select Model'}
                </Text>
                <Text style={styles.modelSelectorSubtext}>
                  {currentModelId ? MODELS[currentModelId].size : 'No model loaded'}
                </Text>
              </TouchableOpacity>
              
              {!isModelInitialized && downloadedModels.includes(selectedModelId) && (
                <TouchableOpacity 
                  style={styles.initButton}
                  onPress={() => initializeModel(selectedModelId)}
                  disabled={isModelLoading}
                >
                  <Text style={styles.buttonText}>Initialize</Text>
                </TouchableOpacity>
              )}
              
              {downloadedModels.length === 0 && (
                <TouchableOpacity 
                  style={styles.downloadButton}
                  onPress={downloadSelectedModel}
                  disabled={isDownloading}
                >
                  <Text style={styles.buttonText}>
                    {isDownloading ? 'Downloading...' : 'Download Model'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            {isDownloading && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${downloadProgress * 100}%` }]} />
                <Text style={styles.progressText}>{Math.round(downloadProgress * 100)}%</Text>
              </View>
            )}
            
            {isModelLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>{loadingMessage}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voice</Text>
            <View style={styles.voiceSelector}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {availableVoices.map((voiceId) => (
                  <TouchableOpacity
                    key={voiceId}
                    style={[
                      styles.voiceItem,
                      selectedVoice === voiceId && styles.selectedVoiceItem,
                      !downloadedVoices.has(voiceId) && styles.undownloadedVoiceItem
                    ]}
                    onPress={() => setSelectedVoice(voiceId)}
                  >
                    <Text style={styles.voiceName}>{VOICES[voiceId].name}</Text>
                    <Text style={styles.voiceGender}>{VOICES[voiceId].gender}</Text>
                    {!downloadedVoices.has(voiceId) && (
                      <Text style={styles.downloadIndicator}>↓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            
            {!downloadedVoices.has(selectedVoice) && (
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={downloadVoice}
                disabled={isVoiceDownloading}
              >
                <Text style={styles.buttonText}>
                  {isVoiceDownloading ? 'Downloading...' : `Download ${VOICES[selectedVoice].name} Voice`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Speed</Text>
            <SpeedSelector />
          </View>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Text</Text>
            <TextInput
              style={styles.textInput}
              multiline
              value={text}
              onChangeText={setText}
              placeholder="Enter text to convert to speech"
            />
        </View>
    
          
          <View style={styles.buttonContainer}>
            <View style={styles.generateButtonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.generateButton]}
                onPress={generateSpeech}
                disabled={isGeneratingAudio || !isModelInitialized || !downloadedVoices.has(selectedVoice)}
              >
                <Text style={styles.buttonText}>
                  {isGeneratingAudio ? 'Generating...' : 'Generate Speech'}
                </Text>
              </TouchableOpacity>
              
              {sound && (
                <View style={styles.playbackControls}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={playSound}
                  >
                    <Text style={styles.iconButtonText}>▶️</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={stopSound}
                  >
                    <Text style={styles.iconButtonText}>⏹️</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
     </KeyboardAvoidingView>
      
      <Modal
        visible={showModelSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModelSelector(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Model</Text>
              <TouchableOpacity onPress={() => setShowModelSelector(false)}>
                <Text style={styles.closeButton}>Close</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={Object.keys(MODELS)}
              renderItem={renderModelItem}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.modelList}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  subtitle: {
    fontSize: 16,
    color: '#636366',
    marginTop: 5,
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#1c1c1e',
  },
  modelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modelSelector: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f2f2f7',
    borderRadius: 8,
    marginRight: 10,
  },
  modelSelectorText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
  },
  modelSelectorSubtext: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2,
  },
  initButton: {
    backgroundColor: '#34C759',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  downloadButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  progressContainer: {
    marginTop: 10,
    height: 20,
    backgroundColor: '#e5e5ea',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#34C759',
  },
  progressText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    color: '#000',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  loadingText: {
    marginLeft: 10,
    color: '#636366',
    fontSize: 14,
  },
  voiceSelector: {
    marginBottom: 10,
  },
  voiceItem: {
    padding: 10,
    backgroundColor: '#f2f2f7',
    borderRadius: 8,
    marginRight: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  selectedVoiceItem: {
    backgroundColor: '#d1e7ff',
    borderColor: '#007AFF',
    borderWidth: 1,
  },
  undownloadedVoiceItem: {
    opacity: 0.7,
  },
  voiceName: {
    fontWeight: '600',
    fontSize: 14,
    color: '#1c1c1e',
  },
  voiceGender: {
    fontSize: 12,
    color: '#636366',
    marginTop: 2,
  },
  downloadIndicator: {
    fontSize: 16,
    color: '#007AFF',
    marginTop: 2,
  },
  speedSelectorContainer: {
    padding: 10,
  },
  speedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  speedValueContainer: {
    paddingHorizontal: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  speedValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  streamingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  streamingMetric: {
    fontSize: 14,
    color: '#636366',
  },
  streamProgressBar: {
    height: 4,
    backgroundColor: '#e5e5ea',
    borderRadius: 2,
    overflow: 'hidden',
  },
  streamProgress: {
    height: '100%',
    backgroundColor: '#34C759',
  },
  errorContainer: {
    backgroundColor: '#ffdddd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    borderColor: '#ff6b6b',
    borderWidth: 1,
  },
  errorText: {
    color: '#d63031',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  modelList: {
    padding: 15,
  },
  modelItem: {
    backgroundColor: '#f2f2f7',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  selectedModelItem: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  loadedModelItem: {
    backgroundColor: '#d1e7ff',
  },
  modelItemContent: {
    padding: 15,
  },
  modelItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  modelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  modelSize: {
    fontSize: 14,
    color: '#636366',
  },
  modelDescription: {
    fontSize: 14,
    color: '#636366',
    marginBottom: 10,
  },
  modelItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modelStatus: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  downloadButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  generateButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  generateButton: {
    backgroundColor: '#FF2D55',
  },
  playbackControls: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f2f2f7',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },
  iconButtonText: {
    fontSize: 24,
  },
  streamingMetricsContainer: {
    marginBottom: 10,
  },
  streamingMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  streamingMetricLabel: {
    fontSize: 14,
    color: '#636366',
    fontWeight: '500',
  },
  streamingMetricValue: {
    fontSize: 14,
    color: '#1c1c1e',
    fontWeight: '600',
  },
  phonemesContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f2f2f7',
    borderRadius: 8,
  },
  phonemesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636366',
    marginBottom: 5,
  },
  phonemesText: {
    fontSize: 14,
    color: '#1c1c1e',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
}); 