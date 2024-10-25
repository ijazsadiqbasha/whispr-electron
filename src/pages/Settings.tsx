import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select.js";
import { Label } from "../components/ui/label.js";
import { Checkbox } from "../components/ui/checkbox.js";
//import { ipcRenderer } from 'electron'; // DOESNT WORK FOR SOME REASON
const { ipcRenderer } = window.require('electron');

const ShortcutKeys = [
  "Space", "Tab",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "NumPad0", "NumPad1", "NumPad2", "NumPad3", "NumPad4", "NumPad5", "NumPad6", "NumPad7", "NumPad8", "NumPad9",
  "Esc", "Insert", "Delete", "Home", "End", "PageUp", "PageDown"
];

const log = (message: string) => {
  ipcRenderer.send('log', message);
};

const Settings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isWhisprReady, setIsWhisprReady] = useState(false);
  const [shortcutKey, setShortcutKey] = useState('Space');
  const [recordingMode, setRecordingMode] = useState('press-and-hold');
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [autoPaste, setAutoPaste] = useState(true);
  const [copyToClipboard, setCopyToClipboard] = useState(false);
  const [openSettingsOnStartup, setOpenSettingsOnStartup] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [
          savedShortcutKey,
          savedRecordingMode,
          savedSelectedAudioInput,
          savedAutoPaste,
          savedCopyToClipboard,
          savedOpenSettingsOnStartup
        ] = await Promise.all([
          ipcRenderer.invoke('getStoreValue', 'shortcutKey'),
          ipcRenderer.invoke('getStoreValue', 'recordingMode'),
          ipcRenderer.invoke('getStoreValue', 'selectedAudioInput'),
          ipcRenderer.invoke('getStoreValue', 'autoPaste'),
          ipcRenderer.invoke('getStoreValue', 'copyToClipboard'),
          ipcRenderer.invoke('getStoreValue', 'openSettingsOnStartup')
        ]);

        setShortcutKey(savedShortcutKey);
        setRecordingMode(savedRecordingMode);
        if (savedSelectedAudioInput) setSelectedAudioInput(savedSelectedAudioInput);
        setAutoPaste(savedAutoPaste);
        setCopyToClipboard(savedCopyToClipboard);
        setOpenSettingsOnStartup(savedOpenSettingsOnStartup);

        await getAudioInputs(savedSelectedAudioInput);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();

    // Add listener for 'whispr-ready' event
    const whisprReadyListener = () => {
      setIsWhisprReady(true);
    };
    ipcRenderer.on('whispr-ready', whisprReadyListener);

    // Cleanup listener on component unmount
    return () => {
      ipcRenderer.removeListener('whispr-ready', whisprReadyListener);
    };
  }, []);

  const getAudioInputs = async (savedAudioInput: string) => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
      setAudioInputs(audioInputDevices);
      
      if (savedAudioInput && audioInputDevices.some(device => device.deviceId === savedAudioInput)) {
        setSelectedAudioInput(savedAudioInput);
      } else if (audioInputDevices.length > 0) {
        const defaultDevice = audioInputDevices.find(device => device.deviceId === 'default') || audioInputDevices[0];
        setSelectedAudioInput(defaultDevice.deviceId);
        saveSettings('selectedAudioInput', defaultDevice.deviceId);
      }
    } catch (error) {
      console.error('Error getting audio inputs:', error);
    }
  };

  const saveSettings = async (key: string, value: string | boolean) => {
    await ipcRenderer.invoke('setStoreValue', key, value);
  };

  const handleShortcutKeyChange = async (value: string) => {
    setShortcutKey(value);
    await saveSettings('shortcutKey', value);
    
    const success = await ipcRenderer.invoke('updateGlobalShortcut', value);
    if (!success) {
      console.error('Failed to update global shortcut');
    }
  };

  const handleRecordingModeChange = (value: string) => {
    setRecordingMode(value);
    saveSettings('recordingMode', value);
  };

  const handleAudioInputChange = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    await saveSettings('selectedAudioInput', deviceId);
  };

  const handleAutoPasteChange = (checked: boolean) => {
    setAutoPaste(checked);
    saveSettings('autoPaste', checked);
  };

  const handleCopyToClipboardChange = (checked: boolean) => {
    setCopyToClipboard(checked);
    saveSettings('copyToClipboard', checked);
  };

  const handleOpenSettingsOnStartupChange = (checked: boolean) => {
    setOpenSettingsOnStartup(checked);
    saveSettings('openSettingsOnStartup', checked);
  };

  if (isLoading || !isWhisprReady) {
    return (
      <div className="flex items-center justify-center h-screen w-screen fixed top-0 left-0 bg-background">
        <div className="text-lg font-semibold">
          {isLoading ? "Loading settings..." : "Loading Whispr voice service..."}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="space-y-6">
        <Label className="scroll-m-20 text-xl font-semibold tracking-tight">Whispr Settings</Label>

        <div className="space-y-2">
          <Label htmlFor="shortcut-key" className="text-sm font-medium leading-none">Shortcut Key</Label>
          <div className="flex items-center space-x-2">
            <span className="text-sm">Cmd / Ctrl + Shift +</span>
            <Select value={shortcutKey} onValueChange={handleShortcutKeyChange}>
              <SelectTrigger id="shortcut-key" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto">
                {ShortcutKeys.map((key) => (
                  <SelectItem key={key} value={key}>{key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="audio-input" className="text-sm font-medium">Audio Input</Label>
          <Select value={selectedAudioInput} onValueChange={handleAudioInputChange}>
            <SelectTrigger id="audio-input" className="w-full">
              <SelectValue placeholder="Select audio input" />
            </SelectTrigger>
            <SelectContent>
              {audioInputs.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="recording-mode" className="text-sm font-medium">Recording Mode</Label>
          <Select value={recordingMode} onValueChange={handleRecordingModeChange}>
            <SelectTrigger id="recording-mode" className="w-full">
              <SelectValue placeholder="Select recording mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="press-and-hold">Press and Hold</SelectItem>
              <SelectItem value="toggle">Toggle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="auto-paste" 
              checked={autoPaste} 
              onCheckedChange={handleAutoPasteChange}
            />
            <Label htmlFor="auto-paste" className="text-sm font-medium">
              Automatic Paste
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="copy-to-clipboard" 
              checked={copyToClipboard} 
              onCheckedChange={handleCopyToClipboardChange}
            />
            <Label htmlFor="copy-to-clipboard" className="text-sm font-medium">
              Copy to Clipboard
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="open-settings-on-startup" 
              checked={openSettingsOnStartup} 
              onCheckedChange={handleOpenSettingsOnStartupChange}
            />
            <Label htmlFor="open-settings-on-startup" className="text-sm font-medium">
              Open Settings on Startup
            </Label>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;
