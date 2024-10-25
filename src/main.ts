import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, screen, clipboard } from 'electron';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import Store from 'electron-store';
import { GlobalKeyboardListener, IGlobalKeyEvent } from 'node-global-key-listener';
import fs from 'fs';
import pkg from 'electron-updater';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const { autoUpdater } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types and interfaces
interface StoreSchema {
  shortcutKey: string;
  recordingMode: string;
  selectedAudioInput: string;
  autoPaste: boolean;
  copyToClipboard: boolean;
  openSettingsOnStartup: boolean;
}

interface TypedStore extends Store<StoreSchema> {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K];
  get<K extends keyof StoreSchema>(key: K, defaultValue: StoreSchema[K]): StoreSchema[K];
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void;
  set(key: string, value: unknown): void;
  set(object: Partial<StoreSchema>): void; 
}

// Constants
const defaultSettings: StoreSchema = {
  shortcutKey: 'Space',
  recordingMode: 'press-and-hold',
  selectedAudioInput: '',
  autoPaste: true,
  copyToClipboard: false,
  openSettingsOnStartup: true
};

// Global variables
let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting: boolean | null = null;
const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'microphone.png')
  : path.join(app.getAppPath(), 'src', 'assets', 'microphone.png');
const store = new Store<StoreSchema>() as TypedStore;
const gkl = new GlobalKeyboardListener();
let isOverlayReady = false;

// Helper functions
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 475,
    height: 550,
    autoHideMenuBar: true,
    resizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#020817', 
      symbolColor: '#ffffff', 
    },
    show: store.get('openSettingsOnStartup', true),
    icon: nativeImage.createFromPath(iconPath)
  });
  
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    } else {
      closePythonProcess();
    }
    return false;
  });
  
  mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
}

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 150,
    height: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    resizable: false,
    maximizable: false,
    useContentSize: true,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  overlayWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'), {
    hash: '/overlay'
  });

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');

  moveOverlayOutOfBounds();

  overlayWindow.webContents.on('did-finish-load', () => {
    setOverlayReady(true);
  });
}

function moveOverlayInBounds() {
  if (overlayWindow) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const [overlayWidth, overlayHeight] = overlayWindow.getSize();
    const padding = 20

    const xPosition = Math.floor((screenWidth - overlayWidth) / 2);
    const yPosition = screenHeight - overlayHeight - padding;

    overlayWindow.setPosition(xPosition, yPosition);
  }
}

function moveOverlayOutOfBounds() {
  if (overlayWindow) {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    overlayWindow.setPosition(screenWidth + 100, screenHeight + 100);
  }
}

function createTray() {
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Settings', click: () => mainWindow?.show() },
    { label: 'Quit', click: () => app.quit() }
  ]);
  
  tray.setToolTip('Whispr');
  tray.setContextMenu(contextMenu);
}

function registerGlobalShortcut(shortcutKey: string) {
  return globalShortcut.register(`CommandOrControl+Shift+${shortcutKey}`, () => {
    if (isOverlayReady) {
      onShortcutTriggered(shortcutKey);
    } else {
      console.log('Overlay not ready. Ignoring shortcut.');
    }
  });
}

function initializeStore() {
  for (const [key, value] of Object.entries(defaultSettings)) {
    if (store.get(key as keyof StoreSchema) === undefined) {
      store.set(key as keyof StoreSchema, value);
    }
  }
}

let isRecording = false;

async function startRecording() {
  isRecording = true;
  moveOverlayInBounds();
  overlayWindow?.webContents.send('start-recording');
}

function stopRecording() {
  isRecording = false;
  overlayWindow?.webContents.send('stop-recording');
}

function onShortcutTriggered(shortcutKey: string) {
  const recordingMode = store.get('recordingMode', 'press-and-hold');

  if (recordingMode === 'press-and-hold') {
    globalShortcut.unregisterAll();
    startRecording();

    const keyReleased = function(event: IGlobalKeyEvent) {
      if (event.state === 'UP' && event.name === shortcutKey.toUpperCase()) {
        gkl.removeListener(keyReleased);
        registerGlobalShortcut(store.get('shortcutKey', 'Space'));
        stopRecording();
      }
    };
    gkl.addListener(keyReleased);

  } else if (recordingMode === 'toggle') {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }
}

function createAppElements() {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
  if (!tray) {
    createTray();
  }
}

let pythonProcess: ChildProcess | null = null;

function startPythonProcess() {
  let executablePath: string;

  if (app.isPackaged) {
    if (process.platform === 'win32') {
      executablePath = path.join(process.resourcesPath, 'bin', 'whispr_win.exe');
    } else if (process.platform === 'darwin') {
      executablePath = path.join(process.resourcesPath, 'bin', 'whispr_mac');
    } else {
      executablePath = path.join(process.resourcesPath, 'bin', 'whispr_linux');
    }
  } else {
    executablePath = path.join(app.getAppPath(), 'bin', 'whispr_win.exe');
  }

  console.log('Python executable path:', executablePath);

  // Check if the Python executable exists
  if (!fs.existsSync(executablePath)) {
    console.error(`Python executable not found at: ${executablePath}`);
    return;
  }

  try {
    pythonProcess = spawn(executablePath);

    pythonProcess.stdout?.on('data', (data) => {
      try {
        const result = JSON.parse(data);
        console.log('Parsed python result:', result);
        if (result.transcription) {
          if (store.get('copyToClipboard', false)) {
            clipboard.writeText(result.transcription);
          }
        } else {
          console.log('Transcription not found in result');
        }
      } catch (error) {
        console.error('Error parsing Python output:', error);
      } finally {
        moveOverlayOutOfBounds();
      }
    });

    pythonProcess.stderr?.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
    });
  } catch (error) {
    console.error('Error starting Python process:', error);
  }
}

function closePythonProcess() {
  if (pythonProcess) {
    console.log('Closing Python process');
    pythonProcess.kill();
    pythonProcess = null;
  }
}

// App event listeners
app.on('ready', () => {
  autoUpdater.checkForUpdatesAndNotify();
  startPythonProcess();
  createAppElements();
  createOverlayWindow();
  initializeStore();
  registerGlobalShortcut(store.get('shortcutKey', 'Space'));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createAppElements();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  closePythonProcess();
});

app.on('before-quit', () => {
  isQuitting = true;
  closePythonProcess();
});

// IPC handlers
ipcMain.handle('getStoreValue', (event, key: keyof StoreSchema) => {
  return store.get(key, defaultSettings[key]);
});

ipcMain.handle('setStoreValue', (event, key: keyof StoreSchema, value: StoreSchema[keyof StoreSchema]) => {
  store.set(key, value);
});

ipcMain.handle('updateGlobalShortcut', (event, newShortcutKey) => {
  globalShortcut.unregisterAll();
  return registerGlobalShortcut(newShortcutKey);
});

ipcMain.handle('transcribe-audio', (event, audioData) => {
  if (pythonProcess && pythonProcess.stdin) {
    const jsonInput = JSON.stringify({ audio: audioData, autoPaste: store.get('autoPaste', true) }) + '\n';
    pythonProcess.stdin.write(jsonInput);
  } else {
    console.error('Python process not started or stdin not available');
  }
});

ipcMain.handle('overlay-error', () => {
  moveOverlayOutOfBounds();
});

ipcMain.on('log', (event, message) => {
  console.log('Renderer Log:', message);
});

ipcMain.on('overlay-ready', () => {
  setOverlayReady(true);
  mainWindow?.webContents.send('whispr-ready');
});

function setOverlayReady(ready: boolean) {
  isOverlayReady = ready;
}
