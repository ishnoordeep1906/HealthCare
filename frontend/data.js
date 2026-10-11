/* Local demo data and deterministic planning logic. No medical or live-data API calls. */
(function (root) {
  'use strict';
  const facilitySeed = [
    { id:'A', name:'Greenfield Community Hospital', short:'Greenfield Hospital', area:'South district', travel:10, wait:80, consultation:20, testWait:20, testDuration:20, completion:79, doctor:true, services:{consultation:true,xray:true,lab:true,pharmacy:true,followup:true}, fees:{consultation:450,xray:300,lab:200,pharmacy:150,followup:250}, specialties:['General medicine','Orthopedics'], x:25,y:37, color:'#608879', tag:'Budget friendly', queue:16, patients:32 },
    { id:'B', name:'Willow Family Clinic', short:'Willow Clinic', area:'Central district', travel:15, wait:15, consultation:20, testWait:10, testDuration:15, completion:88, doctor:true, services:{consultation:true,xray:false,lab:true,pharmacy:true,followup:true}, fees:{consultation:500,xray:300,lab:250,pharmacy:180,followup:300}, specialties:['General medicine','Orthopedics','Dermatology'], x:44,y:24, color:'#8b98b1', tag:'Nearby clinic', queue:3, patients:14 },
    { id:'C', name:'Meridian Medical Centre', short:'Meridian Medical', area:'East district', travel:20, wait:30, consultation:15, testWait:10, testDuration:15, completion:93, doctor:true, services:{consultation:true,xray:true,lab:true,pharmacy:true,followup:true}, fees:{consultation:600,xray:350,lab:300,pharmacy:160,followup:350}, specialties:['General medicine','Orthopedics','Dermatology','Cardiology'], x:69,y:47, color:'#0e8e80', tag:'Complete care in one place', queue:7, patients:28 },
    { id:'D', name:'Northstar Specialty Hospital', short:'Northstar Hospital', area:'North district', travel:30, wait:25, consultation:20, testWait:10, testDuration:20, completion:89, doctor:true, services:{consultation:true,xray:true,lab:true,pharmacy:true,followup:true}, fees:{consultation:800,xray:450,lab:350,pharmacy:220,followup:400}, specialties:['General medicine','Orthopedics','Dermatology','Cardiology'], x:79,y:20, color:'#748eaa', tag:'Specialist care', queue:5, patients:22 }
  ];
  const serviceLabels = {consultation:'Consultation',xray:'X-ray',lab:'Lab test',pharmacy:'Pharmacy',followup:'Follow-up'};
  const clone = value => JSON.parse(JSON.stringify(value));
  function parseRequest(text, category, day, priority) {
    const raw = String(text || '').trim();
    const lower = raw.toLowerCase();
    let specialty = 'General medicine';
    if (/orthop|ortho\b/.test(lower)) specialty = 'Orthopedics';
    else if (/dermatolog/.test(lower)) specialty = 'Dermatology';
    else if (/cardiolog/.test(lower)) specialty = 'Cardiology';
    const required = [];
    const explicitlyConsultation = /consult|doctor|orthop|dermatolog|cardiolog/.test(lower);
    if (category==='consultation' || explicitlyConsultation || category==='urgent') required.push('consultation');
    if (/\bx[ -]?ray\b/.test(lower) || category==='test') required.push('xray');
    if (/blood test|lab test/.test(lower)) { if(category==='test'&&!/\bx[ -]?ray\b/.test(lower)) required.splice(required.indexOf('xray'),1); required.push('lab'); }
    if (/pharmacy|prescription|medicine pickup/.test(lower) || category==='pharmacy') required.push('pharmacy');
    if (/follow[ -]?up/.test(lower) || category==='followup') {
      // A follow-up is one doctor visit, not a second consultation charge.
      const consultationIndex=required.indexOf('consultation');
      if(consultationIndex!==-1) required.splice(consultationIndex,1);
      required.push('followup');
    }
    if (!required.length) required.push('consultation');
    return {text:raw,category:category||'consultation',day:day==='Tomorrow'?'Tomorrow':'Today',priority:['balanced','wait','cost'].includes(priority)?priority:'balanced',specialty,services:[...new Set(required)]};
  }
  function evaluate(facility, request) {
    const needsDoctor = request.services.some(s=>s==='consultation'||s==='followup');
    const missing = request.services.filter(s=>!facility.services[s]);
    if (needsDoctor&&!facility.doctor) missing.push('doctor');
    if (needsDoctor&&!facility.specialties.includes(request.specialty)) missing.push('specialty');
    const testCount=request.services.filter(s=>s==='xray'||s==='lab').length;
    const clinicalDuration = (needsDoctor?facility.consultation:0)+testCount*(facility.testWait+facility.testDuration)+(request.services.includes('pharmacy')?10:0);
    const cost=request.services.reduce((sum,s)=>sum+(facility.fees[s]||0),0);
    const total=facility.travel+facility.wait+clinicalDuration;
    const eligible=missing.length===0;
    const rankScore=request.priority==='cost'?cost+total*.01:request.priority==='wait'?facility.wait+facility.travel*.1:(total/180)*.48+(cost/1500)*.20+((100-facility.completion)/100)*.32;
    return {...facility,eligible,missing,cost,total,clinicalDuration,rankScore,completionEstimate:eligible?facility.completion:null};
  }
  function rank(facilities,request) { return facilities.map(f=>evaluate(f,request)).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||a.rankScore-b.rankScore||a.id.localeCompare(b.id)); }
  function timeline(facility,request) {
    const arrival=13*60+20;
    const events=[{key:'leave',label:'Leave home',detail:`${facility.travel} min travel`,time:arrival-facility.travel,icon:'home'},{key:'arrive',label:'Arrive & check in',detail:'Allow time for registration',time:arrival,icon:'pin'}];
    let next=arrival+facility.wait;
    if(request.services.some(s=>s==='consultation'||s==='followup')) {events.push({key:'doctor',label:request.services.includes('followup')?'Follow-up consultation':'See the doctor',detail:`${request.specialty} · ${facility.consultation} min`,time:next,icon:'stethoscope'});next+=facility.consultation;}
    for(const service of request.services.filter(s=>s==='xray'||s==='lab')) {next+=facility.testWait;events.push({key:service,label:service==='xray'?'Complete your X-ray':'Complete your lab test',detail:`${facility.testDuration} min service · ${facility.testWait} min transfer / wait`,time:next,icon:'scan'});next+=facility.testDuration;}
    if(request.services.includes('pharmacy')) {events.push({key:'pharmacy',label:'Visit the pharmacy',detail:'10 min collection',time:next,icon:'pill'});next+=10;}
    events.push({key:'complete',label:'Visit complete',detail:'Estimated finish time',time:next,icon:'check'});
    return events;
  }
  function time(minutes) {const h=Math.floor(minutes/60)%24; return `${h%12||12}:${String(minutes%60).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
  function duration(minutes) {return minutes>=60?`${Math.floor(minutes/60)}h${minutes%60?' '+minutes%60+'m':''}`:`${minutes} min`;}
  const api={facilities:()=>clone(facilitySeed),serviceLabels,parseRequest,evaluate,rank,timeline,time,duration,clone};
  root.CareFlowModel=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
