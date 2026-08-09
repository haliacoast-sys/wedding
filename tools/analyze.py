# -*- coding: utf-8 -*-
import sys; sys.path.insert(0,'/home/claude/saju')
from core import *
from datetime import datetime, date, timedelta

def sipseong(day_gan, other, is_ji=False):
    do,dy=GAN_OH[day_gan]
    if is_ji: oo,oy=JI_OH_USE[other]
    else: oo,oy=GAN_OH[other]
    same = (dy==oy)
    seq=['목','화','토','금','수']
    di=seq.index(do); oi=seq.index(oo)
    rel=(oi-di)%5
    if rel==0: return '비견' if same else '겁재'
    if rel==1: return '식신' if same else '상관'
    if rel==2: return '편재' if same else '정재'
    if rel==3: return '편관' if same else '정관'
    return '편인' if same else '정인'

UNSEONG=['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양']
UNSEONG_START={'갑':'해','병':'인','무':'인','경':'사','임':'신',
               '을':'오','정':'유','기':'유','신':'자','계':'묘'}
def unseong(g,j):
    st=JI.index(UNSEONG_START[g]); cur=JI.index(j)
    fwd = GAN_OH[g][1]=='+'
    d=(cur-st)%12 if fwd else (st-cur)%12
    return UNSEONG[d]

def gongmang(day_idx):
    g=day_idx%10; j=day_idx%12
    start=(j-g)%12   # 순수(旬首) 지지 index
    return [JI[(start+10)%12], JI[(start+11)%12]]

class Myeong:
    def __init__(self,name,dt_true,gender,birthinfo):
        self.name=name; self.dt=dt_true; self.gender=gender; self.info=birthinfo
        y,m,d,h=pillars(dt_true)
        self.idx={'년':y,'월':m,'일':d,'시':h}
        self.gan={k:GAN[v%10] for k,v in self.idx.items()}
        self.ji ={k:JI[v%12]  for k,v in self.idx.items()}
        self.dg=self.gan['일']
    def table(self):
        rows=[]
        for pos in ['시','일','월','년']:
            g,j=self.gan[pos],self.ji[pos]
            rows.append(dict(pos=pos, gan=g, gan_h=GAN_H[GAN.index(g)], ji=j, ji_h=JI_H[JI.index(j)],
                gan_oh=GAN_OH[g][0], gan_yy=GAN_OH[g][1], ji_oh=JI_OH_USE[j][0], ji_yy=JI_OH_USE[j][1],
                gan_ss=('일간' if pos=='일' else sipseong(self.dg,g)),
                ji_ss=sipseong(self.dg,j,True), jjg=JIJANGGAN[j],
                us=unseong(self.dg,j)))
        return rows
    def ohaeng(self):
        cnt={'목':0,'화':0,'토':0,'금':0,'수':0}
        for pos in ['년','월','일','시']:
            cnt[GAN_OH[self.gan[pos]][0]]+=1
            cnt[JI_OH_USE[self.ji[pos]][0]]+=1
        return cnt
    def sipseong_cnt(self):
        c={}
        for pos in ['년','월','일','시']:
            if pos!='일':
                s=sipseong(self.dg,self.gan[pos]); c[s]=c.get(s,0)+1
            s=sipseong(self.dg,self.ji[pos],True); c[s]=c.get(s,0)+1
        return c
    def daeun(self):
        yg=self.gan['년']; yang = GAN_OH[yg][1]=='+'
        forward = (yang and self.gender=='M') or ((not yang) and self.gender=='F')
        js=jeol_list(self.dt.year)+jeol_list(self.dt.year-1)+jeol_list(self.dt.year+1)
        js.sort()
        if forward:
            nxt=[t for t,_,_,_ in js if t>self.dt][0]; delta=(nxt-self.dt).total_seconds()/86400.0
        else:
            prv=[t for t,_,_,_ in js if t<=self.dt][-1]; delta=(self.dt-prv).total_seconds()/86400.0
        num=delta/3.0
        start=int(num) if (num-int(num))<0.5 else int(num)+1
        if start==0: start=1
        out=[]
        for i in range(1,10):
            idx=(self.idx['월']+i)%60 if forward else (self.idx['월']-i)%60
            a=start+(i-1)*10
            out.append(dict(age=a, gz=gz(idx), gz_h=gz_h(idx), year=self.dt.year+a,
                gan_ss=sipseong(self.dg,GAN[idx%10]), ji_ss=sipseong(self.dg,JI[idx%12],True),
                us=unseong(self.dg,JI[idx%12])))
        return dict(forward=forward, days=round(delta,3), num=start, list=out)

SONG=Myeong('송지영',datetime(1998,3,15,6,41,tzinfo=KST),'F','1998-03-15 07:07 여 / 영주')
LEE =Myeong('이주호',datetime(1994,5,19,12,4,tzinfo=KST),'M','1994-05-19 12:30 남 / 창원')

if __name__=='__main__':
    for M in (SONG,LEE):
        print('='*60); print(M.name, M.info)
        for r in M.table():
            print(f"  {r['pos']}주 {r['gan']}{r['ji']}({r['gan_h']}{r['ji_h']}) 간:{r['gan_ss']:<3} 지:{r['ji_ss']:<3} 지장간:{''.join(r['jjg'])} 운성:{r['us']}")
        print('  오행:',M.ohaeng(),' 십성:',M.sipseong_cnt())
        print('  공망:',gongmang(M.idx['일']))
        du=M.daeun()
        print(f"  대운 {'순행' if du['forward'] else '역행'} 절입거리 {du['days']}일 -> 대운수 {du['num']}")
        for d in du['list']:
            print(f"    {d['age']:>2}세({d['year']}~) {d['gz']}({d['gz_h']}) {d['gan_ss']}/{d['ji_ss']} 운성:{d['us']}")
