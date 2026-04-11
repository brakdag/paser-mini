"""
paser/core/audio_manager.py
Gestor de captura de audio usando sounddevice para máxima estabilidad en Linux.
"""

import sounddevice as sd
import numpy as np
import wave
import io
import base64
import logging
from typing import Optional

logger = logging.getLogger("audio_manager")

class AudioManager:
    def __init__(self):
        self.rate = 16000
        self.channels = 1
        self.frames = []
        self.stream: Optional[sd.InputStream] = None

    def _audio_callback(self, indata, frames, time, status):
        """Callback que se ejecuta automáticamente cada vez que hay audio disponible."""
        if status:
            logger.warning(f"Audio status warning: {status}")
        # Guardamos los datos como bytes
        self.frames.append(indata.tobytes())

    def start_recording(self):
        """Inicia la grabación usando un stream asíncrono de sounddevice."""
        try:
            self.frames = []
            self.stream = sd.InputStream(
                samplerate=self.rate,
                channels=self.channels,
                dtype='int16',
                callback=self._audio_callback
            )
            self.stream.start()
            logger.info("Sounddevice recording started successfully.")
        except Exception as e:
            logger.error(f"Failed to start sounddevice recording: {e}")
            raise e

    def stop_recording(self) -> Optional[str]:
        """Detiene la grabación y procesa el audio capturado."""
        if not self.stream:
            return None

        try:
            self.stream.stop()
            self.stream.close()
            self.stream = None
            
            if not self.frames:
                logger.warning("No audio data captured by sounddevice.")
                return None

            # Unir todos los chunks de bytes
            audio_data = b''.join(self.frames)
            
            # Crear archivo WAV en memoria
            buffer = io.BytesIO()
            with wave.open(buffer, 'wb') as wf:
                wf.setnchannels(self.channels)
                wf.setsampwidth(2) # 16-bit PCM
                wf.setframerate(self.rate)
                wf.writeframes(audio_data)
            
            buffer.seek(0)
            base64_audio = base64.b64encode(buffer.read()).decode('utf-8')
            logger.info(f"Audio recording stopped. Captured {len(self.frames)} chunks.")
            return base64_audio
            
        except Exception as e:
            logger.error(f"Error stopping recording: {e}")
            return None
        finally:
            self.frames = []

    def __del__(self):
        if self.stream:
            self.stream.stop()
            self.stream.close()