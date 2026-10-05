# Places the real Commodity Spice bottle (background-removed cutout) into the
# reference scene without regenerating it: the scene pixels, hands and colours
# stay exactly as in the reference; only the bottle is added, graded to the
# scene's red light, with a contact shadow, and with the upper-hand fingers
# and the near palm edge kept in front of it.
# Usage: python3 composite_bottle.py <bottle_height_px> <center_x> <base_y>
# Shot 1 used: 520 405 845 on the 1200x1200 reference, then Higgsfield
# outpaint to 4:5.
import numpy as np, sys
from PIL import Image, ImageFilter, ImageDraw
ref=Image.open('ref.jpg').convert('RGB'); R=np.asarray(ref).astype(np.float32)/255
W=Hh=1200
cut=Image.open('cut.png').convert('RGBA').crop((270,91,557,724))
H,cx,ybase=[int(v) for v in sys.argv[1:4]]
w=round(H*cut.width/cut.height)
cut=cut.resize((w,H),Image.LANCZOS)
c=np.asarray(cut).astype(np.float32)/255
a=c[...,3]
L=(0.3*c[...,0]+0.59*c[...,1]+0.11*c[...,2])
# gradient map onto the reds measured from the reference
stops=np.array([0,0.12,0.3,0.55,0.8,1.0])
cols=np.array([[10,0,0],[28,1,2],[70,4,6],[140,12,10],[205,34,24],[228,62,44]])/255
col=np.stack([np.interp(L,stops,cols[:,k]) for k in range(3)],-1)
xx=np.linspace(0,1,w)[None,:]; yy=np.linspace(0,1,H)[:,None]
col=col*(1.2-0.8*xx)[...,None]
sheen=np.exp(-((xx-0.22)/0.10)**2)
streak=np.exp(-((xx-0.16)/0.028)**2)
rim=np.exp(-((xx-0.03)/0.02)**2)
capzone=(yy<0.27).astype(np.float32)
glass=1-capzone
lab=((yy>0.36)&(yy<0.88)&(xx>0.1)&(xx<0.9)).astype(np.float32)
gloss=glass*(1-0.75*lab)
col+= (sheen*0.22*gloss+streak*0.55*gloss+rim*0.35)[...,None]*np.array([1,0.09,0.06])
col+= (capzone*np.exp(-((xx-0.2)/0.07)**2)*0.28)[...,None]*np.array([1,0.1,0.07])
col+= (np.clip((yy-0.8)/0.2,0,1)*0.22)[...,None]*np.array([1,0.06,0.05])
col=np.clip(col,0,1)
bimg=Image.fromarray((np.dstack([col,a])*255).astype(np.uint8),'RGBA').filter(ImageFilter.GaussianBlur(1.4))
x0=cx-w//2; y0=ybase-H
out=R.copy()
sh=Image.new('L',(W,Hh),0); d=ImageDraw.Draw(sh)
d.ellipse((x0-6,ybase-22,x0+w+6,ybase+16),fill=255)
d.polygon([(x0+w*0.55,ybase-12),(x0+w+190,ybase-2),(x0+w+170,ybase+40),(x0+w*0.55,ybase+18)],fill=170)
sh=np.asarray(sh.filter(ImageFilter.GaussianBlur(18))).astype(np.float32)/255
out=out*(1-0.7*sh[...,None])
bl=np.zeros((Hh,W,4),np.float32); bl[y0:y0+H,x0:x0+w]=np.asarray(bimg).astype(np.float32)/255
ab=bl[...,3:4]; out=out*(1-ab)+bl[...,:3]*ab
hm=np.clip((R[...,0]-0.22)/0.18,0,1)
Y=np.arange(Hh)[:,None]*np.ones((1,W)); X=np.ones((Hh,1))*np.arange(W)[None,:]
front=((Y<640)&(X>350)) | (Y>ybase+4)
fg=np.asarray(Image.fromarray((hm*front*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32)[...,None]/255
out=out*(1-fg)+R*fg
rng=np.random.default_rng(3)
out=np.clip(out+rng.normal(0,0.012,out.shape)*np.array([1,0.4,0.4]),0,1)
Image.fromarray((out*255).astype(np.uint8)).save('comp.png')
