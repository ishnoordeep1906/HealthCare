/* Planning model: service matching, facility ranking and visit timelines. */
(function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const serviceLabels = { consultation:'Consultation', xray:'X-ray', lab:'Lab test', pharmacy:'Pharmacy', followup:'Follow-up' };
  const specialties = ['General medicine','Orthopedics','Dermatology','Cardiology'];
  const departmentNames = { general:'General medicine', ortho:'Orthopedics', diagnostics:'Diagnostics', pharmacy:'Pharmacy' };
  const seed = [
    {id:'A',name:'Greenfield Community Hospital',short:'Greenfield Hospital',area:'South district',travel:10,wait:80,consultation:20,testWait:20,testDuration:20,doctor:true,emergency:true,open:true,services:{consultation:true,xray:true,lab:true,pharmacy:true,followup:true},fees:{consultation:450,xray:300,lab:200,pharmacy:150,followup:250},specialties:['General medicine','Orthopedics'],x:25,y:37,tag:'Budget friendly'},
    {id:'B',name:'Willow Family Clinic',short:'Willow Clinic',area:'Central district',travel:15,wait:15,consultation:20,testWait:10,testDuration:15,doctor:true,emergency:false,open:true,services:{consultation:true,xray:false,lab:true,pharmacy:true,followup:true},fees:{consultation:500,xray:300,lab:250,pharmacy:180,followup:300},specialties:['General medicine','Orthopedics','Dermatology'],x:44,y:24,tag:'Nearby clinic'},
    {id:'C',name:'Meridian Medical Centre',short:'Meridian Medical',area:'East district',travel:20,wait:30,consultation:15,testWait:10,testDuration:15,doctor:true,emergency:true,open:true,services:{consultation:true,xray:true,lab:true,pharmacy:true,followup:true},fees:{consultation:600,xray:350,lab:300,pharmacy:160,followup:350},specialties:clone(specialties),x:69,y:47,tag:'Complete care in one place'},
    {id:'D',name:'Northstar Specialty Hospital',short:'Northstar Hospital',area:'North district',travel:30,wait:25,consultation:20,testWait:10,testDuration:20,doctor:true,emergency:true,open:true,services:{consultation:true,xray:true,lab:true,pharmacy:true,followup:true},fees:{consultation:800,xray:450,lab:350,pharmacy:220,followup:400},specialties:clone(specialties),x:79,y:20,tag:'Specialist care'}
  ];
  function facilities() {
    return clone(seed).map(f => ({...f,updatedAt:null,departments:Object.entries(departmentNames).map(([id,name])=>({id,name,available:true,baseWait:id==='diagnostics'?f.testWait:id==='pharmacy'?5:f.wait,slotMinutes:id==='pharmacy'?10:f.consultation,capacity:id==='general'?2:1}))}));
  }
  function parseRequest(text,category='consultation',day='Today',priority='balanced',urgency='routine') {
    const raw=String(text||'').trim(), lower=raw.toLowerCase();
    let specialty='General medicine';
    if(/orthop|ortho\b/.test(lower))specialty='Orthopedics';
    else if(/dermatolog/.test(lower))specialty='Dermatology';
    else if(/cardiolog/.test(lower))specialty='Cardiology';
    const services=[];
    if(category==='consultation'||/consult|doctor|orthop|dermatolog|cardiolog/.test(lower))services.push('consultation');
    if(/\bx[ -]?ray\b/.test(lower)||(category==='test'&&!/blood test|lab test/.test(lower)))services.push('xray');
    if(/blood test|lab test/.test(lower))services.push('lab');
    if(category==='pharmacy'||/pharmacy|prescription|medicine pickup/.test(lower))services.push('pharmacy');
    if(category==='followup'||/follow[ -]?up/.test(lower)){
      const index=services.indexOf('consultation');if(index>=0)services.splice(index,1);services.push('followup');
    }
    if(!services.length)services.push('consultation');
    return {text:raw,category,day:day==='Tomorrow'?'Tomorrow':'Today',priority:['balanced','wait','cost'].includes(priority)?priority:'balanced',urgency:urgency==='emergency'?'emergency':'routine',specialty,services:[...new Set(services)],provider:'Local matching'};
  }
  function departmentFor(request) {
    if(request.services.some(s=>s==='consultation'||s==='followup'))return request.specialty==='Orthopedics'?'ortho':'general';
    return request.services.some(s=>s==='xray'||s==='lab')?'diagnostics':'pharmacy';
  }
  function evaluate(facility,request) {
    const f=clone(facility), needsDoctor=request.services.some(s=>s==='consultation'||s==='followup');
    const department=f.departments?.find(d=>d.id===departmentFor(request));
    const diagnostics=f.departments?.find(d=>d.id==='diagnostics');
    const pharmacy=f.departments?.find(d=>d.id==='pharmacy');
    const missing=request.services.filter(s=>!f.services[s]);
    if(!f.open)missing.push('closed');
    if(needsDoctor&&!f.doctor)missing.push('doctor');
    if(needsDoctor&&!f.specialties.includes(request.specialty))missing.push('specialty');
    if(department&&!department.available)missing.push('department');
    if(request.services.some(s=>s==='lab'||s==='xray')&&diagnostics&&!diagnostics.available)missing.push('diagnostics');
    if(request.services.includes('pharmacy')&&pharmacy&&!pharmacy.available)missing.push('pharmacy');
    const emergency=request.urgency==='emergency';
    const eligible=emergency?!!(f.emergency&&f.open):missing.length===0;
    const wait=department?(department.baseWait+(department.queued||0)*department.slotMinutes/Math.max(1,department.capacity)):f.wait;
    const testCount=request.services.filter(s=>s==='xray'||s==='lab').length;
    const clinicalDuration=(needsDoctor?f.consultation:0)+testCount*(f.testWait+f.testDuration)+(request.services.includes('pharmacy')?10:0);
    const cost=request.services.reduce((total,s)=>total+(f.fees[s]||0),0);
    const total=f.travel+Math.ceil(wait)+clinicalDuration;
    const score=emergency?f.travel:request.priority==='cost'?cost+total*.01:request.priority==='wait'?wait+f.travel*.1:total*.75+cost*.015;
    return {...f,wait:Math.ceil(wait),eligible,missing:[...new Set(missing)],cost,total,clinicalDuration,score,matched:request.services.filter(s=>f.services[s]).length};
  }
  function rank(list,request){return list.map(f=>evaluate(f,request)).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||a.score-b.score||a.id.localeCompare(b.id));}
  function arrivalFor(request,travel,now=new Date()) {
    return request.day==='Tomorrow'?9*60:Math.ceil((now.getHours()*60+now.getMinutes()+travel+10)/5)*5;
  }
  function timeline(f,request,arrival=13*60+20) {
    const events=[{key:'leave',label:'Start your journey',detail:`${f.travel} min estimated travel`,time:arrival-f.travel,icon:'home'},{key:'arrive',label:'Arrive & check in',detail:'Your queue ticket is created at check-in',time:arrival,icon:'pin'}];
    if(request.urgency==='emergency')return [...events,{key:'care',label:'Speak to emergency staff',detail:'Seek immediate assistance; timing depends on clinical triage',time:null,icon:'heart'},{key:'complete',label:'Visit completed',detail:'Care confirmed complete',time:null,icon:'check'}];
    let next=arrival+f.wait;
    if(request.services.some(s=>s==='consultation'||s==='followup')){events.push({key:'doctor',label:request.services.includes('followup')?'Follow-up consultation':'See the doctor',detail:`${request.specialty} · ${f.consultation} min`,time:next,icon:'stethoscope'});next+=f.consultation;}
    for(const service of request.services.filter(s=>s==='xray'||s==='lab')){next+=f.testWait;events.push({key:service,label:service==='xray'?'Complete your X-ray':'Complete your lab test',detail:`${f.testDuration} min service · ${f.testWait} min transfer / wait`,time:next,icon:'scan'});next+=f.testDuration;}
    if(request.services.includes('pharmacy')){events.push({key:'pharmacy',label:'Collect from the pharmacy',detail:'10 min estimated collection',time:next,icon:'pill'});next+=10;}
    events.push({key:'complete',label:'Visit completed',detail:'Estimated finish',time:next,icon:'check'});return events;
  }
  function time(minutes){if(minutes===null)return 'As needed';const day=Math.floor(minutes/1440),h=Math.floor(minutes/60)%24;return `${h%12||12}:${String(Math.round(minutes)%60).padStart(2,'0')} ${h>=12?'PM':'AM'}${day?' +'+day+'d':''}`;}
  function duration(minutes){return minutes>=60?`${Math.floor(minutes/60)}h${minutes%60?' '+minutes%60+'m':''}`:`${minutes} min`;}
  const api={clone,serviceLabels,specialties,departmentNames,facilities,parseRequest,departmentFor,evaluate,rank,arrivalFor,timeline,time,duration};
  root.CareFlowModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
