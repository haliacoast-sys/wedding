# -*- coding: utf-8 -*-
import sys, math
sys.path.insert(0,'/home/claude/saju')
from astro import *
from datetime import datetime, timedelta, timezone, date

GAN=list("갑을병정무기경신임계"); GAN_H=list("甲乙丙丁戊己庚辛壬癸")
JI =list("자축인묘진사오미신유술해"); JI_H=list("子丑寅卯辰巳午未申酉戌亥")
GAN_OH={'갑':('목','+'),'을':('목','-'),'병':('화','+'),'정':('화','-'),'무':('토','+'),
        '기':('토','-'),'경':('금','+'),'신':('금','-'),'임':('수','+'),'계':('수','-')}
JI_OH={'자':('수','+'),'축':('토','-'),'인':('목','+'),'묘':('목','-'),'진':('토','+'),'사':('화','-'),
       '오':('화','+'),'미':('토','-'),'신':('금','+'),'유':('금','-'),'술':('토','+'),'해':('수','-')}
# 실무 음양(체용): 사=+화, 오=-화, 자=-수, 해=+수
JI_OH_USE={'자':('수','-'),'축':('토','-'),'인':('목','+'),'묘':('목','-'),'진':('토','+'),'사':('화','+'),
       '오':('화','-'),'미':('토','-'),'신':('금','+'),'유':('금','-'),'술':('토','+'),'해':('수','+')}
JIJANGGAN={'자':['임','계'],'축':['계','신','기'],'인':['무','병','갑'],'묘':['갑','을'],
 '진':['을','계','무'],'사':['무','경','병'],'오':['병','기','정'],'미':['정','을','기'],
 '신':['무','임','경'],'유':['경','신'],'술':['신','정','무'],'해':['무','갑','임']}

def gz(n): return GAN[n%10]+JI[n%12]
def gz_h(n): return GAN_H[n%10]+JI_H[n%12]
def gz_idx(name):
    g=GAN.index(name[0]); j=JI.index(name[1])
    for n in range(60):
        if n%10==g and n%12==j: return n

def term_near(ref_dt, target_deg):
    """ref_dt(KST) 근처에서 태양황경 target_deg 도달 시각"""
    jde=dt_to_jd(ref_dt)+delta_T(ref_dt.year)/86400.0
    for _ in range(80):
        lam=sun_apparent_longitude(jde)
        diff=(lam-target_deg+180)%360-180
        jde-=diff*365.2422/360.0
        if abs(diff)<1e-9: break
    ut=jde-delta_T(ref_dt.year)/86400.0
    return jd_to_dt_utc(ut).astimezone(KST)

# 12절 (월건 경계)
JEOL=[(315,'입춘','인'),(345,'경칩','묘'),(15,'청명','진'),(45,'입하','사'),(75,'망종','오'),
      (105,'소서','미'),(135,'입추','신'),(165,'백로','유'),(195,'한로','술'),(225,'입동','해'),
      (255,'대설','자'),(285,'소한','축')]
APPROX={315:(2,4),345:(3,6),15:(4,5),45:(5,6),75:(6,6),105:(7,7),135:(8,8),165:(9,8),
        195:(10,8),225:(11,7),255:(12,7),285:(1,6)}

def jeol_list(year):
    out=[]
    for deg,nm,br in JEOL:
        m,d=APPROX[deg]
        t=term_near(datetime(year,m,d,12,0,tzinfo=KST),deg)
        out.append((t,nm,br,deg))
    out.sort()
    return out

# ---- 일주 ----
REF_DATE=date(1998,3,15); REF_IDX=gz_idx('신유')   # 앱 데이터로 고정
def day_gz_idx(d): return (REF_IDX+(d-REF_DATE).days)%60

def year_gz_idx(y): return (y-4)%60   # 서기 4년 = 갑자
def month_gz_idx(year_gan_idx, br):
    # 오호둔: 갑기->병인, 을경->무인, 병신->경인, 정임->임인, 무계->갑인
    start={0:2,1:4,2:6,3:8,4:0}[year_gan_idx%5]      # 인월 천간 index
    off=(JI.index(br)-2)%12
    g=(start+off)%10; j=(2+off)%12
    for n in range(60):
        if n%10==g and n%12==j: return n

def pillars(dt):
    """dt: KST datetime(진태양시 보정 완료본) -> (년,월,일,시) 60갑자 index"""
    js=jeol_list(dt.year)
    prev=[x for x in js if x[0]<=dt]
    if prev: t,nm,br,deg=prev[-1]
        # 입춘 이후면 당해년
    else:
        js0=jeol_list(dt.year-1); t,nm,br,deg=js0[-1]
    ipchun=[x for x in js if x[3]==315][0][0]
    yy=dt.year if dt>=ipchun else dt.year-1
    yidx=year_gz_idx(yy)
    midx=month_gz_idx(yidx%10, br)
    didx=day_gz_idx(dt.date())
    # 시주: 야자시 미적용(조자시=당일)
    h=dt.hour+dt.minute/60.0
    hb=int(((h+1)%24)//2)
    st={0:0,1:2,2:4,3:6,4:8}[didx%10%5]
    hg=(st+hb)%10
    for n in range(60):
        if n%10==hg and n%12==hb%12: hidx=n; break
    return yidx,midx,didx,hidx
