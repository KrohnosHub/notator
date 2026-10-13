# «Orgel – sanft»: echte Pfeifenorgel-Aufnahme (VSCO 2 CE, Keys/Organ/Quiet,
# aufgenommen von Simon Dalzell / Ivy Audio, frei weitergebbar) -> abcjs-Samples.
# Je Halbton das nächstgelegene Original (Abstand max. 1 Halbton) umgestimmt,
# Anfangsstille entfernt, 6 s Länge, Lautheit leicht angeglichen.
import numpy as np, subprocess, os, glob, sys
SRC=sys.argv[1]; OUT=sys.argv[2]; PAT=sys.argv[3]; OFS=int(sys.argv[4])
os.makedirs(OUT,exist_ok=True)
pn=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
name=lambda m: pn[m%12]+str(m//12-1)
SR=44100
files={}
for f in glob.glob(SRC+PAT):
    n=int(os.path.basename(f).split('_')[2]); files[n-OFS]=f
def load(f, semis):
    rate=SR*2**(semis/12)
    raw=subprocess.run(['ffmpeg','-v','quiet','-i',f,'-af','asetrate=%d,aresample=%d'%(round(rate),SR),'-f','f32le','-ac','1','-'],capture_output=True).stdout
    return np.frombuffer(raw,dtype=np.float32).astype(float)
L=int(6.0*SR); rms=[]
outs={}
for m in range(33,88):
    src=min(files, key=lambda k: abs(k-m)); x=load(files[src], m-src)
    env=np.array([np.sqrt(np.mean(x[i:i+441]**2)) for i in range(0,len(x)-441,441)])
    on=max(0,int(np.argmax(env>0.05*env.max())*441)-int(0.005*SR))
    y=x[on:on+L].copy()
    if len(y)<L: y=np.pad(y,(0,L-len(y)))
    y[:int(0.003*SR)]*=np.linspace(0,1,int(0.003*SR))
    fo=int(0.08*SR); y[-fo:]*=np.linspace(1,0,fo)
    r=np.sqrt(np.mean(y[int(0.5*SR):int(3*SR)]**2)); rms.append(r); outs[m]=(y,r)
ref=np.median(rms)
for m,(y,r) in outs.items():
    g=(ref/r)**0.6 * 0.16/ref    # teilweise Angleichung, natürliche Intonation bleibt erkennbar
    y=np.clip(y*g,-0.98,0.98).astype(np.float32)
    subprocess.run(['ffmpeg','-v','quiet','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-b:a','64k',OUT+name(m)+'.mp3'],input=y.tobytes())
print('ok',len(outs), sum(os.path.getsize(OUT+f) for f in os.listdir(OUT))//1024,'KB')
