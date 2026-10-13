# Synthesizes the music bed and UI sounds (no samples, so nothing to license).
# Writes public/audio/*.wav and flips the switches in src/audio.json.
import json, os, wave
import numpy as np

SR = 44100
rng = np.random.default_rng(5)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")

def lp(x, cut, hp=0.0):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = 1 / (1 + (f / cut) ** 4)
    if hp: m *= 1 - 1 / (1 + (f / hp) ** 4)
    return np.fft.irfft(X * m, len(x))

def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)

def save(name, x, peak=0.8):
    x = np.asarray(x, dtype=float)
    if x.ndim == 1: x = np.stack([x, x], 1)
    x = x / np.abs(x).max() * peak
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())

def bell(m, dur, d):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    return (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * 2.01 * f * t) * np.exp(-t / .1)) * env(n, .004, d)

def click():
    n = int(.05 * SR); t = np.arange(n) / SR
    return lp(rng.standard_normal(n), 4500, 900) * np.exp(-t / .005) + .5 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / .012)

# --- UI sounds ---
save("click.wav", click(), .7)
n = int(.55 * SR); typing = np.zeros(n)
for k in range(5):
    i = int((.02 + k * .1 + rng.uniform(-.012, .012)) * SR); c = lp(rng.standard_normal(int(.03 * SR)), 5200, 1600) * np.exp(-np.arange(int(.03 * SR)) / SR / .004)
    typing[i:i + len(c)] += c * rng.uniform(.6, 1)
save("typing.wav", typing, .45)
ch = np.zeros(int(1.4 * SR))
for m, at, g in ((76, 0, 1), (81, .09, .8), (88, .18, .5)):
    b = bell(m, 1.1, .32); i = int(at * SR); ch[i:i + len(b)] += b * g
save("chime.wav", ch, .6)
n = int(.55 * SR); t = np.arange(n) / n
save("whoosh.wav", lp(rng.standard_normal(n), 2400, 350) * np.where(t < .5, (t / .5) ** 2.2, ((1 - t) / .5) ** 2), .5)

# --- music bed: 64 s, 100 bpm, A minor -> F -> C -> G, soft pad + muted plucks, no drums ---
BPM, BARS = 100, 26
beat = 60 / BPM; N = int(BARS * 4 * beat * SR) + SR
dry, wet = np.zeros(N), np.zeros(N)
CH = [[57, 64, 69, 72], [53, 60, 65, 69], [48, 55, 64, 67], [55, 62, 67, 71]]
def place(bus, sig, at, g):
    i = int(at * SR); sig = sig[: N - i]; bus[i:i + len(sig)] += sig * g
for bar in range(BARS):
    notes = CH[bar % 4]; at = bar * 4 * beat; n = int((4 * beat + .5) * SR); t = np.arange(n) / SR
    pad = sum(2 * ((hz(m + d) * t) % 1) - 1 for m in notes for d in (-.06, .06))
    place(wet, lp(pad, 750) * np.minimum(1, t / .5) * np.minimum(1, (t[-1] - t) / .6), at, .03)
    bn = int(4 * beat * SR); bt = np.arange(bn) / SR
    place(dry, np.sin(2 * np.pi * hz(notes[0] - 24) * bt) * np.minimum(1, bt / .05) * np.minimum(1, (bt[-1] - bt) / .2), at, .11)
    for k, idx in enumerate([0, 2, 1, 3, 2, 1, 3, 2]):
        pn = int(.4 * SR); pt = np.arange(pn) / SR; f = hz(notes[idx] + 12)
        pl = sum(np.sin(2 * np.pi * f * h * pt) / h ** 2 for h in (1, 2, 3)) * env(pn, .004, .11)
        place(wet, pl, at + k * beat / 2, .045 if k % 2 == 0 else .03)
irn = int(1.8 * SR); tt = np.arange(irn) / SR
def ir(seed):
    r = np.random.default_rng(seed).standard_normal(irn) * np.exp(-tt / .45); r[: int(.012 * SR)] = 0
    return lp(r, 4500, 250)
def conv(x, h):
    M = 1 << (len(x) + len(h) - 2).bit_length()
    return np.fft.irfft(np.fft.rfft(x, M) * np.fft.rfft(h, M), M)[: len(x)]
k = .25 / np.sqrt(np.mean(ir(1) ** 2) * irn)
bed = np.stack([lp(dry + wet + conv(wet, ir(1)) * k, 9000, 30), lp(dry + wet + conv(wet, ir(2)) * k, 9000, 30)], 1)
save("bed.wav", np.tanh(bed * 1.4), .7)

cfg = os.path.join(os.path.dirname(__file__), "..", "src", "audio.json")
json.dump({"music": True, "sfx": True}, open(cfg, "w"))
print("wrote", sorted(os.listdir(OUT)), "bed seconds:", round(N / SR, 1))
