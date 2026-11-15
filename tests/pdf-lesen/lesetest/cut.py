import sys, json, numpy as np
from PIL import Image, ImageDraw
S=sys.argv[1]
def linecands(dark,lo,hi):
    H,W=dark.shape
    cnt=dark[:,int(W*lo):int(W*hi)].sum(axis=1); peak=np.sort(cnt)[-20:].mean()
    rows=[y for y in range(H) if cnt[y]>0.45*peak]; cl=[]
    for y in rows:
        if cl and y-cl[-1][-1]<=2: cl[-1].append(y)
        else: cl.append([y])
    return [(c[0]+c[-1])/2 for c in cl if len(c)<=12]
def group(lines):
    gaps=sorted(b-a for a,b in zip(lines,lines[1:]) if 12<b-a<60)
    g=gaps[len(gaps)//2]
    out=[];i=0
    while i+3<len(lines):
        q=lines[i:i+4]
        if all(abs((q[k+1]-q[k])-g)<0.25*g for k in range(3)): out.append(q); i+=4
        else: i+=1
    return out,g
def staves(path):
    im=Image.open(path).convert('L'); W=im.width
    dark=np.array(im)<140
    L,_=group(linecands(dark,0.25,0.40)); R,_=group(linecands(dark,0.60,0.75))
    ang=0.0
    pairs=[(l,min(R,key=lambda r:abs(r[0]-l[0]))) for l in L] if R else []
    pairs=[(l,r) for l,r in pairs if abs(r[0]-l[0])<30]
    if pairs:
        dy=np.median([r[0]-l[0] for l,r in pairs]); ang=float(np.degrees(np.arctan2(dy,0.35*W)))
        im=im.rotate(ang,resample=Image.BICUBIC,fillcolor=255); dark=np.array(im)<140
    print('  skew %.2f deg'%ang, len(L), len(R))
    out,g=group(linecands(dark,0.30,0.70))
    # horizontal extent of each staff
    res=[]
    for q in out:
        ys=[int(round(y)) for y in q]; cols=np.where(sum(dark[y-4:y+5].any(axis=0).astype(int) for y in ys)>=4)[0]
        hist=np.zeros(dark.shape[1],int); hist[cols]=1
        # groesster zusammenhaengender Bereich (Luecken bis 40px erlaubt)
        best=(0,0);st0=None;last=None
        for x in cols:
            if st0 is None: st0=x
            elif x-last>40:
                if last-st0>best[1]-best[0]: best=(st0,last)
                st0=x
            last=x
        if last-st0>best[1]-best[0]: best=(st0,last)
        res.append({'lines':q,'x0':int(best[0]),'x1':int(best[1])})
    return im,res,g
allinfo={}
for case in ['ave-maria-1','salve-mater','surrexit-ad-cenam']:
    im,st,g=staves('%s/pages/%s-1.png'%(S,case)); print(case,'staves',len(st),'gap %.1f'%g,[round(s['lines'][0]) for s in st])
    info=[]
    for k,s in enumerate(st):
        top=int(s['lines'][0]-1.5*g)
        nxt=st[k+1]['lines'][0]-1.3*g if k+1<len(st) else 1e9
        bot=int(min(nxt, s['lines'][3]+3.0*g))   # Notensystem + erste Textzeile
        x0=max(0,s['x0']-int(4.5*g)); x1=min(im.width,s['x1']+int(1.0*g))
        crop=im.crop((x0,top,x1,bot)); crop.save('%s/sys-%s-%d.png'%(S,case,k+1))
        info.append({'file':'sys-%s-%d.png'%(case,k+1),'lineYs':[y-top for y in s['lines']],'gap':g,'w':crop.width,'h':crop.height})
    allinfo[case]=info
    W=1200; parts=[]
    for i,inf in enumerate(info):
        c=Image.open('%s/%s'%(S,inf['file'])).convert('RGB'); r=c.resize((W,int(c.height*W/c.width)))
        ImageDraw.Draw(r).text((4,4),'#%d'%(i+1),fill=(255,0,0)); parts.append(r)
    sheet=Image.new('RGB',(W,sum(p.height+5 for p in parts)),(255,0,0)); y=0
    for p in parts: sheet.paste(p,(0,y)); y+=p.height+5
    sheet.save('%s/sheet-%s.png'%(S,case))
json.dump(allinfo,open(S+'/systems.json','w'),indent=1)
