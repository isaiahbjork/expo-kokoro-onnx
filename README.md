# MLX TTS Demo for Expo

This project demonstrates how to use the MLX Swift library to run text-to-speech models directly on iOS devices using Expo. It includes a custom Expo module (`expo-mlx-tts`) that interfaces with MLX Swift and a sample application that showcases its usage.

## Features

- Run the Kokoro-82M-4bit text-to-speech model on iOS devices
- Download models from Hugging Face
- Generate speech from text
- Real-time progress updates
- Simple UI for testing

## Requirements

- iOS 14.0 or later
- macOS with Xcode 14.0 or later
- Node.js 16 or later
- Expo CLI

## Getting Started

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/expo-mlx-tts-demo.git
   cd expo-mlx-tts-demo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npm start
   ```

4. Run on iOS:
   ```bash
   npm run ios
   ```

## How It Works

The project consists of two main parts:

1. **expo-mlx-tts Module**: A custom Expo module that interfaces with MLX Swift to run text-to-speech models.
2. **Demo Application**: A React Native application that demonstrates how to use the module.

### Module Structure

- `modules/expo-mlx-tts/src`: TypeScript definitions and JavaScript interface
- `modules/expo-mlx-tts/ios`: Swift implementation of the module
- `modules/expo-mlx-tts/ios/KokoroTTSModel.swift`: Implementation of the Kokoro TTS model

### Using the Module

```javascript
import * as ExpoMlxTts from 'expo-mlx-tts';

// Generate speech
const result = await ExpoMlxTts.generateSpeech({
  text: "Hello, world!",
  modelPath: "/path/to/model", // Optional
  voicePreset: "default", // Optional
  speed: 1.0, // Optional
});

// Play speech
await ExpoMlxTts.speak({
  text: "Hello, world!",
});

// Download a model
const modelPath = await ExpoMlxTts.downloadModel(
  "https://huggingface.co/mlx-community/Kokoro-82M-4bit/resolve/main/model.safetensors",
  "Kokoro-82M-4bit"
);
```

## Model Information

This demo uses the [Kokoro-82M-4bit](https://huggingface.co/mlx-community/Kokoro-82M-4bit) model from Hugging Face, which is a 4-bit quantized version of the Kokoro TTS model optimized for MLX.

## Customization

You can customize the module to use different TTS models by modifying the `KokoroTTSModel.swift` file. The current implementation includes placeholders that you can replace with actual MLX model code.

## License

MIT 