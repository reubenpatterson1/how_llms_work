(function(){
  var MODULES=['part1','part2','part3','part4','part5','part6'];
  var LABELS=['Part 1','Part 2','Part 3','Part 4','Part 5','Part 6'];
  var current=window.__LLM_MODULE_ID__;
  var idx=MODULES.indexOf(current);
  if(idx<0)return;

  function getProgress(){try{return JSON.parse(localStorage.getItem('llm_course_progress'))||{}}catch(e){return{}}}
  function setProgress(id){var p=getProgress();p[id]=Date.now();localStorage.setItem('llm_course_progress',JSON.stringify(p))}

  // Analytics: user ID (persistent across sessions)
  var userId=localStorage.getItem('llm_user_id');
  if(!userId){userId='u_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36);localStorage.setItem('llm_user_id',userId);}

  function trackEvent(eventType,module,data){
    try{fetch('/api/analytics/event',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({user_id:userId,event_type:eventType,module:module,data:data})});}catch(e){}
  }

  // Track module start
  trackEvent('module_start',current);

  // Watch for quiz completion (certificate generation) via DOM mutation
  var quizTracked=false;
  var observer=new MutationObserver(function(){
    if(quizTracked)return;
    var text=document.body.innerText;
    if(text.indexOf('Certificate')>-1 && (text.indexOf('Score:')>-1 || text.indexOf('/ 27')>-1 || text.indexOf('/ 18')>-1 || text.indexOf('/ 12')>-1 || text.indexOf('/ 15')>-1)){
      quizTracked=true;
      var scoreMatch=text.match(/(\d+)\s*\/\s*(\d+)/g);
      var score=null,total=null;
      if(scoreMatch){for(var i=0;i<scoreMatch.length;i++){var parts=scoreMatch[i].split('/').map(function(s){return parseInt(s.trim(),10)});if(parts[1]>=12&&parts[1]<=27){score=parts[0];total=parts[1];break;}}}
      var passed=score&&total?score/total>=0.7:false;
      trackEvent('quiz_complete',current,{score:score,total:total,passed:passed,name:localStorage.getItem('llm_quiz_name_'+current)||''});
    }
  });
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});

  // Expose name capture for quiz components
  window.__llmTrackQuizName=function(name){localStorage.setItem('llm_quiz_name_'+current,name);};

  // Gate: check prerequisite (except Part 1)
  if(idx>0){
    var prev=MODULES[idx-1];
    var prog=getProgress();
    if(!prog[prev]){
      window.location.href='/';
      return;
    }
  }

  // Inject floating nav bar
  var bar=document.createElement('div');
  bar.id='llm-flow-bar';
  bar.innerHTML='<a href="/" style="color:#94a3b8;text-decoration:none;font-size:.85rem">&larr; Course Home</a>'+
    '<span style="color:#64748b;font-size:.85rem">'+LABELS[idx]+' of 6</span>'+
    '<button id="llm-complete-btn" style="display:none;padding:6px 16px;background:#22c55e;color:#fff;border:none;border-radius:6px;font-size:.85rem;font-weight:600;cursor:pointer;transition:all .2s">Complete &amp; Continue &rarr;</button>';
  bar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:rgba(15,23,42,.95);backdrop-filter:blur(8px);border-bottom:1px solid #334155;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:-apple-system,BlinkMacSystemFont,sans-serif';
  document.body.appendChild(bar);
  document.body.style.paddingTop='40px';

  var btn=document.getElementById('llm-complete-btn');

  // Show complete button when user reaches the quiz slide (last 2 slides)
  function checkSlidePosition(){
    var texts=document.body.innerText;
    var match=texts.match(/(\d+)\s*\/\s*(\d+)/);
    if(match){
      var cur=parseInt(match[1],10);
      var total=parseInt(match[2],10);
      if(total>0 && cur>=total-1){
        btn.style.display='inline-block';
        return;
      }
    }
    btn.style.display='none';
  }

  // Also show if already completed
  var prog=getProgress();
  if(prog[current]){
    btn.style.display='inline-block';
    btn.textContent=idx<MODULES.length-1?'Continue to '+LABELS[idx+1]+' \u2192':'Course Complete \u2713';
    btn.style.background=idx<MODULES.length-1?'#3b82f6':'#8b5cf6';
  }

  setInterval(checkSlidePosition,1000);

  btn.addEventListener('click',function(){
    setProgress(current);
    trackEvent('module_complete',current);
    if(idx<MODULES.length-1){
      window.location.href='/';
    }else{
      btn.textContent='Course Complete!';
      btn.style.background='#8b5cf6';
      setTimeout(function(){window.location.href='/'},1000);
    }
  });
})();
