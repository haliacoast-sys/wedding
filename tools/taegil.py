# -*- coding: utf-8 -*-
import sys; sys.path.insert(0,'/home/claude/saju')
from core import *
from analyze import SONG,LEE,sipseong,unseong,gongmang
from datetime import datetime,date,timedelta

# ---------- 음력 캘린더 ----------
def build_lunar(y):
    """y년 양력 각 날짜 -> (음력월, 윤여부, 음력일)"""
    nms=[]
    k0=int((y-2000)*12.3685)
    for k in range(k0-18,k0+20):
        nms.append((new_moon_kst(k).date(), k))
    nms.sort()
    # 중기(中氣) 12개: 우수330 춘분0 곡우30 소만60 하지90 대서120 처서150 추분180 상강210 소설240 동지270 대한300
    ZHONGQI=[(330,'우수'),(0,'춘분'),(30,'곡우'),(60,'소만'),(90,'하지'),(120,'대서'),
             (150,'처서'),(180,'추분'),(210,'상강'),(240,'소설'),(270,'동지'),(300,'대한')]
    APX={330:(2,19),0:(3,20),30:(4,20),60:(5,21),90:(6,21),120:(7,23),150:(8,23),
         180:(9,23),210:(10,23),240:(11,22),270:(12,22),300:(1,20)}
    zq=[]
    for yy in (y-1,y,y+1):
        for deg,nm in ZHONGQI:
            m,d=APX[deg]
            zq.append((term_near(datetime(yy,m,d,12,tzinfo=KST),deg).date(),deg,nm))
    zq.sort()
    # 동지 포함 삭월 = 11월
    dz=[t for t,deg,nm in zq if deg==270 and t.year==y-1][0]
    i11=max(i for i,(d,k) in enumerate(nms) if d<=dz)
    dz2=[t for t,deg,nm in zq if deg==270 and t.year==y][0]
    i11n=max(i for i,(d,k) in enumerate(nms) if d<=dz2)
    n_months=i11n-i11
    leap_i=None
    if n_months==13:  # 윤달 있음
        for i in range(i11+1,i11n+1):
            s=nms[i][0]; e=nms[i+1][0]
            if not any(s<=t<e for t,deg,nm in zq): leap_i=i; break
    out={}
    mno=11; leaped=False
    for i in range(i11, i11n+2):
        s=nms[i][0]; e=nms[i+1][0]
        if leap_i is not None and i==leap_i:
            lm=mno; isleap=True
        else:
            if i>i11: mno=mno%12+1
            lm=mno; isleap=False
        d=s; dd=1
        while d<e:
            out[d]=(lm,isleap,dd); d+=timedelta(days=1); dd+=1
    return out

LUNAR=build_lunar(2027)

# ---------- 건제12신 ----------
GEONJE=['건','제','만','평','정','집','파','위','성','수','개','폐']
def geonje(month_ji, day_ji):
    return GEONJE[(JI.index(day_ji)-JI.index(month_ji))%12]
# ---------- 황도흑도 12신 ----------
HWANGDO=['청룡','명당','천형','주작','금궤','천덕','백호','옥당','천뢰','현무','사명','구진']
HD_GOOD={'청룡','명당','금궤','천덕','옥당','사명'}
HD_START={'인':'자','신':'자','묘':'인','유':'인','진':'진','술':'진',
          '사':'오','해':'오','오':'신','자':'신','미':'술','축':'술'}
def hwangdo(month_ji, day_ji):
    return HWANGDO[(JI.index(day_ji)-JI.index(HD_START[month_ji]))%12]
# ---------- 천덕/월덕 귀인 ----------
CHEONDEOK={'인':'정','묘':'신','진':'임','사':'신','오':'해','미':'갑','신':'계','유':'인',
           '술':'병','해':'을','자':'사','축':'경'}
WOLDEOK={'인':'병','오':'병','술':'병','신':'임','자':'임','진':'임',
         '사':'경','유':'경','축':'경','해':'갑','묘':'갑','미':'갑'}
SIPAK={'갑진','을사','병신','정해','무술','기축','경진','신사','임신','계해'}
SUSA={'인':'술','묘':'진','진':'해','사':'사','오':'자','미':'오','신':'축','유':'미',
      '술':'인','해':'신','자':'묘','축':'유'}
CHUNG={'자':'오','축':'미','인':'신','묘':'유','진':'술','사':'해',
       '오':'자','미':'축','신':'인','유':'묘','술':'진','해':'사'}

# 두 사람 기준
BRIDE_DJ='유'; BRIDE_YJ='인'; BRIDE_DG='신'
GROOM_DJ='사'; GROOM_YJ='술'; GROOM_DG='을'
HARD_BAN={'묘':'신부 일지(酉) 충','해':'신랑 일지(巳) 충','신':'신부 본명(寅) 충',
          '진':'신랑 본명(戌) 충','축':'태세(未) 충 = 세파'}

results=[]
d=date(2027,1,1)
js=jeol_list(2027)+jeol_list(2026)
js.sort()
while d<=date(2027,12,31):
    dt=datetime(d.year,d.month,d.day,12,tzinfo=KST)
    prev=[x for x in js if x[0]<=dt][-1]
    mji=prev[2]
    di=day_gz_idx(d); dg=GAN[di%10]; dj=JI[di%12]
    lm,leap,ld=LUNAR.get(d,(0,False,0))
    rec=dict(date=d,gz=gz(di),gz_h=gz_h(di),dg=dg,dj=dj,mji=mji,lm=lm,leap=leap,ld=ld,
             weekday='월화수목금토일'[d.weekday()])
    ban=[]; plus=[]; minus=[]; score=50
    if dj in HARD_BAN: ban.append(HARD_BAN[dj])
    if gz(di) in SIPAK: ban.append('십악대패일')
    if SUSA[mji]==dj: ban.append('수사일')
    if ld in (5,14,23): minus.append('월기일(음5·14·23)'); score-=6
    # 가취월 (신부 寅띠: 대리월 음2·8 / 차길 음3·9 / 방여신 음1·7 흉)
    if lm in (2,8): plus.append('대리월(大利月)'); score+=18
    elif lm in (3,9): plus.append('차길월(방매인월-현대무해)'); score+=8
    elif lm in (1,7): minus.append('방여신월(신부 흉)'); score-=14
    elif lm in (6,12): minus.append('방부주월(신랑 흉)'); score-=12
    elif lm in (4,10): minus.append('방옹고월(시부모)'); score-=6
    elif lm in (5,11): minus.append('방녀부모월(친정)'); score-=6
    g=geonje(mji,dj); h=hwangdo(mji,dj)
    if g in ('정','성','개'): plus.append(f'건제:{g}일(혼인길)'); score+=10
    elif g in ('만','제'): plus.append(f'건제:{g}일(무난)'); score+=4
    elif g in ('파','위','폐','건'): minus.append(f'건제:{g}일'); score-=10
    if h in HD_GOOD: plus.append(f'황도길신:{h}'); score+=8
    else: minus.append(f'흑도:{h}'); score-=7
    if CHEONDEOK.get(mji)==dg or CHEONDEOK.get(mji)==dj: plus.append('천덕귀인'); score+=7
    if WOLDEOK.get(mji)==dg: plus.append('월덕귀인'); score+=6
    # 두 사람 용신 부합 (공통용신 水, 희신 金)
    og=GAN_OH[dg][0]; oj=JI_OH_USE[dj][0]
    if og=='수': plus.append('일간 水=공통용신'); score+=9
    elif og=='금': plus.append('일간 金=신부희신/신랑관성'); score+=5
    elif og=='화': minus.append('일간 火(신랑 조열 가중)'); score-=4
    if oj=='금': plus.append('일지 金'); score+=4
    elif oj=='수': plus.append('일지 水'); score+=5
    # 합
    if dj=='유': plus.append('巳酉반합(신랑 官星 생성)'); minus.append('신부 일지 복음(경미)'); score+=6; score-=3
    if dj=='술': plus.append('卯戌합(신부 財→官 化)'); score+=5; minus.append('酉戌해(경미)'); score-=3
    if dj=='사': minus.append('신랑 일지 복음'); score-=6; minus.append('寅巳형(신부 년지)'); score-=6
    if dj=='인': minus.append('신랑 공망(寅卯)'); score-=12; minus.append('신부 본명 복음+寅巳형'); score-=6
    if dj=='자': minus.append('신부 공망(子丑)'); score-=12; minus.append('子卯형(무례지형)'); score-=8
    if dj=='오': minus.append('卯午파(신부 시지)'); score-=5
    if dj=='미': minus.append('태세 복음'); score-=3; minus.append('戌未형(신랑 년지)'); score-=5
    if dg=='을': minus.append('乙辛충(신부 일간)·신랑 일간 복음'); score-=6
    if dg=='정': minus.append('태세 천간 복음(丁)'); score-=3
    if dg=='병': plus.append('丙辛합(신부 일간과 합·정관)'); score+=6
    if dg=='경': plus.append('乙庚합(신랑 일간과 합·정관)'); score+=6
    rec.update(ban=ban,plus=plus,minus=minus,score=score if not ban else -999,
               geonje=g,hwangdo=h)
    results.append(rec)
    d+=timedelta(days=1)

ok=[r for r in results if not r['ban']]
ok.sort(key=lambda r:(-r['score'],r['date']))
print(f"2027년 총 {len(results)}일 / 강배제 후 {len(ok)}일")
print("\n===== 최상위 30일 =====")
for r in ok[:30]:
    lmm=f"음{r['lm']}월{r['ld']}일"
    print(f"{r['date']} ({r['weekday']}) {r['gz']}({r['gz_h']}) {lmm} 점수{r['score']:>3} | {r['geonje']}·{r['hwangdo']} | +{', '.join(r['plus'])} | -{', '.join(r['minus'])}")
print("\n===== 대리월(음2·8월) 내 상위 =====")
for r in [x for x in ok if x['lm'] in (2,8)][:22]:
    print(f"{r['date']} ({r['weekday']}) {r['gz']}({r['gz_h']}) 음{r['lm']}월{r['ld']}일 점수{r['score']:>3} | {r['geonje']}·{r['hwangdo']}")
import json
json.dump([{k:(str(v) if isinstance(v,date) else v) for k,v in r.items()} for r in results],
          open('/home/claude/saju/taegil2027.json','w'),ensure_ascii=False)
