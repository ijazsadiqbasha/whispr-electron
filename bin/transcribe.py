import base64
import os
import sys
import json
import numpy as np
import keyboard
from faster_whisper import WhisperModel

# Get the directory of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))

# Construct paths
whisper_tiny_path = os.path.join(os.path.dirname(sys.executable), "whisper_base")

# Load the model (do this once at startup)
whisper_model = WhisperModel(whisper_tiny_path, device="cpu", compute_type="int8", local_files_only=True)

def transcribe(audio_data, autoPaste=True):
    audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
    segments, _ = whisper_model.transcribe(audio_np, beam_size=1, best_of=1, temperature=0.0, language="en")

    transcription = []
    for segment in segments:
        transcription.append(segment.text)

    result = " ".join(transcription)

    if autoPaste:
        keyboard.write(result)

    return result

def main():
    for line in sys.stdin:
        try:
            data = json.loads(line)
            audio_data = data.get('audio')
            if audio_data is not None:
                audio_bytes = base64.b64decode(audio_data)
                result = transcribe(audio_bytes, data.get('autoPaste'))
                print(json.dumps({"transcription": result}), flush=True)
            else:
                print(json.dumps({"error": "No audio data received"}), flush=True)
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON input"}), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)

if __name__ == "__main__":
    main()
