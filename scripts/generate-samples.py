import os
import struct
import math
import wave

def generate_wav(frequency, duration_ms, sample_rate=44100):
    num_samples = int(sample_rate * duration_ms / 1000)
    data = []
    for i in range(num_samples):
        t = i / 44100
        value = int(max(-32768, min(32767, round(math.sin(2 * math.pi * frequency * t) * 16384))))
        data.append(value)
    
    # Create WAV file in memory
    wav_buffer = bytearray()
    # RIFF header
    wav_buffer.extend(b'RIFF')
    wav_buffer.extend(struct.pack('<I', 36 + len(data) * 2))
    wav_buffer.extend(b'WAVE')
    # fmt chunk
    wav_buffer.extend(b'fmt ')
    wav_buffer.extend(struct.pack('<I', 16))  # chunk size
    wav_buffer.extend(struct.pack('<H', 1))   # PCM
    wav_buffer.extend(struct.pack('<H', 1))   # mono
    wav_buffer.extend(struct.pack('<I', 44100))  # sample rate
    wav_buffer.extend(struct.pack('<I', 44100 * 2))  # byte rate
    wav_buffer.extend(struct.pack('<H', 2))   # block align
    wav_buffer.extend(struct.pack('<H', 16))  # bits per sample
    # data chunk
    wav_buffer.extend(b'data')
    wav_buffer.extend(struct.pack('<I', len(data) * 2))
    for val in data:
        wav_buffer.extend(struct.pack('<h', val))
    
    return bytes(wav_buffer)

import os
os.makedirs("samples/bass", exist_ok=True)
os.makedirs("samples/drums", exist_ok=True)
os.makedirs("samples/piano", exist_ok=True)

bass_notes = [
    ("Contrabass_pizz_mf_C2", 65.41),
    ("Contrabass_pizz_mf_E2", 82.41),
    ("Contrabass_pizz_mf_G2", 98.00),
    ("Contrabass_pizz_mf_C3", 130.81),
]

for name, freq in bass_notes:
    wav = generate_wav(freq, 500)
    with open(f"samples/bass/{name}.wav", "wb") as f:
        f.write(wav)
    print(f"Generated samples/bass/{name}.wav")

drum_samples = [
    ("Kick", 60, 100),
    ("Snare", 200, 150),
    ("HiHat", 800, 50),
    ("Ride", 600, 300),
    ("Crash", 1000, 500),
]

for name, freq, dur in drum_samples:
    wav = generate_wav(freq, dur)
    with open(f"samples/drums/{name}.wav", "wb") as f:
        f.write(wav)
    print(f"Generated samples/drums/{name}.wav")

piano_notes = [
    ("SalamanderGrandPiano_C3", 130.81),
    ("SalamanderGrandPiano_D3", 146.83),
    ("SalamanderGrandPiano_E3", 164.81),
    ("SalamanderGrandPiano_F3", 174.61),
    ("SalamanderGrandPiano_G3", 196.00),
    ("SalamanderGrandPiano_A3", 220.00),
    ("SalamanderGrandPiano_B3", 246.94),
    ("SalamanderGrandPiano_C4", 261.63),
    ("SalamanderGrandPiano_D4", 293.66),
    ("SalamanderGrandPiano_E4", 329.63),
    ("SalamanderGrandPiano_F4", 349.23),
    ("SalamanderGrandPiano_G4", 392.00),
    ("SalamanderGrandPiano_A4", 440.00),
    ("SalamanderGrandPiano_B4", 493.88),
    ("SalamanderGrandPiano_C5", 523.25),
]

for name, freq in piano_notes:
    wav = generate_wav(freq, 1000)
    with open(f"samples/piano/{name}.wav", "wb") as f:
        f.write(wav)
    print(f"Generated samples/piano/{name}.wav")

drum_samples = [
    ("Kick", 60, 100),
    ("Snare", 200, 150),
    ("HiHat", 800, 50),
    ("Ride", 600, 300),
    ("Crash", 1000, 500),
]

for name, freq, dur in drum_samples:
    wav = generate_wav(freq, dur)
    with open(f"samples/drums/{name}.wav", "wb") as f:
        f.write(wav)
    print(f"Generated samples/drums/{name}.wav")

piano_notes = [
    ("SalamanderGrandPiano_C3", 130.81),
    ("SalamanderGrandPiano_D3", 146.83),
    ("SalamanderGrandPiano_E3", 164.81),
    ("SalamanderGrandPiano_F3", 174.61),
    ("SalamanderGrandPiano_G3", 196.00),
    ("SalamanderGrandPiano_A3", 220.00),
    ("SalamanderGrandPiano_B3", 246.94),
    ("SalamanderGrandPiano_C4", 261.63),
    ("SalamanderGrandPiano_D4", 293.66),
    ("SalamanderGrandPiano_E4", 329.63),
    ("SalamanderGrandPiano_F4", 349.23),
    ("SalamanderGrandPiano_G4", 392.00),
    ("SalamanderGrandPiano_A4", 440.00),
    ("SalamanderGrandPiano_B4", 493.88),
    ("SalamanderGrandPiano_C5", 523.25),
]

for name, freq in piano_notes:
    wav = generate_wav(freq, 1000)
    with open(f"samples/piano/{name}.wav", "wb") as f:
        f.write(wav)
    print(f"Generated samples/piano/{name}.wav")

drum_samples = [
    ("Kick", 60, 100),
    ("Snare", 200, 150),
    ("HiHat", 800, 50),
    ("Ride", 600, 300),
    ("Crash", 1000, 500),
]

for name, freq, dur in drum_samples:
    wav = generate_wav(freq, dur)
    with open(f"samples/drums/{name}.wav", "wb") as f:
        f.write(wav)
    print(f"Generated samples/drums/{name}.wav")

piano_notes = [
    ("SalamanderGrandPiano_C3", 130.81),
    ("SalamanderGrandPiano_D3", 146.83),
    ("SalamanderGrandPiano_E3", 164.81),
    ("SalamanderGrandPiano_F3", 174.61),
    ("SalamanderGrandPiano_G3", 196.00),
    ("SalamanderGrandPiano_A3", 220.00),
    ("SalamanderGrandPiano_B3", 246.94),
    ("SalamanderGrandPiano_C4", 261.63),
    ("SalamanderGrandPiano_D4", 293.66),
    ("SalamanderGrandPiano_E4", 329.63),
    ("SalamanderGrandPiano_F4", 349.23),
    ("SalamanderGrandPiano_G4", 392.00),
    ("SalamanderGrandPiano_A4", 440.00),
    ("SalamanderGrandPiano_B4", 493.88),
    ("SalamanderGrandPiano_C5", 523.25),
]

for name, freq in piano_notes:
    wav = generate_wav(freq, 1000)
    with open(f"samples/piano/{name}.wav", "wb") as f:
        f.write(wav)
    print(f"Generated samples/piano/{name}.wav")

drum_samples = [
    ("Kick", 60, 100),
    ("Snare", 200, 150),
    ("HiHat", 800, 50),
    ("Ride", 600, 300),
    ("Crash", 1000, 500),
]

for name, freq, dur in drum_samples:
    wav = generate_wav(freq, dur)
    with open(f"samples/drums/{name}.wav", "wb") as f:
        f.write(wav)
    print(f"Generated samples/drums/{name}.wav")

piano_notes = [
    ("SalamanderGrandPiano_C3", 130.81),
    ("SalamanderGrandPiano_D3", 146.83),
    ("SalamanderGrandPiano_E3", 164.81),
    ("SalamanderGrandPiano_F3", 174.61),
    ("SalamanderGrandPiano_G3", 196.00),
    ("SalamanderGrandPiano_A3", 220.00),
    ("SalamanderGrandPiano_B3", 246.94),
    ("SalamanderGrandPiano_C4", 261.63),
    ("SalamanderGrandPiano_D4", 293.66),
    ("SalamanderGrandPiano_E4", 329.63),
    ("SalamanderGrandPiano_F4", 349.23),
    ("SalamanderGrandPiano_G4", 392.00),
    ("SalamanderGrandPiano_A4", 440.00),
    ("SalamanderGrandPiano_B4", 493.88),
    ("SalamanderGrandPiano_C5", 523.25),
]

for name, freq in piano_notes:
    wav = generate_wav(freq, 1000)
    with open(f"samples/piano/{name}.wav", "wb") as f:
        f.write(wav)
    print(f"Generated samples/piano/{name}.wav")

with open("samples/piano/ATTRIBUTION.md", "w") as f:
    f.write("""Salamander Grand Piano by Alexander Holm
CC BY 3.0 - https://creativecommons.org/licenses/by/3.0/
Source: https://github.com/sgossner/VCSL
Sample pack: Salamander Grand Piano V3+ (placeholder)
""")

print("\n✓ Placeholder samples generated")
