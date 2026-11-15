import sys, json
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]; MASK=len(sys.argv)>2; PA='C' if MASK else 'A'; PB='D' if MASK else 'B'; info=json.load(open(S+'/systems.json'))
try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',15)
except Exception: font=ImageFont.load_default()
LET='abcdefghijklm'
for case,v in info.items():
    for inf in v:
        im=Image.open(S+'/'+inf['file']).convert('RGB'); ys=inf['lineYs']; half=(ys[3]-ys[0])/6.0
        ypos={l: ys[3]-(k-3)*half for k,l in enumerate(LET)}   # d = unterste Linie, j = oberste
        # Schluessel am Zeilenanfang weiss ueberdecken (wird sonst als Noten gelesen)
        import numpy as np
        if MASK:
            g0=np.array(im.convert('L'))<140; gp=inf['gap']
            hit=sum(g0[int(y)-3:int(y)+4].any(axis=0).astype(int) for y in ys)>=4
            xs=np.where(hit)[0]
            run=[x for x in xs if hit[x:x+60].sum()>40]
            sx=int(run[0]) if run else int(xs[0])
            d0=ImageDraw.Draw(im); d0.rectangle((sx-int(0.4*gp),int(ys[0]-1.3*gp),sx+int(1.15*gp),int(ys[3]+1.3*gp)),fill=(255,255,255))
            for y in ys: d0.line((sx,y,sx+int(1.15*gp),y),fill=(60,60,60),width=3)
        im.save(S+'/'+PA+'-'+inf['file'])
        # Variante B: Lineale + feine Hilfslinien in den Zwischenraeumen
        nseg=max(2,round(im.width/300)); RW=40
        z=min(2.0,(2560-(nseg+1)*RW)/im.width)
        zi=im.resize((int(im.width*z),int(im.height*z)),Image.LANCZOS)
        d=ImageDraw.Draw(zi)
        for l in 'cegik':
            y=ypos[l]*z
            if 0<y<zi.height: d.line((0,y,zi.width,y),fill=(120,200,255),width=1)
        segw=zi.width//nseg
        import numpy as np
        g=np.array(zi.convert('L'))<140
        mask=np.ones(zi.height,bool)
        for y in ys: mask[max(0,int(y*z)-4):int(y*z)+5]=False   # Notenlinien nicht mitzaehlen
        col=g[mask].sum(axis=0)
        cuts=[0]
        for i in range(1,nseg):
            c=i*segw; lo=max(cuts[-1]+80,c-90); hi=min(zi.width-80,c+90)
            win=np.convolve(col[lo:hi],np.ones(9),'same'); cuts.append(lo+int(win.argmin()))
        cuts.append(zi.width)
        out=Image.new('RGB',(zi.width+(nseg+1)*RW,zi.height),(255,255,255)); x=0
        def ruler(x0):
            r=ImageDraw.Draw(out); r.rectangle((x0,0,x0+RW-1,out.height),fill=(255,244,200))
            for l in LET:
                y=ypos[l]*z
                if 8<y<out.height-8:
                    r.line((x0,y,x0+7,y),fill=(220,0,0),width=2); r.line((x0+RW-8,y,x0+RW-1,y),fill=(220,0,0),width=2)
                    r.text((x0+14,y-9),l,fill=(200,0,0),font=font)
        for i in range(nseg):
            ruler(x); x+=RW
            a=cuts[i]; b=cuts[i+1]
            out.paste(zi.crop((a,0,b,zi.height)),(x,0)); x+=b-a
        ruler(x)
        out.save(S+'/'+PB+'-'+inf['file']); inf['B']=[out.width,out.height]
json.dump(info,open(S+'/systems.json','w'),indent=1)
print({c:[i['B'] for i in v] for c,v in info.items()})
