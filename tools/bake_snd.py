"""Turn eighteen recordings into a sound bank small enough to live inside the
   game file.

   THE THREE THINGS WRONG WITH THE SOURCES, all measured, none of them anyone's
   fault:

   1. Every MP3 opens with 25-34 ms of silence and the WAV with 503 ms. That is
      the encoder's own padding, not the recording. Left in, the gun fires two
      frames after you click, and "the click and the bang are not the same
      event" is most of what makes a game weapon feel dead. Cut to the onset.

   2. Every file peaks over 0 dBFS -- up to +8.3 -- because they were mastered
      into a limiter. Nothing to fix in the waveform, but it means the game
      cannot just play them at gain 1.0 next to everything else.

   3. Most are much longer than their content. B- is 3.22 s of file for 1.27 s
      of sound. Silence costs bytes in a file that has to be downloaded.

   AND ONE THING RIGHT: the shots are real stereo (channel correlation 0.75,
   side within 4 dB of mid). That width IS the room, and the room is what makes
   a gunshot sound big rather than close. They stay stereo. The pumps and the
   clicks are dual mono to the sample -- correlation 1.0000, side 60 to 93 dB
   down -- so those collapse for free.

   Levels are matched WITHIN a group and not across them: ten shots that vary
   by 6 dB read as a bug, but a pump that is as loud as a gunshot reads as a
   different bug. The relationship BETWEEN groups is set in the game, in gain
   nodes, where it can be tuned without re-encoding anything."""
import subprocess, os, glob, json, base64, numpy as np

FF  = r'C:\ffmpeg\bin\ffmpeg.exe'
SRC = r'E:\Claude\CampoMinado3D\Shotgun src'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bank')
SR  = 48000
os.makedirs(OUT, exist_ok=True)

def load(path, ch):
    r = subprocess.run([FF, '-v', 'error', '-i', path, '-ac', str(ch), '-ar', str(SR),
                        '-f', 'f32le', '-'], capture_output=True)
    if r.returncode: raise RuntimeError(r.stderr.decode()[:400])
    a = np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)
    return a.reshape(-1, ch)

def trim(a):
    """Cut to the onset, and cut the dead tail with a fade so the reverb ends
       instead of stopping."""
    m = np.abs(a).max(axis=1)
    pk = m.max()
    hot = np.flatnonzero(m >= pk * 10**(-40/20))
    start = max(0, int(hot[0]) - int(SR*0.006))       # 6 ms of run-up, no more
    w = SR//100
    n = len(m) - len(m) % w
    env = np.sqrt(np.add.reduceat((m[:n]**2), np.arange(0, n, w)) / w)
    live = np.flatnonzero(env > 10**(-60/20))
    end = min(len(a), int((live[-1]+1)*w + SR*0.12)) if len(live) else len(a)
    b = a[start:end].copy()
    f = int(SR*0.040)
    if len(b) > f:                                     # 40 ms cosine, no click
        b[-f:] *= (0.5*(1+np.cos(np.linspace(0, np.pi, f))))[:, None]
    return b

def bang_rms(a, secs=0.20):
    n = min(len(a), int(SR*secs))
    return float(np.sqrt((a[:n]**2).mean()))

GROUPS = {
    'S': dict(files=sorted(glob.glob(os.path.join(SRC, 'SHOT',  '*'))), ch=2, kbps=56),
    'L': dict(files=sorted(glob.glob(os.path.join(SRC, 'LOAD',  '*'))), ch=1, kbps=40),
    'C': dict(files=sorted(glob.glob(os.path.join(SRC, '*.mp3'))),      ch=1, kbps=40),
}

manifest, total = {}, 0
for tag, G in GROUPS.items():
    cut = [trim(load(f, G['ch'])) for f in G['files']]
    # match the BANG, not the whole file: a long reverb tail must not make a
    # take count as loud.
    target = float(np.median([bang_rms(c) for c in cut]))
    gains  = [float(np.clip(target/max(1e-9, bang_rms(c)), 10**(-5/20), 10**(5/20)))
              for c in cut]
    # then one factor for the whole group, so what survives of the takes'
    # natural differences survives intact.
    top = max(float(np.abs(c).max())*g for c, g in zip(cut, gains))
    norm = 10**(-1/20) / top
    print(f'--- {tag}: {len(cut)} files, group gain {20*np.log10(norm):+.1f} dB')
    ids = []
    for i, (path, c, g) in enumerate(zip(G['files'], cut, gains)):
        y = np.clip(c*g*norm, -1.0, 1.0)
        name = f'{tag}{i}'
        raw = os.path.join(OUT, name+'.wav')
        subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR),
                        '-ac', str(G['ch']), '-i', '-', '-c:a', 'pcm_f32le', raw],
                       input=y.astype(np.float32).tobytes(), check=True)
        web = os.path.join(OUT, name+'.webm')
        subprocess.run([FF, '-v', 'error', '-y', '-i', raw, '-c:a', 'libopus',
                        '-b:a', f'{G["kbps"]}k', '-vbr', 'on',
                        '-application', 'audio', '-frame_duration', '20', web],
                       check=True)
        sz = os.path.getsize(web); total += sz
        ids.append(name)
        print(f'  {name:<4} {len(c)/SR:5.2f}s  gain {20*np.log10(g):+5.1f} dB  '
              f'peak {20*np.log10(max(1e-9,np.abs(y).max())):5.1f}  '
              f'{sz/1024:6.1f} KB  {os.path.basename(path)}')
    manifest[tag] = ids

b64 = {n: base64.b64encode(open(os.path.join(OUT, n+'.webm'), 'rb').read()).decode()
       for g in manifest.values() for n in g}
json.dump({'groups': manifest, 'b64': b64}, open(os.path.join(OUT, 'bank.json'), 'w'))
print(f'\ntotal opus {total/1024:.1f} KB   as base64 {sum(map(len, b64.values()))/1024:.1f} KB')
