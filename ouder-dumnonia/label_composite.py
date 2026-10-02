import cv2, numpy as np
from PIL import Image
T8=np.array(Image.open('images/3.webp').convert('RGB')); T=T8.astype(np.float32)
R=np.array(Image.open('work/rect.png').convert('RGB')).astype(np.float32)
N=600; B=60
yy,xx=np.mgrid[0:N,0:N]
top=(yy<=xx)&(yy<=N-1-xx)
right=(N-1-xx<yy)&(N-1-xx<=N-1-yy)&~top
bottom=(N-1-yy<xx)&(N-1-yy<N-1-xx)&~top&~right
left=~(top|right|bottom)
band=(xx<B)|(yy<B)|(xx>=N-B)|(yy>=N-B)
L=R.copy()
for rot,reg in ((np.rot90(R,-1),right),(np.rot90(R,2),bottom),(np.rot90(R,1),left)):
    sel=band&reg; L[sel]=rot[sel]
d=np.float32([[0,0],[N,0],[N,N],[0,N]])
dst=np.float32([[934,806],[1165,1014],[961,1229],[729,1015]])
H=cv2.getPerspectiveTransform(d,dst)
h,w=T.shape[:2]
W=cv2.warpPerspective(L,H,(w,h),flags=cv2.INTER_LANCZOS4)
bandW=cv2.warpPerspective(band.astype(np.uint8),H,(w,h),flags=cv2.INTER_NEAREST)>0
fieldW=cv2.warpPerspective((~band).astype(np.uint8),H,(w,h),flags=cv2.INTER_NEAREST)>0
lab=lambda a: cv2.cvtColor(np.clip(a,0,255).astype(np.uint8),cv2.COLOR_RGB2LAB).astype(np.float32)
Tl=lab(T); Wl=lab(W)
for m,kstd in ((bandW,0.7),(fieldW,1.0)):
    for c in range(3):
        tm,ts=Tl[...,c][m].mean(),Tl[...,c][m].std()
        wm,ws=Wl[...,c][m].mean(),Wl[...,c][m].std()
        k=(ts/ws)*kstd if c==0 else 1.0
        Wl[...,c][m]=(Wl[...,c][m]-wm)*k+tm
W=cv2.cvtColor(np.clip(Wl,0,255).astype(np.uint8),cv2.COLOR_LAB2RGB).astype(np.float32)
# bevel shading in label space -> warp
shade=np.ones((N,N),np.float32)
shade[band&left]=1.08; shade[band&right]=0.88; shade[band&bottom]=0.96
shade=cv2.GaussianBlur(shade,(0,0),1.2)
S=cv2.warpPerspective(shade,H,(w,h),borderValue=1.0)
W*=S[...,None]
bl=cv2.GaussianBlur(W,(0,0),1.3); W=W*1.35-bl*0.35
W+=np.random.default_rng(1).normal(0,2.0,W.shape)
mask=cv2.warpPerspective(np.ones((N,N),np.float32),H,(w,h))
a=cv2.GaussianBlur(mask,(0,0),0.7)[...,None]
O=np.clip(T*(1-a)+W*a,0,255).astype(np.uint8)
Image.fromarray(O).save('work/out3.png')
Image.fromarray(O).crop((700,780,1200,1260)).resize((1000,960)).save('work/out3_zoom.png')
