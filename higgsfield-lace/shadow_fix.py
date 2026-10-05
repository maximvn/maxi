# Turns the red "pasted-on" lace marks on the skin of the chosen lace-veil
# image (job 13076ce0) into real cast shadows: darker skin with soft
# penumbra edges and intact skin texture. Lips, nostrils, lace and
# background are left untouched (polygon below is in 400x500 preview
# coordinates of that image).
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
im=Image.open('n1.png').convert('RGB'); W,H=im.size; A=np.asarray(im).astype(np.float32)/255
sx=W/400; sy=H/500
def blur(x,s):
    return np.asarray(Image.fromarray((np.clip(x,0,1)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(s))).astype(np.float32)/255
poly=[(205,30),(260,5),(330,5),(350,45),(345,100),(325,160),(305,230),(295,290),(275,360),(262,430),(205,440),(195,330),(185,262),(140,235),(132,195),(150,115),(158,80),(170,50)]
pm=Image.new('L',(W,H),0); d=ImageDraw.Draw(pm)
d.polygon([(x*sx,y*sy) for x,y in poly],fill=255)
d.ellipse((135*sx,112*sy,205*sx,186*sy),fill=0)   # lips
d.ellipse((168*sx,84*sy,200*sx,110*sy),fill=0)     # nostril
region=np.asarray(pm.filter(ImageFilter.GaussianBlur(6))).astype(np.float32)/255
def run(A):
    R,G,B=A[...,0],A[...,1],A[...,2]
    L=0.3*R+0.59*G+0.11*B
    gr=G/np.maximum(R,1e-3)
    # skin reference: the brighter, unmarked skin nearby (high green/red)
    grs=np.clip(gr,0,0.9)
    hi=(grs>0.5).astype(np.float32)
    local_gr=blur(grs*hi,32)/np.maximum(blur(hi,32),1e-3)
    support=blur(hi,32)                       # is there lit skin nearby?
    redder=np.clip((local_gr-gr-0.10)/0.10,0,1)
    mark=redder*np.clip((support-0.06)/0.15,0,1)*region*np.clip((R-0.15)/0.1,0,1)
    mark=np.clip(blur(mark,1.2)*1.4,0,1)
    w=(1-mark)*hi+1e-3
    est=np.stack([blur(A[...,k]*w,16) for k in range(3)],-1)/np.maximum(blur(w,16)[...,None],1e-3)
    hp=(L-blur(L,2.5))*(1-mark)
    shadow=est*np.array([0.46,0.33,0.31])+hp[...,None]*0.5
    ms=blur(mark,3.0)
    return A*(1-ms[...,None])+shadow*ms[...,None]
out=A
for _ in range(4): out=run(np.clip(out,0,1))
rng=np.random.default_rng(1)
out=np.clip(out+rng.normal(0,0.007,out.shape)*region[...,None],0,1)
Image.fromarray((out*255).astype(np.uint8)).save('n1_shadow.png')
# final pass: any remaining saturated red marks on the skin become brown shadow of equal-ish luminance
A2=np.asarray(Image.open('n1_shadow.png').convert('RGB')).astype(np.float32)/255
R,G,B=A2[...,0],A2[...,1],A2[...,2]
gr=G/np.maximum(R,1e-3)
L=0.3*R+0.59*G+0.11*B
red=np.clip((0.38-gr)/0.12,0,1)*region*np.clip((R-0.18)/0.1,0,1)
red=blur(np.clip(blur(red,1.0)*1.5,0,1),2.0)
brown=np.stack([L*1.55,L*0.82,L*0.74],-1)*0.82
out2=A2*(1-red[...,None])+np.clip(brown,0,1)*red[...,None]
Image.fromarray((np.clip(out2,0,1)*255).astype(np.uint8)).save('n1_shadow.png')
