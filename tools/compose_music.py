# Renders a gentle piano + pad arrangement of Pachelbel's Canon (public domain) to a WAV.
import numpy as np, wave, sys
SR = 44100
BEAT = 1.0                      # 60 bpm
CHORD = 2 * BEAT
CYCLES = 4
total = CYCLES * 8 * CHORD
N = int(SR * total)
L = np.zeros(N); R = np.zeros(N)
f = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def piano(m, dur, amp):
    t = np.arange(int(SR * dur)) / SR
    fr = f(m); sig = np.zeros_like(t)
    for n in range(1, 8):
        inh = n * np.sqrt(1 + 0.0004 * n * n)
        sig += (1 / n ** 1.6) * np.sin(2 * np.pi * fr * inh * t + n) * np.exp(-t * (0.9 + 0.55 * n) * (fr / 440) ** 0.3)
    att = np.minimum(1, t / 0.006)
    return amp * sig * att

def pad(ms, dur, amp):
    t = np.arange(int(SR * (dur + 1.2))) / SR
    env = np.minimum(1, t / 0.9) * np.where(t > dur, np.exp(-(t - dur) / 0.5), 1)
    sig = sum(np.sin(2 * np.pi * f(m) * t) + 0.25 * np.sin(4 * np.pi * f(m) * t + 0.5) +
              0.4 * np.sin(2 * np.pi * f(m) * 1.003 * t) for m in ms)
    trem = 1 + 0.08 * np.sin(2 * np.pi * 0.3 * t)
    return amp * sig * env * trem / len(ms)

def add(sig, start, pan=0.0):
    i = int(start * SR); j = i + len(sig)
    # wrap around so the loop is seamless
    idx = np.arange(i, j) % N
    np.add.at(L, idx, sig * (1 - pan) * 0.5 * 1.4)
    np.add.at(R, idx, sig * (1 + pan) * 0.5 * 1.4)

pads = [[50,54,57,62],[49,52,57,61],[50,54,59,62],[49,54,57,61],[50,55,59,62],[50,54,57,62],[50,55,59,62],[49,52,57,64]]
bass = [38,45,47,42,43,38,43,45]
roots4 = [(62,4),(57,4),(59,3),(54,3),(55,4),(62,4),(55,4),(57,4)]
melody = [78,76,74,73,71,69,71,73]

for c in range(CYCLES):
    for k in range(8):
        t0 = (c * 8 + k) * CHORD
        add(pad(pads[k], CHORD, 0.13), t0, pan=-0.1)
        add(piano(bass[k], 4.0, 0.30), t0, pan=-0.2)
        if c >= 1:
            r, third = roots4[k]
            for q, m in enumerate([r, r + third, r + 7, r + 12]):
                add(piano(m, 2.5, 0.13), t0 + q * 0.5, pan=0.3)
        if c >= 2:
            add(piano(melody[k], 3.5, 0.22), t0, pan=0.05)
            if c == 3:
                add(piano(melody[k] - 12, 3.5, 0.08), t0 + 1.0, pan=-0.05)

# simple stereo reverb by FFT convolution with decaying noise, wrapped for looping
rng = np.random.default_rng(3)
ir_t = np.arange(int(SR * 3.0)) / SR
def verb(x, seed):
    ir = np.random.default_rng(seed).standard_normal(len(ir_t)) * np.exp(-ir_t / 0.9)
    ir[0] = 0
    n = len(x)
    X = np.fft.rfft(x, n); H = np.fft.rfft(ir, n)   # circular convolution = seamless loop
    return np.fft.irfft(X * H, n)
wl, wr = verb(L, 1), verb(R, 2)
wl /= np.max(np.abs(wl)) + 1e-9; wr /= np.max(np.abs(wr)) + 1e-9
dry = max(np.max(np.abs(L)), np.max(np.abs(R)))
outL = 0.7 * L / dry + 0.35 * wl
outR = 0.7 * R / dry + 0.35 * wr
peak = max(np.max(np.abs(outL)), np.max(np.abs(outR)))
outL, outR = outL / peak * 0.7, outR / peak * 0.7
data = (np.stack([outL, outR], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('seconds', total)
