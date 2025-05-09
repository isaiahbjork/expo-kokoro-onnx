# Kokoro TTS Expo App

## On-Device Text-to-Speech with ONNX Runtime

Kokoro TTS Demo is a mobile application that demonstrates high-quality text-to-speech capabilities running entirely on-device using ONNX Runtime. This app showcases how modern neural TTS models can be deployed on mobile devices without requiring cloud connectivity.

### Demo Video

<p align="center">
  <a href="https://youtube.com/shorts/IvZ5ahpOsZE" target="_blank">
    <img src="https://img.youtube.com/vi/IvZ5ahpOsZE/0.jpg" alt="Kokoro TTS Demo Video" width="320">
  </a>
</p>

*Click the image above to watch the demo video on YouTube*

## Features

- 🔊 High-quality neural text-to-speech
- 📱 Runs 100% on-device (no internet required after initial download)
- 🎭 Multiple voices with different accents and styles
- 🔄 Adjustable speech speed
- 📊 Performance metrics for speech generation
- 📦 Multiple model options with different size/quality tradeoffs

## How It Works

Kokoro TTS uses a neural text-to-speech model converted to ONNX format, which allows it to run efficiently on mobile devices using ONNX Runtime. The app follows these steps to generate speech:

1. **Text Normalization**: Prepares the input text for processing
2. **Phonemization**: Converts text to phonetic representation
3. **Tokenization**: Converts phonemes to token IDs
4. **Neural Inference**: Processes tokens through the ONNX model
5. **Audio Generation**: Converts model output to audio waveforms
6. **Playback**: Plays the generated audio through device speakers

## Technology Stack

- **React Native**: Core framework for cross-platform mobile development
- **Expo**: Development platform for React Native
- **ONNX Runtime**: High-performance inference engine for ONNX models
- **Expo AV**: Audio playback capabilities
- **Expo FileSystem**: File management for model and voice data

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- Expo CLI
- iOS device with iOS 13+ (for development)
- Xcode (for iOS builds)
- Android Studio (for Android builds)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/isaiahbjork/expo-kokoro-onnx.git
   cd expo-kokoro-onnx
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

### Building a Development Client

To run the app on a physical device with full ONNX Runtime support:

```bash
npx eas build --platform ios --profile development
```

## Usage

1. **Select a Model**: Choose from different model sizes based on your device capabilities
2. **Download a Voice**: Select and download one of the available voices
3. **Adjust Speed**: Set the speech rate using the speed controls
4. **Enter Text**: Type or paste the text you want to convert to speech
5. **Generate Speech**: Press the "Generate Speech" button to create and play the audio

## Models

The app supports multiple model variants with different size and quality tradeoffs:

| Model | Size | Quality | Description |
|-------|------|---------|-------------|
| Full Precision | 326 MB | Highest | Best quality, largest size |
| FP16 | 163 MB | High | High quality, reduced size |
| Q8F16 | 86 MB | Good | Balanced quality and size |
| Quantized | 92.4 MB | Medium | Reduced quality, smaller size |

## Voices

The app includes multiple voices with different characteristics:

- American English (Male/Female)
- British English (Male/Female)
- Various voice styles and characteristics

## Development

### Project Structure

- `/kokoro`: Core TTS implementation
  - `kokoroOnnx.ts`: Main TTS engine implementation
  - `models.ts`: Model management and downloading
  - `voices.ts`: Voice definitions and management
- `App.tsx`: Main application UI
- `app.json`: Expo configuration
- `metro.config.js`: Metro bundler configuration

### Key Components

- **KokoroOnnx**: Main class that handles TTS functionality
- **Model Management**: Functions for downloading and managing models
- **Voice Management**: Functions for downloading and using voice data
- **UI Components**: React Native components for the user interface

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- ONNX Runtime team for the mobile inference engine
- Expo team for the development platform
- Contributors to the open-source TTS models