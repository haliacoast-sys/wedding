# -*- coding: utf-8 -*-
import sys; sys.path.insert(0,'/home/claude/saju')
from core import *
from taegil import build_lunar
from datetime import date,datetime,timedelta

YEARS=[2027,2028]
LUN={y:build_lunar(y) for y in YEARS}
LUNALL={}
for y in YEARS: LUNALL.update(LUN[y])

def lun(d): return LUNALL.get(d,(0,False,0))

# ── 공휴일 ──
def solar_holidays(y):
    h={date(y,1,1):'신정',date(y,3,1):'삼일절',date(y,5,5):'어린이날',date(y,6,6):'현충일',
       date(y,8,15):'광복절',date(y,10,3):'개천절',date(y,10,9):'한글날',date(y,12,25):'성탄절'}
    return h
def lunar_day(y,m,d):
    for dt,(lm,leap,ld) in LUN[y].items():
        if lm==m and ld==d and not leap and dt.year==y: return dt
    return None
HOL={}
for y in YEARS:
    HOL.update(solar_holidays(y))
    seol=lunar_day(y,1,1)
    if seol:
        for k in (-1,0,1): HOL[seol+timedelta(days=k)]='설날연휴'
    chu=lunar_day(y,8,15)
    if chu:
        for k in (-1,0,1): HOL[chu+timedelta(days=k)]='추석연휴'
    bu=lunar_day(y,4,8)
    if bu: HOL[bu]='부처님오신날'
HOL[date(2028,4,12)]='제23대 국회의원선거'   # 2028년 4월 둘째 수요일
# 대체공휴일 (설·추석·어린이날·삼일절·광복절·개천절·한글날·성탄절·석가탄신일)
SUB_ELIG={'설날연휴','추석연휴','어린이날','삼일절','광복절','개천절','한글날','성탄절','부처님오신날'}
for d in sorted([k for k,v in HOL.items() if v in SUB_ELIG]):
    if d.weekday()>=5:
        n=d+timedelta(days=1)
        while n.weekday()>=5 or n in HOL: n+=timedelta(days=1)
        HOL[n]=HOL[d]+'(대체)'

def is_off(d): return d.weekday()>=5 or d in HOL
def off_map(lo,hi):
    days=[lo+timedelta(days=i) for i in range((hi-lo).days+1)]
    off={d:is_off(d) for d in days}
    for _ in range(3):   # 샌드위치(브릿지) 평일 흡수
        for d in days:
            if not off.get(d,False) and d.weekday()<5:
                p,n=d-timedelta(days=1),d+timedelta(days=1)
                if off.get(p,False) and off.get(n,False): off[d]=True
    return off
LO,HI=date(2027,6,1),date(2029,1,15)
OFF=off_map(LO,HI)
def stretch_len(d):
    a=d
    while OFF.get(a-timedelta(days=1),False): a-=timedelta(days=1)
    b=d
    while OFF.get(b+timedelta(days=1),False): b+=timedelta(days=1)
    return (b-a).days+1,a,b

# ── 택일 규칙 ──
GEONJE=['건','제','만','평','정','집','파','위','성','수','개','폐']
HWANGDO=['청룡','명당','천형','주작','금궤','천덕','백호','옥당','천뢰','현무','사명','구진']
HD_GOOD={'청룡','명당','금궤','천덕','옥당','사명'}
HD_START={'인':'자','신':'자','묘':'인','유':'인','진':'진','술':'진','사':'오','해':'오','오':'신','자':'신','미':'술','축':'술'}
CHEONDEOK={'인':'정','묘':'신','진':'임','사':'신','오':'해','미':'갑','신':'계','유':'인','술':'병','해':'을','자':'사','축':'경'}
WOLDEOK={'인':'병','오':'병','술':'병','신':'임','자':'임','진':'임','사':'경','유':'경','축':'경','해':'갑','묘':'갑','미':'갑'}
SIPAK={'갑진','을사','병신','정해','무술','기축','경진','신사','임신','계해'}
SUSA={'인':'술','묘':'진','진':'해','사':'사','오':'자','미':'오','신':'축','유':'미','술':'인','해':'신','자':'묘','축':'유'}
CHUNG={'자':'오','축':'미','인':'신','묘':'유','진':'술','사':'해','오':'자','미':'축','신':'인','유':'묘','술':'진','해':'사'}

JS={y:sorted(jeol_list(y)) for y in (2026,2027,2028,2029)}
ALLJ=sorted(JS[2026]+JS[2027]+JS[2028]+JS[2029])
def month_ji(d):
    dt=datetime(d.year,d.month,d.day,12,tzinfo=KST)
    return [x for x in ALLJ if x[0]<=dt][-1][2]
def year_ji(d):
    dt=datetime(d.year,d.month,d.day,12,tzinfo=KST)
    ip=[x for x in ALLJ if x[3]==315 and x[0].year==d.year][0][0]
    return JI[year_gz_idx(d.year if dt>=ip else d.year-1)%12], (d.year if dt>=ip else d.year-1)

rows=[]
d=date(2027,7,1)
while d<=date(2028,12,31):
    if d.weekday() in (5,6):
        i=day_gz_idx(d); dg,dj=GAN[i%10],JI[i%12]
        mji=month_ji(d); yji,yy=year_ji(d); lm,leap,ld=lun(d)
        slen,sa,sb=stretch_len(d)
        ban=[];plus=[];minus=[];score=50
        # 연휴/샌드위치
        if slen>=3: ban.append(f'연휴·샌드위치({sa}~{sb}, {slen}일)')
        if d in HOL: ban.append(f'공휴일({HOL[d]})')
        # 충 배제
        if dj=='묘': ban.append('신부 일지(酉) 충')
        if dj=='해': ban.append('신랑 일지(巳) 충')
        if dj=='신': ban.append('신부 본명(寅) 충')
        if dj=='진': ban.append('신랑 본명(戌) 충')
        if dj==CHUNG[yji]: ban.append(f'세파(태세 {yji} 충)')
        if gz(i) in SIPAK: ban.append('십악대패일')
        if SUSA[mji]==dj: ban.append('수사일')
        if ld in (5,14,23): minus.append('월기일'); score-=6
        # 가취월
        if lm in (2,8): plus.append('대리월'); score+=18
        elif lm in (3,9): plus.append('차길월'); score+=8
        elif lm in (1,7): minus.append('방여신월(신부 흉)'); score-=14
        elif lm in (6,12): minus.append('방부주월(신랑 흉)'); score-=12
        elif lm in (4,10): minus.append('방옹고월'); score-=6
        elif lm in (5,11): minus.append('방녀부모월'); score-=6
        g=GEONJE[(JI.index(dj)-JI.index(mji))%12]
        h=HWANGDO[(JI.index(dj)-JI.index(HD_START[mji]))%12]
        if g in ('정','성','개'): plus.append(f'건제:{g}일'); score+=10
        elif g in ('만','제'): plus.append(f'건제:{g}일'); score+=4
        elif g in ('파','위','폐','건'): minus.append(f'건제:{g}일'); score-=10
        if h in HD_GOOD: plus.append(f'황도:{h}'); score+=8
        else: minus.append(f'흑도:{h}'); score-=7
        if CHEONDEOK.get(mji) in (dg,dj): plus.append('천덕귀인'); score+=7
        if WOLDEOK.get(mji)==dg: plus.append('월덕귀인'); score+=6
        og,oj=GAN_OH[dg][0],JI_OH_USE[dj][0]
        if og=='수': plus.append('일간 水=공통용신'); score+=9
        elif og=='금': plus.append('일간 金=희신/신랑관성'); score+=5
        elif og=='화': minus.append('일간 火(신랑 조열)'); score-=4
        if oj=='금': plus.append('일지 金'); score+=4
        elif oj=='수': plus.append('일지 水'); score+=5
        if dj=='유': plus.append('巳酉반합(신랑 官 생성)'); minus.append('신부 일지 복음'); score+=3
        if dj=='술': plus.append('卯戌합'); minus.append('酉戌해'); score+=2
        if dj=='사': minus.append('신랑 일지 복음'); minus.append('寅巳형'); score-=12
        if dj=='인': minus.append('신랑 공망(寅卯)'); minus.append('신부 본명 복음+寅巳형'); score-=18
        if dj=='자': minus.append('신부 공망(子丑)'); minus.append('子卯형'); score-=20
        if dj=='오': minus.append('卯午파'); score-=5
        if dj=='미': minus.append('戌未형(신랑 년지)'); score-=5
        if dg=='을': minus.append('乙辛충·신랑 일간 복음'); score-=6
        if dg=='병': plus.append('丙辛합(신부 일간·정관)'); score+=6
        if dg=='경': plus.append('乙庚합(신랑 일간·정관)'); score+=6
        if dg==GAN[year_gz_idx(yy)%10]: minus.append('태세 천간 복음'); score-=3
        if yy==2028: minus.append('신부 태세충년(寅申충)'); score-=8
        rows.append(dict(date=d,wd='토' if d.weekday()==5 else '일',gz=gz(i),gz_h=gz_h(i),dg=dg,dj=dj,
            mji=mji,lm=lm,ld=ld,yy=yy,geonje=g,hwangdo=h,slen=slen,
            ban=ban,plus=plus,minus=minus,score=(-999 if ban else score)))
    d+=timedelta(days=1)

import json
json.dump([{**r,'date':str(r['date'])} for r in rows],open('taegil_2h27_28.json','w'),ensure_ascii=False)
ok=[r for r in rows if not r['ban']]
ok.sort(key=lambda r:(-r['score'],r['date']))
print(f"주말 총 {len(rows)}일 / 통과 {len(ok)}일\n")
print("═══ 순위 ═══")
for n,r in enumerate(ok[:20],1):
    print(f"{n:>2}. {r['date']}({r['wd']}) {r['gz']}({r['gz_h']}) 음{r['lm']}.{r['ld']:<2} {r['score']:>3}점 [{r['geonje']}·{r['hwangdo']}] {r['mji']}월")
    print(f"     + {' / '.join(r['plus'])}")
    print(f"     - {' / '.join(r['minus']) if r['minus'] else '없음'}")
