# Whispr

<p align="center">
  <img src="src/assets/microphone.png" alt="Whispr Logo" width="200" height="200">
</p>

<p align="center">
  <strong>Effortless Speech-to-Text Transcription Software</strong>
</p>

<p align="center">
  <a href="#key-features">Key Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#development">Development</a> •
  <a href="#license">License</a>
</p>

Whispr is a powerful and user-friendly speech-to-text transcription application built with Electron. It offers seamless audio capture and real-time transcription, making it an essential tool for professionals, students, and anyone who needs quick and accurate text from spoken words.

## Key Features

- **Global Shortcut**: Easily trigger transcription with a customizable global shortcut
- **Multiple Recording Modes**: Choose between "Press and Hold" or "Toggle" recording modes
- **Customizable Audio Input**: Select your preferred audio input device
- **Automatic Clipboard Integration**: Option to automatically paste transcriptions or copy to clipboard
- **Sleek Overlay Interface**: Minimalistic overlay with audio visualization during recording
- **Cross-Platform**: Works on Windows, macOS, and Linux (Windows installer included in releases)

## Installation

1. Go to the [Releases](https://github.com/ijazsadiqbasha/whispr-electron/releases) page
2. Download the latest `Whispr-Setup-3.0.0.exe` file
3. Run the installer and follow the on-screen instructions

## Usage

1. Launch Whispr from your Start Menu or desktop shortcut
2. Use the global shortcut (default: Ctrl+Shift+Space) to start recording
3. Speak clearly into your microphone
4. Release the shortcut or toggle off to end recording
5. Your transcription will be automatically processed and (optionally) pasted or copied

## Development

To set up the development environment:

1. Clone the repository
   ```
   git clone https://github.com/ijazsadiqbasha/whispr-electron.git
   cd whispr-electron
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the development server
   ```
   npm start
   ```

### Building

To create a production build:
   ```
   npm run build:win
   ```


## License

[MIT](LICENSE)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/ijazsadiqbasha">Ijaz Sadiq Basha</a>
</p>
