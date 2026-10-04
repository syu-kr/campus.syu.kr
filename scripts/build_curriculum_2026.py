"""Rebuild 2026 courses from the source PDF's extracted table cells.

The 2026 source has subset Korean fonts without usable ToUnicode mappings and
some aviation numbers drawn as vector paths. Supply either a font-recovered
copy (only an intermediate copy; never overwrite the original) or saved
pdfplumber extract_tables() output named table-NNN.json / table-N.json.
The importer checks the ORIGINAL source SHA-256, reads only 2026 table cells,
then applies the page/row corrections that were checked on rendered pages.
No 2025 dataset is read. Intermediate files are not repository dependencies.

Example:
    python scripts/build_curriculum_2026.py --source ORIGINAL.pdf \
        --recovered-pdf RECOVERED-COPY.pdf
    python scripts/build_curriculum_2026.py --source ORIGINAL.pdf \
        --tables-dir EXTRACTED-TABLES

pdfplumber is needed only for --recovered-pdf; it is in the Codex bundled
document runtime, not an application dependency.
"""
import pathlib,json,re,collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
import argparse,hashlib
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=pathlib.Path, required=True)
inputs=parser.add_mutually_exclusive_group(required=True)
inputs.add_argument('--tables-dir', type=pathlib.Path)
inputs.add_argument('--recovered-pdf', type=pathlib.Path)
args=parser.parse_args()
SOURCE_SHA='83901EA188FD6F9F99F971873D3411BF65EEF0060DE9AD0A6D5EF2F3A9DEDA85'
if hashlib.sha256(args.source.read_bytes()).hexdigest().upper()!=SOURCE_SHA:
    raise SystemExit('The input is not the audited 2026 source PDF; refusing to apply page/row corrections.')
pdf=None
if args.recovered_pdf:
    import pdfplumber
    pdf=pdfplumber.open(args.recovered_pdf)
def load_tables(page):
    if pdf is not None:
        return pdf.pages[page-1].extract_tables()
    for name in [f'table-{page}.json',f'table-{page:03}.json',f'table-{page}.tmp.json']:
        path=args.tables_dir/name
        if path.is_file():return json.loads(path.read_text(encoding='utf-8'))
    raise FileNotFoundError(f'Missing extracted tables for source page {page}')

GROUPS=[('theology_dept','신학과',range(48,51)),('nursing_nursing','간호학과',range(61,65)),('pharmacy_pharm','약학과',range(79,84)),('cf_business','경영학과',range(99,103)),('cf_korean','글로벌한국학과',range(112,115)),('cf_socialwelfare','사회복지학과',range(126,130)),('cf_counseling','상담심리학과',range(141,145)),('cf_artdesign','아트앤디자인학과',range(156,158)),('cf_english','영어영문학과',range(163,166)),('cf_earlychildhood','유아교육과',range(178,182)),('cf_music','음악학과',range(195,198)),('cf_physical','체육학과',range(204,208)),('cf_aviation','항공관광외국어학부',range(220,229)),('ff_architecture','건축학과',range(243,247)),('ff_datacloud','데이터클라우드공학과',range(257,261)),('ff_animal','동물자원과학과',range(271,273)),('ff_physicaltherapy','물리치료학과',range(284,288)),('ff_bioconvergence','바이오융합공학과',range(299,303)),('ff_healthadmin','보건관리학과',range(314,318)),('ff_foodnutrition','식품영양학과',range(328,332)),('ff_ai','인공지능융합학부',range(346,350)),('ff_computer','컴퓨터공학부',range(367,371)),('ff_chemistry','화학생명과학과',range(383,386)),('ff_envdesign','환경디자인원예학과',range(401,409))]
def clean(s):
    s=re.sub(r'\(cid:\d+\)',' ',s or '').replace('\n','')
    return re.sub(r'\s+',' ',s).strip()
def hdr(s):return re.sub(r'(.)\1',r'\1',clean(s)).replace(' ','')
courses=[];errors=[]
for dept,departmentName,pages in GROUPS:
    year=semester=0;cols=None
    for page in pages:
        ts=load_tables(page)
        for ti,table in enumerate(ts):
            headers=next(([hdr(x) for x in rr] for rr in table if any('교과목' in hdr(x) for x in rr)),[])
            ni=next((i for i,x in enumerate(headers) if '교과목' in x),None)
            ci=next((i for i,x in enumerate(headers) if x=='학점'),None)
            time=next((i for i,x in enumerate(headers) if x=='시간'),None)
            if ni is not None and ci is not None:cols=(ni,ci,len(headers),(time-ci if time is not None else 1))
            elif not cols or len(table[0])!=cols[2]:continue
            ni,ci,_,creditcols=cols;major=None;last_cat=None;choice_group=None
            for ri,row in enumerate(table):
                rawcat=next((clean(x) for x in row[:5] if re.match(r'^(교필|교선|전필|전선|\(?교직\)?|채플)',clean(x))),None)
                cat=re.match(r'^(교필|교선|전필|전선|\(?교직\)?|채플)',rawcat).group(1) if rawcat else None
                if rawcat:choice_group=f'2026-choice-{dept}-{page}-{ti}-{ri}' if '택1' in rawcat else None
                if not cat and clean(row[ni])=='채플':cat='교필'
                if not cat and clean(row[ni]) and last_cat and '소계' not in clean(row[ni]) and '합계' not in clean(row[ni]) and not any('교과목' in hdr(x) for x in row):cat=last_cat
                if not cat:continue
                cat='교직' if cat=='(교직)' else '교필' if cat=='채플' else cat
                last_cat=cat
                if clean(row[0]).isdigit():year=int(clean(row[0]))
                if clean(row[1]).isdigit():semester=int(clean(row[1]))
                name=clean(row[ni]);cparts=[clean(x) for x in row[ci:ci+creditcols]]
                nums=[float(x) for x in cparts if re.fullmatch(r'\d+(?:\.\d+)?',x)]
                credits=sum(nums) if nums else 0 if any('P' in x for x in cparts) else None
                if dept=='ff_computer':
                    group=clean(row[2]);major={'CE':'cs_cs','SW':'cs_sw','CS':None}.get(group,major)
                    if cat.startswith('교'):major=None
                if dept=='ff_architecture':major='arch_5year'
                if dept=='cf_aviation':major=None if page==220 else 'aviation_tourism' if page<225 else 'aviation_oriental'
                problem=[]
                if not name:problem.append('name')
                if credits is None:problem.append('credits')
                if year not in range(1,7):problem.append('year')
                if semester not in [1,2]:problem.append('semester')
                c={'id':f'2026-{dept}-{page}-{ti}-{ri}','departmentId':dept,'departmentName':departmentName,'majorId':major,'category':cat,'name':name,'credits':credits,'year':year,'semester':semester,'sourcePages':[page],'verificationStatus':'needsReview' if problem else 'humanVerified','_table':ti,'_row':ri,'_raw':row,'_problems':problem}
                if choice_group:c['selectionGroup']=choice_group
                courses.append(c)
                if problem:errors.append([dept,page,ri,name,problem])

for c in courses:
    p=c['sourcePages'][0];r=c['_row'];n=c['name'];dept=c['departmentId']
    if dept=='cf_aviation':
        c['year']={220:1,221:2,222:2,223:3,224:4,225:2,226:2,227:3,228:4}[p]
        start2={220:13,221:8,222:8,223:12,224:10,225:11,226:11,227:11,228:11}[p]
        c['semester']=1 if r<start2 else 2
        c['credits']=0 if n=='채플' else 2 if n.startswith(('인성과','종교와','생활과','역사와','인성교육')) else 1 if n.startswith(('인생설계','노작','지역사회')) else 3
        replace={
            (220,4):'노작(그린)교육(1학기/2학기 택1)',(220,5):'글로컬영어Ⅰ',(220,6):'사고와표현(1학기/2학기 택1)',(220,7):'AI리터러시와 문제해결',(220,8):'인생설계와 진로Ⅰ',(220,9):'중국문화와언어(중국사회와문화)',(220,15):'글로컬영어Ⅱ',(220,16):'사고와표현(1학기/2학기 택1)',(220,17):'AI리터러시와 문제해결',
            (221,10):'인생설계와 진로Ⅱ',(222,10):'인생설계와 진로Ⅱ',
            (223,3):'인성교육 영역Ⅰ(3~4학년 중 선택)',(223,6):'항공관광실무영어1',(223,13):'인성교육 영역Ⅱ(3~4학년 중 선택)',(223,15):'항공관광실무영어2',
            (224,4):'인턴십Ⅲ',(224,6):'졸업논문 및 중국어자격시험(신HSK)',(224,10):'인턴십2',
            (225,8):'시청각일본어1',(226,8):'시청각일본어1',(225,13):'인생설계와 진로Ⅱ',(226,13):'인생설계와 진로Ⅱ',
            (227,3):'인성교육 영역Ⅰ(3~4학년 중 선택)',(227,5):'중급중국어회화Ⅰ',(227,7):'현장어학실습1',(227,8):'중급일본어회화Ⅰ',(227,9):'현장어학실습Ⅰ',(227,12):'인성교육 영역Ⅱ(3~4학년 중 선택)',(227,19):'현장어학실습2',
            (228,5):'융합캡스톤디자인(일본어)',(228,6):'인턴십Ⅲ',(228,7):'졸업논문 및 중국어자격시험(신HSK)',(228,14):'융합캡스톤디자인(중국어)',(228,16):'JLPT/JPT 졸업논문',(228,17):'新HSK 및 졸업논문'
        }
        c['name']=replace.get((p,r),n)
        if (p==224 and r in [6,7,8]) or (p==228 and r in [7,8,9]):
            c['credits']=0
            if p==224 and r==8:c['verificationStatus']='needsReview';c['verificationNote']='학점 셀이 공란인 졸업연구는 자동 학점 합산에 사용하지 않습니다.'
        else:c['verificationStatus']='humanVerified'
        c['_problems']=[]
    if dept=='pharmacy_pharm' and p==83 and c['_table']==1 and r in [10,11,12,13,14]:
        c['credits']=10;c['verificationStatus']='humanVerified';c['_problems']=[]
        c['verificationNote']='심화실무실습 5과목 중 택1, 병합된 10학점 셀 확인.'
    if dept=='ff_computer':
        if 'AI리터러시' in n:c['name']='AI리터러시와 문제해결(구, 컴퓨팅사고력)'
        if '기업가정신' in n:
            c['verificationStatus']='needsReview';c['sourcePages']=[365,370]
            c['verificationNote']='p370 학년별 표 2학점과 p365 졸업기준 3학점이 상충하여 자동 합산하지 않습니다.'
    if dept=='ff_ai':
        # These pages contain misaligned grid cells and courses outside the grid.
        c['verificationStatus']='needsReview'
        c['verificationNote']='세부전공별 전체 편성표 대조가 끝나지 않아 과목 선택을 제공하지 않습니다.'
    if dept in ['cf_business','cf_artdesign','cf_music','ff_envdesign']:
        c['verificationStatus']='needsReview'
        c['verificationNote']='과목표의 병합 셀 또는 세부전공 구분을 추가 확인해야 합니다.'
    if c['credits'] is None:c['credits']=0;c['verificationStatus']='needsReview'
    if c['verificationStatus']=='humanVerified' and re.search(r'\ufffd|[\x00-\x1f]',c['name']):c['verificationStatus']='needsReview'
    c['credits']=int(c['credits']) if c['credits']==int(c['credits']) else c['credits']
    for key in list(c):
        if key.startswith('_'):del c[key]
# A repeated source page or a shared offering is one course record in one semester.
dedup={}
for c in courses:
    key=(c['departmentId'],c['majorId'],c['year'],c['semester'],re.sub(r'\s+','',c['name']),c['category'],c['credits'])
    if key in dedup:
        old=dedup[key];old['sourcePages']=sorted(set(old['sourcePages']+c['sourcePages']))
    else:dedup[key]=c
courses=list(dedup.values())
reviewed=['ff_computer','ff_architecture','cf_aviation','nursing_nursing','ff_physicaltherapy','pharmacy_pharm']
full=[d for d in reviewed if all(c['verificationStatus']=='humanVerified' for c in courses if c['departmentId']==d)]
meta={'sourceFile':'2026-삼육대학교-학부-교육과정_최종.pdf','sourceSha256':'83901EA188FD6F9F99F971873D3411BF65EEF0060DE9AD0A6D5EF2F3A9DEDA85','sourceYear':'2026','generatedAt':'2026-10-04','reviewedDepartmentIds':reviewed,'fullyVerifiedDepartmentIds':full,'policy':'2026 원문에서 직접 추출한 과목입니다. 학년별 전체 표를 대조한 학과와 humanVerified 과목만 선택할 수 있습니다. 공란·상충 값은 needsReview로 자동 합산에서 제외합니다. 2025 자료를 복사하지 않았습니다.'}
out={'metadata':meta,'summary':{'totalCourses':len(courses),'totalVerifiedCourses':sum(c['verificationStatus']=='humanVerified' for c in courses)},'courses':courses}
(ROOT/'public/data/curriculum-courses-2026-verified.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
groups=[]
same=collections.defaultdict(list)
choices=collections.defaultdict(list)
for c in courses:
    if c['verificationStatus']!='humanVerified' or c['credits']==0:continue
    if c.get('selectionGroup'):choices[c['selectionGroup']].append(c)
    name=re.sub(r'\s+','',c['name'])
    same[(c['departmentId'],c['majorId'],name)].append(c)
for (d,m,n),cs in same.items():
    if len(cs)>1 and not any(word in n for word in ['영역별','선택이수']):
        groups.append({'id':f'2026-repeat-{cs[0]["id"]}','departmentId':d,'label':f'{cs[0]["name"]} 중복 개설 중 택1','courseIds':[c['id'] for c in cs]})
for key,cs in choices.items():
    if len(cs)>1:groups.append({'id':key,'departmentId':cs[0]['departmentId'],'label':f'{cs[0]["year"]}학년 {cs[0]["semester"]}학기 전공선택 중 택1','courseIds':[c['id'] for c in cs]})
architecture_personality=[c['id'] for c in courses if c['departmentId']=='ff_architecture' and c['name'].startswith('인성교육')]
if len(architecture_personality)==2:groups.append({'id':'2026-architecture-personality','departmentId':'ff_architecture','label':'인성교육 영역Ⅰ·Ⅱ 3학년 1·2학기 중 택1','courseIds':architecture_personality})
practice=[c['id'] for c in courses if c['departmentId']=='pharmacy_pharm' and '심화실무실습' in c['name']]
if len(practice)>1:groups.append({'id':'2026-pharmacy-intensive-practice','departmentId':'pharmacy_pharm','label':'심화실무실습 5과목 중 택1','courseIds':practice})
rules={'metadata':{'sourceYear':'2026','verifiedAt':'2026-10-04','sourceSha256':meta['sourceSha256'],'policy':'동일 과목의 중복 개설은 1회만 합산합니다. 원문에 택1으로 명시된 실습 병합 셀도 상호배타 처리합니다.'},'exclusiveGroups':groups}
(ROOT/'public/data/curriculum-course-selection-rules-2026.json').write_text(json.dumps(rules,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if pdf is not None:pdf.close()
print(out['summary'], 'selectionRules',len(groups))
