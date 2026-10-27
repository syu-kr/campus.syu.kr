const services=[
  {path:'/academic',ko:'학사 정보',en:'Academics',terms:'학사 정보 academic services'},
  {path:'/campus',ko:'캠퍼스 정보',en:'Campus',terms:'캠퍼스 생활 시설 campus services'},
  {path:'/more',ko:'더보기',en:'More',terms:'더보기 기타 more services'},
  {path:'/academic/announcements',ko:'학사공지',en:'Academic notices',terms:'학사 공지 공지사항 academic announcements notices'},
  {path:'/academic/sw-notices',ko:'SW중심대학공지',en:'SW notices',terms:'sw 소프트웨어 중심 공지 software notices'},
  {path:'/academic/timetable',ko:'시간표 짜기',en:'Timetable',terms:'시간표 강의 수업 timetable lecture schedule'},
  {path:'/academic/graduation',ko:'졸업요건 자가진단',en:'Graduation requirements',terms:'졸업 학점 이수 graduation credits'},
  {path:'/campus/cafeteria',ko:'학식',en:'Cafeteria',terms:'학식 식당 식단 메뉴 만나 cafeteria menu lunch food'},
  {path:'/campus/bus-info',ko:'버스 정보',en:'Bus information',terms:'버스 셔틀 교통 bus shuttle transit'},
  {path:'/academic/schedule',ko:'학사일정',en:'Academic calendar',terms:'학사일정 일정 시험 calendar exam'},
  {path:'/campus/library',ko:'도서관',en:'Library',terms:'도서관 좌석 열람실 library seat'},
  {path:'/campus/map',ko:'캠퍼스 지도',en:'Campus map',terms:'지도 건물 강의실 map building'},
  {path:'/campus/phone',ko:'교내 연락처',en:'Directory',terms:'전화 연락처 부서 phone contact'},
  {path:'/academic/scholarship',ko:'장학금',en:'Scholarships',terms:'장학금 장학 scholarship'},
  {path:'/academic/competitions',ko:'공모전',en:'Competitions',terms:'공모전 대회 competition'},
  {path:'/campus/campus-tips',ko:'캠퍼스 꿀팁',en:'Campus tips',terms:'캠퍼스 꿀팁 tips'},
  {path:'/campus/announcements',ko:'학교생활공지',en:'Campus notices',terms:'학교 생활 공지 campus life announcements notices'},
  {path:'/campus/gym',ko:'체육관 및 헬스장',en:'Gym',terms:'체육관 헬스장 운동 gym fitness sports'},
  {path:'/campus/health-center',ko:'보건실',en:'Health center',terms:'보건실 건강 진료 health medical'},
  {path:'/campus/roommates',ko:'룸메이트',en:'Roommates',terms:'룸메이트 기숙사 roommate dorm'},
  {path:'/more/meet',ko:'일정 잡기',en:'Find a time',terms:'일정잡기 모임 회의 meet meeting'},
  {path:'/service/notices',ko:'서비스 공지',en:'Service notices',terms:'서비스 공지 업데이트 service announcements updates'},
  {path:'/more/privacy',ko:'알림 및 개인정보',en:'Notifications and privacy',terms:'알림 구독 개인정보 설정 푸시 notifications privacy push settings'},
];
const normalize=(text:string)=>text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');
export function findServices(query:string,roommatesEnabled=false){
  const value=normalize(query);if(!value)return [];
  return services.filter(item=>(item.path!=='/campus/roommates'||roommatesEnabled)&&normalize(item.ko+' '+item.en+' '+item.terms).includes(value)).sort((a,b)=>Number(normalize(b.ko)===value||normalize(b.en)===value)-Number(normalize(a.ko)===value||normalize(a.en)===value)).slice(0,6);
}
export function hasServiceMatches(query:string,roommatesEnabled=false){return findServices(query,roommatesEnabled).length>0;}
