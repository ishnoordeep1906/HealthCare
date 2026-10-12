(function(root){
  'use strict';
  const config=root.CareFlowConfig||{};
  let token='';
  async function requestJSON(url,options={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    try{const response=await fetch(url,{...options,signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.detail||data.error?.message||'The connected service could not complete this request.');return data;}
    catch(error){if(error.name==='AbortError')throw Error('The service took too long to respond. Please try again.');throw error;}
    finally{clearTimeout(timeout);}
  }
  async function signIn(email,password,role){
    if(!config.firebaseApiKey)throw Error('Firebase sign-in is not configured.');
    const result=await requestJSON('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(config.firebaseApiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
    token=result.idToken;
    if(role==='hospital'&&!config.apiBase){token='';throw Error('Hospital access requires the server role-verification connection.');}
    let claims={role:'patient',name:result.displayName||email.split('@')[0]};
    if(config.apiBase){try{claims=await requestJSON(config.apiBase.replace(/\/$/,'')+'/session',{headers:{Authorization:'Bearer '+token}});}catch(error){token='';throw error;}}
    if(claims.role!==role){token='';throw Error('This account does not have access to the selected workspace.');}
    return {id:result.localId,name:claims.name||result.displayName||email.split('@')[0],role,facilityId:claims.facilityId||'',provider:'Firebase'};
  }
  async function analyze(fields,image){
    if(!config.apiBase||!token)throw Error('Sign in with a configured account to use connected analysis.');
    return requestJSON(config.apiBase.replace(/\/$/,'')+'/analyze',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({text:fields.text,category:fields.category,urgency:fields.urgency,image:image?{mimeType:image.type,data:image.dataUrl.split(',')[1]}:null})});
  }
  root.CareFlowProviders={config,signIn,analyze,hasAuth:()=>!!config.firebaseApiKey,hasAnalysis:()=>!!config.apiBase&&!!token,signOut(){token='';}};
})(window);
