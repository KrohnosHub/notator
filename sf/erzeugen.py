# «Orgel – sanft»: additiv synthetisierte Labialpfeife (kein Sample-Einschwingen),
# Variante per Argument. Gleichmässiger Ansatz 40 ms, Ton steht ruhig, leichtes
# Winde-Leben (langsame Amplituden-/Tonhöhenschwankung, sehr leises Windrauschen).
import numpy as np, subprocess, os, sys
SR=44100; L=int(5.0*SR)
VAR=sys.argv[1] if len(sys.argv)>1 else 'rohr'
OUT=sys.argv[2] if len(sys.argv)>2 else '/home/claude/notator/sf/recorder-mp3/'
os.makedirs(OUT,exist_ok=True)
pn=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
name=lambda m: pn[m%12]+str(m//12-1)
# Teiltonspektren (relativ zum Grundton)
SPEC={
 # Rohrflöte 8': halbgedeckt – kräftiger 3. Teilton, etwas 2./5.
 'rohr':  ([1,0.30,0.34,0.10,0.13,0.04,0.05,0.02,0.02], 0.12, [1,0.12,0.10]),
 # weicher Prinzipal 8' (Salizional-ähnlich) + leise Flöte 4'
 'prin':  ([1,0.55,0.32,0.22,0.14,0.10,0.07,0.05,0.035,0.025,0.018], 0.10, [1,0.10,0.06]),
}
H8, lev4, H4 = SPEC[VAR]
rng=np.random.default_rng(7)
t=np.arange(L)/SR
def tone(f0, H, seed):
    r=np.random.default_rng(seed); y=np.zeros(L)
    vib=1+0.0006*np.sin(2*np.pi*0.7*t+r.uniform(0,6))          # minimales Windschwanken
    am=1+0.012*np.sin(2*np.pi*0.45*t+r.uniform(0,6))
    ph=np.cumsum(2*np.pi*f0*vib/SR)
    for k,a in enumerate(H,1):
        if k*f0>9000: break
        roll=1/(1+(k*f0/4500)**2)   # hohe Teiltöne bei hohen Lagen sanft zurücknehmen
        y+=a*roll*np.sin(k*ph+r.uniform(0,6))
    return y*am
for m in range(33,88):
    f0=440*2**((m-69)/12)
    y=tone(f0,H8,m)+lev4*tone(2*f0,H4,m+500)
    # sehr leises, tiefpassgefiltertes Windrauschen
    n=rng.normal(0,1,L); k=np.ones(40)/40; n=np.convolve(n,k,'same'); y+=0.004*n/np.std(n)*np.std(y)
    y=y/np.sqrt(np.mean(y**2))*0.16
    a=int(0.04*SR); y[:a]*=np.sin(np.linspace(0,np.pi/2,a))**2
    r=int(0.06*SR); y[-r:]*=np.linspace(1,0,r)
    y=np.clip(y,-0.98,0.98).astype(np.float32)
    subprocess.run(['ffmpeg','-v','quiet','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-b:a','48k',OUT+name(m)+'.mp3'],input=y.tobytes())
print(VAR,'ok',len(os.listdir(OUT)))
