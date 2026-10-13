# Erzeugt «Orgel sanft»-Samples (Gedackt 8' + Flöte 4') aus FluidR3-«recorder» (MIT-Lizenz):
# Einschwing-«Buckel» entfernt, gleichmässiger Ansatz (35 ms), gleiche Lautheit, 5 s gehalten.
import re,base64,subprocess,numpy as np,os
SR=44100
src=open('sf/recorder.js').read()
names={}
pn=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
def name(m): return pn[m%12]+str(m//12-1)
def load(m):
    mm=re.search(r'"%s":\s*"data:audio/mp3;base64,([^"]+)"'%name(m),src)
    if not mm: return None
    open('/tmp/x.mp3','wb').write(base64.b64decode(mm.group(1)))
    raw=subprocess.run(['ffmpeg','-v','quiet','-i','/tmp/x.mp3','-f','f32le','-ac','1','-ar',str(SR),'-'],capture_output=True).stdout
    return np.frombuffer(raw,dtype=np.float32).astype(np.float64)
def steady(x):
    s=x[int(0.30*SR):int(2.6*SR)]
    # Pegel innerhalb des Ausschnitts glätten (langsames Abklingen ausgleichen)
    h=2205; env=np.array([np.sqrt(np.mean(s[i:i+h]**2))+1e-9 for i in range(0,len(s)-h,h)])
    g=np.interp(np.arange(len(s)), np.arange(len(env))*h+h/2, env.mean()/env)
    return s*g
def loop_to(s, n):
    xf=int(0.25*SR); out=s.copy()
    while len(out)<n:
        a=out[-xf:]; b=s[:xf]; w=np.linspace(0,1,xf)
        out=np.concatenate([out[:-xf], a*(1-w)+b*w, s[xf:]])
    return out[:n]
OUT='/home/claude/notator/sf/recorder-mp3/'; os.makedirs(OUT,exist_ok=True)
L=int(5.0*SR)
for m in range(33,88):
    x=load(m); y=load(m+12)
    if x is None: print('fehlt',name(m)); continue
    base=loop_to(steady(x),L)
    if y is not None: base=base+0.28*loop_to(steady(y),L)
    base=base/np.sqrt(np.mean(base**2))*0.16
    fi=int(0.035*SR); base[:fi]*=np.linspace(0,1,fi)**1.5
    fo=int(0.06*SR); base[-fo:]*=np.linspace(1,0,fo)
    base=np.clip(base,-0.98,0.98).astype(np.float32)
    p=subprocess.run(['ffmpeg','-v','quiet','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-ar','44100','-b:a','48k',OUT+name(m)+'.mp3'],input=base.tobytes())
print('ok', len(os.listdir(OUT)), sum(os.path.getsize(OUT+f) for f in os.listdir(OUT))//1024,'KB')
