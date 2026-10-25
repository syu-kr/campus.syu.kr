const services=[
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
  {path:'/campus/roommates',ko:'룸메이트',en:'Roommates',terms:'룸메이트 기숙사 roommate dorm'},
  {path:'/more/meet',ko:'일정 잡기',en:'Find a time',terms:'일정잡기 모임 회의 meet meeting'},
];
const normalize=(text:string)=>text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');
export function findServices(query:string,roommatesEnabled=false){
  const value=normalize(query);if(!value)return [];
  return services.filter(item=>(item.path!=='/campus/roommates'||roommatesEnabled)&&normalize(item.ko+' '+item.en+' '+item.terms).includes(value)).sort((a,b)=>Number(normalize(b.ko)===value||normalize(b.en)===value)-Number(normalize(a.ko)===value||normalize(a.en)===value)).slice(0,6);
}
export function hasServiceMatches(query:string,roommatesEnabled=false){return findServices(query,roommatesEnabled).length>0;}
