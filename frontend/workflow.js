/* Shared patient/hospital state. Functions also run in Node for workflow tests. */
(function(root){
  'use strict';
  const M=root.CareFlowModel||(typeof require==='function'?require('./data.js'):null);
  const activeStatuses=['planned','travelling','waiting','in-care','needs-review'];
  const id=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  function createState(){return {version:2,revision:0,facilities:M.facilities(),profiles:{},requests:[],journeys:[],queue:[],notifications:[],feedback:[],messages:[],sequence:{}};}
  function notify(db,owner,title,text,kind='info',route='dashboard'){const n={id:id('notice'),owner,title,text,kind,route,createdAt:Date.now(),read:false};db.notifications.push(n);return n;}
  function requestFor(db,owner){return db.requests.filter(r=>r.owner===owner).at(-1)||null;}
  function journeyFor(db,owner){return db.journeys.filter(j=>j.owner===owner).at(-1)||null;}
  function submitRequest(db,user,fields){const request={...M.parseRequest(fields.text,fields.category,fields.day,fields.priority,fields.urgency),...fields,id:id('request'),owner:user.id,patientName:user.name,createdAt:Date.now()};db.requests.push(request);notify(db,user.id,'Your care request is ready','Review the services and choose how you would like to find a hospital.','success','analysis');return request;}
  function projectFacilities(db){return db.facilities.map(f=>({...M.clone(f),departments:f.departments.map(d=>({...d,queued:db.queue.filter(q=>q.facilityId===f.id&&q.departmentId===d.id&&['waiting','serving'].includes(q.status)).length}))}));}
  function currentFacility(db,id){return projectFacilities(db).find(f=>f.id===id);}
  function chooseHospital(db,user,requestId,facilityId,selection='manual',replace=false){
    const request=db.requests.find(r=>r.id===requestId&&r.owner===user.id);
    if(!request)throw Error('Create a care request first.');
    const existing=db.journeys.find(j=>j.owner===user.id&&activeStatuses.includes(j.status));
    if(existing&&!replace)throw Error('Finish or cancel your current visit before choosing a new one.');
    const facility=currentFacility(db,facilityId);if(!facility)throw Error('Hospital not found.');
    const evaluated=M.evaluate(facility,request);if(!evaluated.eligible)throw Error('This hospital cannot meet this request right now.');
    if(existing)cancelJourney(db,user.id,existing.id,'Replaced by a new visit plan');
    const journey={id:id('visit'),owner:user.id,patientName:user.name,requestId,request:M.clone(request),facilityId,selection,status:'planned',progress:-1,arrival:M.arrivalFor(request,facility.travel),createdAt:Date.now(),updatedAt:Date.now()};
    db.journeys.push(journey);notify(db,user.id,'Hospital selected',facility.name+' is now in your visit plan.','success','journey');return journey;
  }
  function queueOrder(db,facilityId,departmentId){return db.queue.filter(q=>q.facilityId===facilityId&&(!departmentId||q.departmentId===departmentId)&&['waiting','serving'].includes(q.status)).sort((a,b)=>Number(b.status==='serving')-Number(a.status==='serving')||(a.priority===b.priority?0:a.priority==='urgent'?-1:1)||a.createdAt-b.createdAt||a.token.localeCompare(b.token));}
  function queueInfo(db,journey){const ticket=db.queue.find(q=>q.journeyId===journey.id&&!['completed','cancelled'].includes(q.status));if(!ticket)return null;const ordered=queueOrder(db,ticket.facilityId,ticket.departmentId),index=ordered.findIndex(q=>q.id===ticket.id);const f=db.facilities.find(f=>f.id===ticket.facilityId),d=f.departments.find(d=>d.id===ticket.departmentId);return {...ticket,position:ticket.status==='waiting'?index+1:0,ahead:Math.max(0,index),wait:ticket.status==='serving'?0:Math.ceil(d.baseWait+Math.max(0,index)*d.slotMinutes/Math.max(1,d.capacity)),departmentName:d.name};}
  function checkIn(db,journey){
    if(db.queue.some(q=>q.journeyId===journey.id&&!['completed','cancelled'].includes(q.status)))return;
    const departmentId=M.departmentFor(journey.request);const sequence=(db.sequence[journey.facilityId]||0)+1;db.sequence[journey.facilityId]=sequence;
    db.queue.push({id:id('queue'),journeyId:journey.id,owner:journey.owner,patientName:journey.patientName,facilityId:journey.facilityId,departmentId,token:journey.facilityId+'-'+String(sequence).padStart(3,'0'),priority:'standard',urgencyRequested:journey.request.urgency,status:'waiting',createdAt:Date.now()});
    journey.status='waiting';journey.progress=1;notify(db,journey.owner,'You are checked in','Your queue ticket is ready. Hospital staff will update your status.','success','dashboard');
  }
  function completeJourney(db,journey){
    if(journey.status==='completed')return;
    const f=M.evaluate(currentFacility(db,journey.facilityId),journey.request);journey.progress=M.timeline(f,journey.request,journey.arrival).length-1;journey.status='completed';journey.completedAt=Date.now();journey.updatedAt=Date.now();
    db.queue.filter(q=>q.journeyId===journey.id&&!['completed','cancelled'].includes(q.status)).forEach(q=>q.status='completed');
    notify(db,journey.owner,'Your visit is complete','Share your feedback or create a follow-up reminder.','success','followup');
  }
  function advanceJourney(db,owner,journeyId){
    const j=db.journeys.find(j=>j.id===journeyId&&j.owner===owner);if(!j)throw Error('Visit not found.');
    if(j.status==='needs-review')throw Error('Review the service change before continuing.');
    if(j.status==='completed'||j.status==='cancelled')return j;
    if(j.status==='planned'){j.status='travelling';j.progress=0;notify(db,owner,'Journey started','Your hospital and queue status are available in your workspace.','info','dashboard');}
    else if(j.status==='travelling')checkIn(db,j);
    else if(j.status==='waiting')throw Error('Wait for hospital staff to call your ticket.');
    else if(j.status==='in-care'){const f=M.evaluate(currentFacility(db,j.facilityId),j.request);const events=M.timeline(f,j.request,j.arrival);if(j.progress+1>=events.length-1)completeJourney(db,j);else j.progress++;}
    j.updatedAt=Date.now();return j;
  }
  function cancelJourney(db,owner,journeyId,reason='Visit cancelled'){const j=db.journeys.find(j=>j.id===journeyId&&j.owner===owner);if(!j||!activeStatuses.includes(j.status))return;j.status='cancelled';j.updatedAt=Date.now();db.queue.filter(q=>q.journeyId===j.id&&!['completed','cancelled'].includes(q.status)).forEach(q=>q.status='cancelled');notify(db,owner,reason,'The queue ticket for this visit has been released.','info','dashboard');}
  function callNext(db,facilityId,departmentId){
    const f=db.facilities.find(f=>f.id===facilityId),d=f?.departments.find(d=>d.id===departmentId);if(!d?.available||!f.open)throw Error('This department is not accepting patients.');
    const serving=db.queue.filter(q=>q.facilityId===facilityId&&q.departmentId===departmentId&&q.status==='serving');if(serving.length>=d.capacity)throw Error('All service slots are occupied. Complete a current visit first.');
    const ticket=queueOrder(db,facilityId,departmentId).find(q=>q.status==='waiting');if(!ticket)throw Error('There are no patients waiting in this department.');
    ticket.status='serving';ticket.calledAt=Date.now();const j=db.journeys.find(j=>j.id===ticket.journeyId);j.status='in-care';j.progress=2;j.updatedAt=Date.now();notify(db,j.owner,'Your turn: '+ticket.token,'Please go to '+d.name+'. Hospital staff are ready for you.','success','journey');return ticket;
  }
  function updateQueue(db,facilityId,ticketId,action){const ticket=db.queue.find(q=>q.id===ticketId&&q.facilityId===facilityId);if(!ticket)throw Error('Queue ticket not found.');if(action==='complete'){if(ticket.status!=='serving')throw Error('Only a visit in care can be completed.');completeJourney(db,db.journeys.find(j=>j.id===ticket.journeyId));}else if(action==='priority'){if(ticket.status!=='waiting')throw Error('Only waiting tickets can be reprioritized.');ticket.priority=ticket.priority==='urgent'?'standard':'urgent';notify(db,ticket.owner,'Queue priority updated','Hospital staff updated your queue priority.','info','dashboard');}else throw Error('Unknown queue action.');return ticket;}
  function reconcile(db,facilityId){for(const j of db.journeys.filter(j=>j.facilityId===facilityId&&activeStatuses.includes(j.status))){const eligible=M.evaluate(currentFacility(db,facilityId),j.request).eligible;if(!eligible&&j.status!=='needs-review'){j.previousStatus=j.status;j.status='needs-review';db.queue.filter(q=>q.journeyId===j.id&&['waiting','serving'].includes(q.status)).forEach(q=>q.status='paused');notify(db,j.owner,'A service in your plan changed','Review the updated availability and choose another hospital if needed.','warning','journey');}else if(eligible&&j.status==='needs-review'){j.status=['waiting','in-care'].includes(j.previousStatus)?'waiting':j.previousStatus||'planned';if(j.status==='waiting')j.progress=1;db.queue.filter(q=>q.journeyId===j.id&&q.status==='paused').forEach(q=>q.status='waiting');notify(db,j.owner,'Services are available again','Your visit plan is ready to continue.','success','journey');}}}
  function updateDepartment(db,facilityId,departmentId,fields){const f=db.facilities.find(f=>f.id===facilityId),d=f?.departments.find(d=>d.id===departmentId);if(!d)throw Error('Department not found.');d.available=!!fields.available;d.baseWait=Math.min(180,Math.max(0,Number(fields.baseWait)||0));d.slotMinutes=Math.min(90,Math.max(5,Number(fields.slotMinutes)||15));d.capacity=Math.min(10,Math.max(1,Math.floor(Number(fields.capacity)||1)));f.updatedAt=Date.now();reconcile(db,facilityId);return d;}
  function updateFacility(db,facilityId,fields){const f=db.facilities.find(f=>f.id===facilityId);if(!f)throw Error('Hospital not found.');if(typeof fields.open==='boolean')f.open=fields.open;if(typeof fields.doctor==='boolean')f.doctor=fields.doctor;if(typeof fields.emergency==='boolean')f.emergency=fields.emergency;for(const key of ['xray','lab','pharmacy'])if(typeof fields[key]==='boolean')f.services[key]=fields[key];f.updatedAt=Date.now();reconcile(db,facilityId);return f;}
  function quickNotification(db,facilityId,journeyId,message){const j=db.journeys.find(j=>j.id===journeyId&&j.facilityId===facilityId);if(!j)throw Error('Visit not found.');const text=String(message||'').trim();if(!text)throw Error('Add a message first.');return notify(db,j.owner,'Message from your hospital',text.slice(0,500),'info','updates');}
  function saveFeedback(db,owner,journeyId,fields){const j=db.journeys.find(j=>j.id===journeyId&&j.owner===owner&&j.status==='completed');if(!j)throw Error('Complete your visit before adding feedback.');const rating=Number(fields.rating);if(!Number.isInteger(rating)||rating<1||rating>5)throw Error('Choose a rating from 1 to 5.');const record={id:id('feedback'),owner,journeyId,facilityId:j.facilityId,rating,comment:String(fields.comment||'').trim().slice(0,1000),reminderDate:fields.reminderDate||'',createdAt:Date.now()};const previous=db.feedback.findIndex(f=>f.journeyId===journeyId);if(previous>=0)db.feedback[previous]=record;else db.feedback.push(record);notify(db,owner,'Your feedback has been saved',record.reminderDate?'Follow-up reminder: '+record.reminderDate:'Thank you for sharing your experience.','success','followup');return record;}
  function sendSupport(db,user,journeyId,text){const j=db.journeys.find(j=>j.id===journeyId);if(!j||(user.role==='patient'?j.owner!==user.id:j.facilityId!==user.facilityId))throw Error('You cannot access this conversation.');text=String(text||'').trim();if(!text)throw Error('Write a message first.');const record={id:id('message'),journeyId,owner:j.owner,facilityId:j.facilityId,from:user.role,text:text.slice(0,1000),createdAt:Date.now()};db.messages.push(record);if(user.role==='hospital')notify(db,j.owner,'Your hospital replied',text.slice(0,160),'info','followup');return record;}
  const api={createState,notify,requestFor,journeyFor,submitRequest,projectFacilities,currentFacility,chooseHospital,queueOrder,queueInfo,advanceJourney,cancelJourney,callNext,updateQueue,updateDepartment,updateFacility,saveFeedback,quickNotification,sendSupport,activeStatuses};root.CareFlowWorkflow=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
