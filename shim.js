// Polyfills for web APIs
import { Buffer } from 'buffer';
import 'react-native-get-random-values';

// Make Buffer available globally
global.Buffer = Buffer;

// Polyfill for URL
if (typeof global.URL !== 'function') {
  global.URL = require('url').URL;
}

// Polyfill for TextEncoder/TextDecoder
if (typeof global.TextEncoder !== 'function') {
  global.TextEncoder = require('text-encoding').TextEncoder;
  global.TextDecoder = require('text-encoding').TextDecoder;
}

// Polyfill for process
if (typeof global.process === 'undefined') {
  global.process = require('process');
}

// Polyfill for fetch
if (typeof global.fetch !== 'function') {
  global.fetch = require('cross-fetch');
}

export default {}; 