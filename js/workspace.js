/* Signed-in study workspace. Content never lives in this public source file. */
window.StudyWorkspace=(()=>{
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const P=()=>LearnSkit.state.position;
  const save=(key,value)=>{P()[key]=value;LearnSkit.put('position',key,value);};
  const cardId=(m,i)=>m.cardIds?.[i]||`${m.id}-c${i}`;
  const qid=(m,i,bonus=false)=>(bonus?m.bonusIds:m.questionIds)?.[i]||`${m.id}-q${i}`;
  const cards=()=>SUBJECTS.flatMap(s=>s.modules.flatMap(m=>(m.cards||[]).map((c,i)=>({id:cardId(m,i),c,m,s,meta:m.cardMeta?.[i]||{}}))));
  const questions=()=>SUBJECTS.flatMap(s=>s.modules.flatMap(m=>[false,true].flatMap(bonus=>(bonus?m.bonus||[]:m.mcq||[]).map((q,i)=>({id:qid(m,i,bonus),q,m,s,bonus,meta:(bonus?m.bonusMeta:m.questionMeta)?.[i]||{},answer:q[2],module:m.id})))));
  const link=(m,s,kind)=>`#/s/${s.slug}/${m.id}/${kind}`;
  let root,timer,keyHandler=null,dispose=null;
  function stop(){if(dispose){const fn=dispose;dispose=null;fn();}clearInterval(timer);timer=null;keyHandler=null;}
  addEventListener('keydown',e=>{if(keyHandler&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))keyHandler(e);});
  const header=(title,copy='')=>`<div class="page-head"><div><a class="crumb" href="#/tools">Study tools</a><h1>${esc(title)}</h1><p>${esc(copy)}</p></div></div>`;
  const panel=body=>`<div class="panel">${body}</div>`;
  const empty=message=>panel(`<p class="muted">${esc(message)}</p>`);
  function shell(title,copy,body){root.innerHTML=`<div class="wrap workspace view-in">${header(title,copy)}${body}</div>`;}
  function download(name,content,type='application/json') {const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function toggleBookmark(id,type,module,subject){const key='bookmark:'+id;save(key,P()[key]?null:{id,type,module,subject,at:Date.now()});return!!P()[key];}
  function controls(id,type,module,subject){return `<div class="item-tools"><button type="button" class="btn sm clay" data-bookmark="${esc(id)}" data-type="${type}" data-module="${esc(module)}" data-subject="${esc(subject)}" aria-pressed="${!!P()['bookmark:'+id]}">${P()['bookmark:'+id]?'Saved':'Save'}</button><button type="button" class="btn sm clay" data-report="${esc(id)}">Report issue</button></div>`;}
  function bindControls(scope=root){
    $$('[data-bookmark]',scope).forEach(b=>b.onclick=()=>{const yes=toggleBookmark(b.dataset.bookmark,b.dataset.type,b.dataset.module,b.dataset.subject);b.textContent=yes?'Saved':'Save';b.setAttribute('aria-pressed',yes);});
    $$('[data-report]',scope).forEach(b=>b.onclick=()=>report(b.dataset.report));
  }
  function report(item='general') {
    const dialog=document.createElement('dialog');dialog.className='study-dialog';
    dialog.innerHTML=`<form><h2>Report an issue</h2><p class="muted">${esc(item)}</p><label>Issue<select name="category"><option>Wrong answer</option><option>Typo</option><option>Unclear explanation</option><option>Source conflict</option><option>Other</option></select></label><label>Details<textarea name="details" maxlength="1500" rows="4" placeholder="What should we check?" required></textarea></label><p class="muted" role="status"></p><div class="row"><button type="button" class="btn clay" data-close>Cancel</button><button class="btn ink">Save report</button></div></form>`;
    document.body.append(dialog);$('[data-close]',dialog).onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();
    $('form',dialog).onsubmit=e=>{e.preventDefault();const data=new FormData(e.target),id=crypto.randomUUID();save('report:'+id,{id,item,category:data.get('category'),details:data.get('details'),created_at:new Date().toISOString(),status:'pending'});LearnSkit.queueRpc?.('study_report',{p_id:id,p_item:item,p_category:data.get('category'),p_details:data.get('details')});dialog.innerHTML='<h2>Report saved</h2><p>Thank you. Your report will sync when the service is available.</p><button class="btn ink" type="button">Close</button>';$('button',dialog).onclick=()=>dialog.close();};dialog.showModal();
  }
  function dashboard(){
    const due=cards().filter(x=>StudyCore.due(P()['srs:'+x.id])),wrong=questions().filter(x=>LearnSkit.state.mcq[x.id]?.ok===false),bookmarks=Object.values(P()).filter(x=>x?.type&&x?.id&&x.at);
    shell('Study tools','Pick up where you stopped, or work on what needs another pass.',`<div class="tool-grid">${[
      ['cards','Due cards',`${due.length} ready to review`],['search','Search','Find a card, question or note'],['bookmarks','Saved items',`${bookmarks.length} saved`],['mistakes','Mistake notebook',`${wrong.length} questions to revisit`],['mock','Timed test','Build a test from your subject modules'],['videos','EVS video library','Full, sprint and blitz playlists'],['reference','EVS reference sheets','Dates, laws, SDGs and confusables'],['settings','Settings','Profile, preferences and your data'],['stats','Study statistics','Your progress and aggregate usage']
    ].map(([path,title,copy])=>`<a class="panel tool-card" href="#/tools/${path}"><h2>${title}</h2><p class="muted">${copy}</p></a>`).join('')}</div><div class="row utility-links"><a href="#/privacy">Privacy</a><a href="#/terms">Terms</a><a href="#/about">About & content notice</a><button class="btn sm clay" type="button" id="feedback">Give feedback</button></div>`);$('#feedback').onclick=()=>report();const host=$('.tool-grid');LearnSkit.rpc('study_is_admin',{}).then(yes=>{if(yes===true&&host.isConnected)host.insertAdjacentHTML('beforeend','<a class="panel tool-card" href="#/tools/admin"><h2>Admin</h2><p class="muted">Content reports and usage overview</p></a>');}).catch(()=>{});
  }
  function search(){
    shell('Search','Search the study content available in your account.',`${panel('<label>Search<input id="study-search" type="search" placeholder="Topic, formula, keyword or item ID" autocomplete="off"></label>')}<div id="search-results" class="search-results"></div>`);
    const all=[...cards().map(x=>({...x,type:'card',title:x.c[0],body:x.c[1],href:link(x.m,x.s,'cards')})),...questions().map(x=>({...x,type:'question',title:x.q[0],body:x.q[4],href:link(x.m,x.s,'practice')})),...SUBJECTS.flatMap(s=>s.modules.filter(m=>m.note).map(m=>({id:'NOTE-'+m.id,type:'note',title:m.title,body:JSON.stringify(m.note),href:link(m,s,'notes'),m,s})))];
    const input=$('#study-search'),output=$('#search-results');
    input.oninput=()=>{const term=StudyCore.normal(input.value);if(!term){output.innerHTML='';return;}const hits=all.filter(x=>StudyCore.normal(x.id+' '+x.title+' '+x.body).includes(term)).slice(0,60);output.innerHTML=`<p class="muted">${hits.length}${hits.length===60?'+':''} results</p>`+(hits.map(x=>`<article class="panel"><p class="qmeta">${esc(x.id)} · ${esc(x.m.title)} · ${x.type}</p><h2><a href="${x.href}">${esc(x.title)}</a></h2><p>${esc(String(x.body).slice(0,230))}</p>${controls(x.id,x.type,x.m.id,x.s.slug)}</article>`).join('')||empty('No matching study items.'));bindControls(output);};input.focus();
  }
  function showBookmarks(){const saved=new Set(Object.keys(P()).filter(k=>k.startsWith('bookmark:')&&P()[k]).map(k=>k.slice(9)));const list=[...cards().map(x=>({...x,type:'card',title:x.c[0],body:x.c[1],href:link(x.m,x.s,'cards')})),...questions().map(x=>({...x,type:'question',title:x.q[0],body:x.q[4],href:link(x.m,x.s,'practice')})),...SUBJECTS.flatMap(s=>s.modules.filter(m=>m.note).map(m=>({id:'NOTE-'+m.id,type:'note',title:m.title,body:'Module notes',href:link(m,s,'notes'),m,s})))].filter(x=>saved.has(x.id));shell('Saved items','Your saved cards, questions and notes.',list.map(x=>panel(`<p class="qmeta">${esc(x.id)} · ${esc(x.m.title)}</p><h2><a href="${x.href}">${esc(x.title)}</a></h2><p>${esc(x.body)}</p>${controls(x.id,x.type,x.m.id,x.s.slug)}`)).join('')||empty('Nothing saved yet. Use Save on a card or question.'));bindControls();}
  function questionHTML(x,reveal=false){const group=x.meta.group||x.meta.passage||x.meta.scenario;return `<article class="panel question-item" data-question="${esc(x.id)}"><p class="qmeta">${esc(x.id)} · ${esc(x.m.title)} · ${x.bonus?'Bonus · ':''}${{E:'Easy',M:'Medium',H:'Hard'}[x.q[7]]||''}</p>${group?`<details class="question-group" open><summary>Shared passage or scenario</summary><p>${esc(typeof group==='string'?group:group.text||group.passage||group.scenario||'')}</p></details>`:''}${x.q[8]?'<p class="chip">Source conflict · confirm with your faculty</p>':''}<h2>${esc(x.q[0])}</h2><ol type="A">${x.q[1].map(o=>`<li>${esc(o)}</li>`).join('')}</ol><details ${reveal?'open':''}><summary>Answer and explanation</summary><p><b>${'ABCD'[x.q[2]]}. ${esc(x.q[1][x.q[2]])}</b></p><p>${esc(x.q[4])}</p>${x.q[5]?`<p><b>Shortcut:</b> ${esc(x.q[5])}</p>`:''}${x.q[6]?`<p><b>Trap:</b> ${esc(x.q[6])}</p>`:''}</details>${controls(x.id,'question',x.m.id,x.s.slug)}</article>`;}
  function mistakes(){const list=questions().filter(x=>{const a=LearnSkit.state.mcq[x.id];return a&&(a.ok===false||a.elapsed_ms>(x.meta.expected_time_sec||60)*1000);});shell('Mistake notebook','Revisit wrong or slow answers. Answers stay covered until you open them.',list.map(x=>questionHTML(x)).join('')||empty('No wrong answers recorded yet.'));bindControls();}
  function cardDeck(){
    shell('Review cards','Five-box scheduling: 0, 1, 3, 7, 16 and 35 days.',`${panel(`<div class="form-grid"><label>Subject<select id="deck-subject"><option value="all">All subjects</option>${SUBJECTS.map(s=>`<option value="${s.slug}">${esc(s.short)}</option>`).join('')}</select></label><label>Deck<select id="deck-kind"><option value="due">Due now</option><option value="star">Starred facts</option><option value="saved">Saved cards</option><option value="all">All cards</option></select></label></div><button class="btn ink" type="button" id="start-deck">Start review</button>`)}<div id="deck-session"></div>`);
    $('#start-deck').onclick=()=>{const subject=$('#deck-subject').value,kind=$('#deck-kind').value,prefs=P().preferences||{},day=new Date().toISOString().slice(0,10);let introduced=Number(P()['new-cards:'+day]||0),news=0;let deck=cards().filter(x=>(subject==='all'||x.s.slug===subject)&&(kind==='all'||kind==='due'&&StudyCore.due(P()['srs:'+x.id])||kind==='star'&&x.meta.tier==='S'||kind==='saved'&&P()['bookmark:'+x.id])).filter(x=>{if(kind!=='due'||P()['srs:'+x.id])return true;return news++<Math.max(0,Math.min(100,prefs.newCardLimit||20)-introduced);});let cursor=0,split=[0,0,0,0],weak=[];const target=$('#deck-session');
      function draw(){if(cursor>=deck.length){target.innerHTML=panel(`<h2>${deck.length?'Review complete':'Nothing due'}</h2><p>${deck.length} cards · Again ${split[0]} · Hard ${split[1]} · Good ${split[2]} · Easy ${split[3]}</p>${weak.length?'<p>Revisit: '+weak.map(x=>esc(x.c[0])).join(' · ')+'</p>':''}`);keyHandler=null;return;}const x=deck[cursor],reverse=prefs.reverseCards&&x.meta.bidirectional,front=reverse?x.c[1]:x.c[0],back=reverse?x.c[0]:x.c[1];target.innerHTML=panel(`<p class="qmeta">${cursor+1}/${deck.length} · ${esc(x.id)}</p><h2>${esc(front)}</h2><button class="btn clay" type="button" id="deck-flip">Reveal answer</button><div id="deck-back" hidden><p class="card-answer">${esc(back)}</p>${x.c[2]?`<p class="muted">${esc(x.c[2])}</p>`:''}<div class="row">${['Again','Hard','Good','Easy'].map((v,i)=>`<button class="btn clay" type="button" data-rating="${i}">${i+1} · ${v}</button>`).join('')}</div></div>${controls(x.id,'card',x.m.id,x.s.slug)}`);let flipped=false;const flip=()=>{flipped=true;$('#deck-back').hidden=false;$('#deck-flip').hidden=true;};const rate=i=>{if(!flipped)return;const wasNew=!P()['srs:'+x.id],record=StudyCore.review(P()['srs:'+x.id],i);save('srs:'+x.id,record);LearnSkit.state.box[x.id]=record.box;LearnSkit.put('box',x.id,record.box);if(wasNew){introduced++;save('new-cards:'+day,introduced);}LearnSkit.queueRpc?.('study_event',{p_id:crypto.randomUUID(),p_type:'card_review',p_details:{item:x.id,rating:i}});split[i]++;if(i<2)weak.push(x);cursor++;draw();};$('#deck-flip').onclick=flip;$$('[data-rating]',target).forEach(b=>b.onclick=()=>rate(+b.dataset.rating));keyHandler=e=>{if(e.key===' '){e.preventDefault();flip();}if(/^[1-4]$/.test(e.key))rate(+e.key-1);};bindControls(target);}
      draw();
    };
  }
  function fullSyllabusPractice(slug) {
    const subject = SUBJECTS.find(item => item.slug === slug);
    if (!subject) return dashboard();
    const pool = [...new Map(questions().filter(item => item.s.slug === slug).map(item => [item.id, item])).values()];
    const byId = new Map(pool.map(item => [item.id,item]));
    const key = `full-practice:${slug}`;
    let run = P()[key];
    const old = P().mock;
    if (!run && old?.duration === null && !old.submittedAt && old.questionIds?.length &&
        old.questionIds.every(id => byId.has(id))) {
      run = {id:old.id, seed:old.seed, questionIds:[...old.questionIds], answers:{...old.answers},
        marked:{...old.marked}, cursor:old.cursor || 0, startedAt:old.startedAt};
      save(key,run);
    }
    const persist = () => save(key,{...run, answers:{...run.answers}, marked:{...run.marked}});
    const list = () => run.questionIds.map(id => byId.get(id)).filter(Boolean);
    const valid = () => run?.questionIds?.length && run.questionIds.every(id => byId.has(id));
    const url = `#/s/${slug}/full-practice`;
    const heading = subject.short + ' full syllabus practice';
  
    function intro() {
      const available = valid();
      shell(heading,'Choose an answer to see feedback and the explanation immediately.',panel(`
        <p>${pool.length} questions across ${new Set(pool.map(item => item.m.id)).size} modules.</p>
        <div class="row">
          ${available ? '<button class="btn ink" id="resume-full-practice" type="button">Continue practice</button>' : ''}
          <button class="btn ${available ? 'clay' : 'ink'}" id="start-full-practice" type="button" ${pool.length ? '' : 'disabled'}>${available ? 'Start again' : 'Start practice'}</button>
        </div>`));
      $('#resume-full-practice')?.addEventListener('click',draw);
      $('#start-full-practice').onclick = () => {
        if (available && !confirm('Start a new practice session? This replaces your saved practice for this subject.')) return;
        const seed = crypto.getRandomValues(new Uint32Array(1))[0];
        const groups = new Map();
        pool.forEach(item => {
          const group = item.m.id + ':' + (item.meta.group_id || item.id);
          if (!groups.has(group)) groups.set(group,[]);
          groups.get(group).push(item.id);
        });
        run = {id:crypto.randomUUID(), seed, questionIds:StudyCore.shuffle([...groups.values()],seed).flat(),
          answers:{}, marked:{}, cursor:0, startedAt:Date.now()};
        persist();
        draw();
      };
    }
  
    function summary() {
      const items = list(), result = StudyCore.score(items,run.answers);
      shell('Practice summary',`${result.correct}/${result.answered} answered correctly · ${result.unanswered} remaining`,
        panel(`<div class="row"><button class="btn ink" id="continue-full-practice" type="button">Continue practice</button><a class="btn clay" href="${url}">Practice options</a></div>`) +
        items.filter(item => Number.isInteger(run.answers[item.id])).map(item => questionHTML(item,true)).join(''));
      $('#continue-full-practice').onclick = draw;
      bindControls();
    }
  
    function draw() {
      const items = list();
      run.cursor = Math.max(0,Math.min(items.length - 1,run.cursor || 0));
      const item = items[run.cursor], selected = run.answers[item.id];
      const answered = Number.isInteger(selected);
      const correct = selected === item.answer;
      const started = Date.now();
      const group = item.meta.group || item.meta.passage;
      shell(heading,'Your place and answers are saved.',`
        <div class="mock-toolbar panel">
          <p>${Object.keys(run.answers).length}/${items.length} answered</p>
          <div class="question-palette" aria-label="Practice questions">${items.map((q,i) => {
            const pick = run.answers[q.id], done = Number.isInteger(pick);
            return `<button type="button" class="btn sm clay ${done ? (pick === q.answer ? 'practice-correct' : 'practice-wrong') : ''}" aria-current="${i === run.cursor ? 'step' : 'false'}" aria-label="Question ${i+1}${done ? (pick === q.answer ? ', correct' : ', incorrect') : ''}" data-practice-cursor="${i}">${i+1}${done ? (pick === q.answer ? ' ✓' : ' ✗') : ''}</button>`;
          }).join('')}</div>
        </div>
        ${panel(`<p class="qmeta">Question ${run.cursor+1}/${items.length} · ${esc(item.id)}</p>
          ${group ? `<details class="question-group" open><summary>Shared passage or scenario</summary><p>${esc(typeof group === 'string' ? group : group.text || group.passage || '')}</p></details>` : ''}
          ${item.q[8] ? '<p class="chip">Source conflict · confirm with your faculty</p>' : ''}
          <h2>${esc(item.q[0])}</h2>
          <div class="opts">${item.q[1].map((option,i) => `<button type="button" class="opt clay ${answered ? (i === item.answer ? 'ok' : i === selected ? 'bad' : 'dim') : ''}" data-practice-pick="${i}" aria-pressed="${selected === i}" ${answered ? 'disabled' : ''}><span class="l">${'ABCD'[i]}</span><span>${esc(option)}</span><span class="st">${answered ? (i === item.answer ? '✓ Correct answer' : i === selected ? '✗ Your answer' : '') : ''}</span></button>`).join('')}</div>
          ${answered ? `<div class="practice-feedback ${correct ? 'practice-correct' : 'practice-wrong'}" role="status"><b>${correct ? 'Correct' : 'Incorrect'}</b><p>Correct answer: ${'ABCD'[item.answer]}. ${esc(item.q[1][item.answer])}</p></div><div class="layers"><div class="layer ans"><b>Explanation</b><p>${esc(item.q[4])}</p></div>${item.q[5] ? `<div class="layer"><b>Shortcut</b><p>${esc(item.q[5])}</p></div>` : ''}${item.q[6] ? `<div class="layer trap"><b>Trap</b><p>${esc(item.q[6])}</p></div>` : ''}</div>` : ''}
          <div class="row">
            <button type="button" class="btn clay" id="practice-prev" ${run.cursor === 0 ? 'disabled' : ''}>Previous</button>
            <button type="button" class="btn ink" id="practice-next">${run.cursor === items.length-1 ? 'Practice summary' : answered ? 'Next question' : 'Skip question'}</button>
            <button type="button" class="btn clay" id="practice-summary">View progress</button>
          </div>${controls(item.id,'question',item.m.id,slug)}`)}`);
      $$('[data-practice-pick]').forEach(button => button.onclick = () => {
        if (Number.isInteger(run.answers[item.id])) return;
        const pick = Number(button.dataset.practicePick), elapsed = Date.now()-started;
        run.answers[item.id] = pick;
        persist();
        const record = {ok:pick === item.answer, selected:pick, t:Date.now(), elapsed_ms:elapsed};
        LearnSkit.state.mcq[item.id] = record;
        LearnSkit.put('mcq',item.id,record);
        LearnSkit.queueRpc('study_attempt',{p_id:crypto.randomUUID(), p_module:item.m.id,
          p_question:item.id, p_selected:pick, p_elapsed_ms:Math.min(7200000,elapsed)});
        draw();
        $('#practice-next').focus({preventScroll:true});
      });
      $$('[data-practice-cursor]').forEach(button => button.onclick = () => {
        run.cursor = Number(button.dataset.practiceCursor);
        persist();
        draw();
      });
      $('#practice-prev').onclick = () => { run.cursor--; persist(); draw(); };
      $('#practice-next').onclick = () => {
        if (run.cursor === items.length-1) return summary();
        run.cursor++;
        persist();
        draw();
      };
      $('#practice-summary').onclick = summary;
      bindControls();
    }
    intro();
  }
  function mockBuilder(){const saved=P().mock; shell('Timed test','Choose your modules. Answers are revealed only after you submit.',`${saved&&!saved.submittedAt?panel(`<p>You have a saved test in progress.</p><button class="btn ink" id="resume-mock" type="button">Resume test</button>`):''}${saved?.submittedAt?panel('<p>Your last completed test is saved.</p><button class="btn clay" id="last-mock" type="button">View last result</button>'):''}${Object.keys(P()).some(k=>k.startsWith('mock-history:'))?panel('<h2>Test history</h2>'+Object.entries(P()).filter(([k,v])=>k.startsWith('mock-history:')&&v).sort((a,b)=>b[1].date-a[1].date).slice(0,20).map(([,v])=>'<p>'+esc(new Date(v.date).toLocaleString())+' · '+v.correct+'/'+v.total+' correct · '+v.percent+'%</p>').join('')):''}${panel(`<form id="mock-form"><div class="form-grid"><label>Subject<select name="subject">${SUBJECTS.map(s=>`<option value="${s.slug}">${esc(s.short)}</option>`).join('')}</select></label><label>Questions<input name="count" type="number" value="20" min="1" max="200" required></label><label>Minutes<input name="minutes" type="number" value="25" min="1" max="240" required></label><label>Difficulty<select name="difficulty"><option value="all">Mixed</option><option value="E">Easy</option><option value="M">Medium</option><option value="H">Hard</option></select></label></div><fieldset><legend>Modules</legend><div id="mock-modules" class="check-grid"></div></fieldset><button class="btn ink">Start test</button><p id="mock-message" role="status"></p></form>`)}`);
    $('#last-mock')?.addEventListener('click',()=>mockRun());$('#resume-mock')?.addEventListener('click',()=>mockRun());const form=$('#mock-form');function modules(){const s=SUBJECTS.find(s=>s.slug===form.elements.subject.value);$('#mock-modules').innerHTML=s.modules.filter(m=>m.mcq?.length).map(m=>`<label><input type="checkbox" name="module" value="${m.id}" checked> ${esc(m.title)}</label>`).join('')||'<p>No question packs are available yet.</p>';};form.elements.subject.onchange=modules;modules();form.onsubmit=e=>{e.preventDefault();const data=new FormData(form),mods=new Set(data.getAll('module')),pool=questions().filter(x=>!x.bonus&&x.s.slug===data.get('subject')&&mods.has(x.m.id)&&(data.get('difficulty')==='all'||x.q[7]===data.get('difficulty')));if(!pool.length){$('#mock-message').textContent='Choose a module with available questions.';return;}const seed=crypto.getRandomValues(new Uint32Array(1))[0],selected=StudyCore.shuffle(pool,seed).slice(0,Number(data.get('count')));save('mock',{id:crypto.randomUUID(),seed,questionIds:selected.map(x=>x.id),answers:{},marked:{},cursor:0,startedAt:Date.now(),duration:Number(data.get('minutes'))*60000});mockRun();};}
  function mockRun(){stop();const run=P().mock,all=new Map(questions().map(x=>[x.id,x]));if(!run)return mockBuilder();const list=run.questionIds.map(id=>all.get(id));if(list.some(x=>!x)){shell('Test content changed','Start a new test with the current question packs.',`<a class="btn ink" href="#/tools/mock">Build a new test</a>`);save('mock',null);return;}if(run.submittedAt)return mockResult(run,list);
    function draw(){const x=list[run.cursor];shell(run.title || 'Timed test','Your selections are saved. You can leave and resume this test.',`<div class="mock-toolbar panel"><b id="mock-clock" role="timer"></b><div class="question-palette">${list.map((q,i)=>`<button type="button" class="btn sm clay ${run.marked[q.id]?'marked':''}" aria-current="${i===run.cursor?'step':'false'}" data-cursor="${i}">${i+1}${Number.isInteger(run.answers[q.id])?' ✓':''}${run.marked[q.id]?' •':''}</button>`).join('')}</div></div>${panel(`<p class="qmeta">Question ${run.cursor+1}/${list.length} · ${esc(x.id)}</p>${x.meta.group||x.meta.passage?`<details open><summary>Shared passage or scenario</summary><p>${esc(typeof(x.meta.group||x.meta.passage)==='string'?(x.meta.group||x.meta.passage):JSON.stringify(x.meta.group||x.meta.passage))}</p></details>`:''}<h2>${esc(x.q[0])}</h2><div class="opts">${x.q[1].map((option,i)=>`<button type="button" class="opt clay" aria-pressed="${run.answers[x.id]===i}" data-pick="${i}"><span class="l">${'ABCD'[i]}</span>${esc(option)}</button>`).join('')}</div><div class="row"><button class="btn clay" type="button" id="mock-prev" ${!run.cursor?'disabled':''}>Previous</button><button class="btn clay" type="button" id="mock-mark">${run.marked[x.id]?'Unmark':'Mark for review'}</button><button class="btn clay" type="button" id="mock-clear">Clear answer</button><button class="btn ink" type="button" id="mock-next">${run.cursor===list.length-1?'Review test':'Next'}</button><button class="btn clay" type="button" id="mock-submit">Submit test</button></div>`)}`);
      const persist=()=>save('mock',{...run,answers:{...run.answers},marked:{...run.marked}});$$('[data-pick]').forEach(b=>b.onclick=()=>{run.answers[x.id]=+b.dataset.pick;persist();draw();});$$('[data-cursor]').forEach(b=>b.onclick=()=>{run.cursor=+b.dataset.cursor;persist();draw();});$('#mock-prev').onclick=()=>{run.cursor=Math.max(0,run.cursor-1);persist();draw();};$('#mock-next').onclick=()=>{run.cursor=(run.cursor+1)%list.length;persist();draw();};$('#mock-mark').onclick=()=>{run.marked[x.id]=!run.marked[x.id];persist();draw();};$('#mock-clear').onclick=()=>{delete run.answers[x.id];persist();draw();};$('#mock-submit').onclick=()=>{const missing=list.filter(q=>!Number.isInteger(run.answers[q.id])).length;if(missing&&!confirm(`${missing} questions are unanswered. Submit this test?`))return;finish();};tick();
    }
    function finish(){clearInterval(timer);run.submittedAt=Date.now();save('mock',run);list.forEach(x=>{const selected=run.answers[x.id];if(!Number.isInteger(selected))return;const ok=selected===x.q[2];LearnSkit.state.mcq[x.id]={ok,t:Date.now(),selected};LearnSkit.put('mcq',x.id,LearnSkit.state.mcq[x.id]);LearnSkit.queueRpc?.('study_attempt',{p_id:crypto.randomUUID(),p_module:x.m.id,p_question:x.id,p_selected:selected,p_elapsed_ms:Math.round((run.submittedAt-run.startedAt)/list.length)});});save('mock-history:'+run.id,{id:run.id,date:run.submittedAt,...StudyCore.score(list,run.answers)});mockResult(run,list);}
    function tick(){if(run.duration===null){const label=document.getElementById('mock-clock');if(label){label.textContent='Untimed · '+Object.keys(run.answers).length+'/'+list.length+' answered';label.removeAttribute('role');}return;}const left=Math.max(0,run.duration-(Date.now()-run.startedAt));const label=$('#mock-clock');if(label)label.textContent=`${Math.floor(left/60000)}:${String(Math.floor(left/1000)%60).padStart(2,'0')} remaining`;if(!left)finish();}
    draw();if(!run.submittedAt&&run.duration!==null)timer=setInterval(tick,1000);
  }
  function mockResult(run,list){const result=StudyCore.score(list,run.answers);shell('Test results',`${result.correct}/${result.total} correct · ${result.percent}% · ${result.unanswered} unanswered`,`${panel(`<h2>By module</h2>${Object.entries(result.byModule).map(([m,r])=>`<p>${esc(m)}: ${r.correct}/${r.total}</p>`).join('')}<a class="btn ink" href="#/tools/mock">Build another test</a>`)}${list.map(x=>questionHTML(x,true)).join('')}`);bindControls();}

  let coursePlayerPromise;
  function loadCoursePlayer() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (!coursePlayerPromise) coursePlayerPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './js/vendor/hls.js';
      script.onload = () => resolve(window.Hls);
      script.onerror = () => { coursePlayerPromise = null; script.remove(); reject(Error('Player unavailable')); };
      document.head.append(script);
    });
    return coursePlayerPromise;
  }

  function videoLibrary() {
    const subject = SUBJECTS.find(s => s.slug === 'evs');
    const modules = subject?.modules.filter(m => m.videos?.full) || [];
    const profiles = {full:'Full lessons', sprint:'Sprint revision', blitz:'Blitz recall'};
    shell('EVS video library', '', panel(`
      <div class="form-grid">
        <label>Watch<select id="library-mode"><option value="lesson">Individual lessons</option><option value="course">Whole syllabus</option></select></label>
        <label>Pace<select id="library-pace">${Object.entries(profiles).map(([id,label]) => `<option value="${id}">${label}</option>`).join('')}</select></label>
        <label><span id="library-lesson-label">Lesson</span><select id="library-lesson"></select></label>
        <label>Speed<select id="library-speed">${[.75,1,1.25,1.5,1.75,2].map(n => `<option value="${n}">${n}×</option>`).join('')}</select></label>
      </div>
      <p role="status" id="library-status"></p>
      <video id="library-player" controls playsinline preload="metadata" aria-label="EVS video player" style="width:100%;border-radius:18px"></video>
      <div class="row" id="library-lesson-nav">
        <button class="btn clay" id="library-prev" type="button">Previous lesson</button>
        <button class="btn ink" id="library-next" type="button">Next lesson</button>
        <a id="library-module" class="btn clay">Open module</a>
      </div>`));
    const mode = $('#library-mode'), pace = $('#library-pace'), lesson = $('#library-lesson');
    const player = $('#library-player'), status = $('#library-status'), speed = $('#library-speed');
    const prev = $('#library-prev'), next = $('#library-next'), moduleLink = $('#library-module');
    const saved = P()['video-library'] || {};
    let request = 0, current = null, loaded = false, lastSave = 0, stream, playlistUrl;
    mode.value = saved.mode === 'course' ? 'course' : 'lesson';
    pace.value = Object.hasOwn(profiles, saved.profile) ? saved.profile : 'full';
    speed.value = String(P()['video-speed'] || 1);
    if (!speed.value) speed.value = '1';
    player.crossOrigin = 'anonymous';
  
    function persist() {
      if (loaded && current && Number.isFinite(player.currentTime)) save(current.key, player.currentTime);
    }
    function syncChapter() {
      if (!current?.course) return;
      const chapter = current.chapters.findLast(ch => ch.start <= player.currentTime);
      if (chapter) lesson.value = chapter.id;
    }
    function reset() {
      request++;
      loaded = false;
      player.onloadedmetadata = null;
      player.pause();
      stream?.destroy();
      stream = null;
      player.removeAttribute('src');
      player.querySelectorAll('track').forEach(track => track.remove());
      player.load();
      if (playlistUrl) URL.revokeObjectURL(playlistUrl);
      playlistUrl = null;
    }
    function captions(url) {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.label = 'English';
      track.srclang = 'en';
      track.src = url;
      player.append(track);
    }
    async function signed(path) {
      const {data,error} = await LearnSkit.videoUrl(path);
      if (error || !data?.signedUrl) throw Error('Video unavailable');
      return data.signedUrl;
    }
  
    async function open(id, autoplay = false) {
      persist();
      reset();
      const ticket = request;
      const alive = () => request === ticket && player.isConnected;
      const profile = pace.value;
      const course = mode.value === 'course';
      const available = modules.filter(m => m.videos[profile]);
      const chapters = subject?.videoChapters?.[profile] || [];
      const index = Math.max(0, available.findIndex(m => m.id === id));
      const module = available[index];
      current = null;
      $('#library-lesson-label').textContent = course ? 'Jump to chapter' : 'Lesson';
      $('#library-lesson-nav').hidden = course;
      const options = course ? chapters : available.map(m => ({id:m.id,title:m.id + ' · ' + m.title}));
      lesson.innerHTML = options.map(({id:optionId,title}) => `<option value="${esc(optionId)}">${esc(title)}</option>`).join('');
      lesson.disabled = course;
      if (!course && module) {
        lesson.value = module.id;
        prev.disabled = index === 0;
        next.disabled = index >= available.length - 1;
        moduleLink.href = `#/s/evs/${module.id}/video`;
      }
      if (!course && !module) {
        status.textContent = 'Video lessons are unavailable for this pace.';
        return;
      }
      save('video-library', {mode:mode.value, profile, module:course ? P()['video-library']?.module : module.id});
      const key = course ? `video-course-time:${profile}` : `${module.id}:video:${profile}`;
      current = {key, course, chapters, available, index};
      const legacy = course ? P()[`video-course:${profile}`] : null;
      const legacyChapter = legacy && chapters.find(chapter => chapter.id === legacy.module);
      const point = P()[key] ?? (legacyChapter && Number.isFinite(legacy.seconds)
        ? legacyChapter.start + legacy.seconds : 0);
      const title = course ? `Whole syllabus · ${profiles[profile]}` : `${module.id} · ${module.title}`;
      status.textContent = `Opening ${title}…`;
      player.onloadedmetadata = () => {
        if (!alive()) return;
        loaded = true;
        lesson.disabled = false;
        player.playbackRate = Number(speed.value);
        if (Number.isFinite(point) && point > 0 && point < player.duration - 1) player.currentTime = point;
        syncChapter();
        if (autoplay) player.play().catch(() => {
          if (alive()) status.textContent = title + '. Press Play to continue.';
        });
      };
      try {
        if (course) {
          const base = `course/${profile}/`;
          const manifest = await fetch(await signed(base + 'index.m3u8'));
          if (!manifest.ok) throw Error('Stream unavailable');
          const source = await manifest.text();
          const files = [...new Set(source.match(/\b(?:init\.mp4|segment-\d+\.m4s)\b/g))];
          if (!files.includes('init.mp4') || files.length < 2) throw Error('Invalid stream playlist');
          if (!alive()) return;
          const [Hls, signedFiles] = await Promise.all([
            loadCoursePlayer(),
            Promise.all(Array.from({length:Math.ceil(files.length / 100)}, (_,i) =>
              LearnSkit.courseUrls(files.slice(i * 100, (i + 1) * 100).map(file => base + file))))
          ]);
          if (!alive()) return;
          const urls = new Map(signedFiles.flatMap(({data}) => data || [])
            .filter(item => item.signedUrl).map(item => [item.path, item.signedUrl]));
          if (files.some(file => !urls.has(base + file))) throw Error('Stream segments unavailable');
          const playlist = source.replace(/\b(?:init\.mp4|segment-\d+\.m4s)\b/g, file => urls.get(base + file));
          playlistUrl = URL.createObjectURL(new Blob([playlist], {type:'application/vnd.apple.mpegurl'}));
          if (Hls.isSupported()) {
            stream = new Hls({enableWorker:false});
            stream.on(Hls.Events.ERROR, (_, error) => {
              if (alive() && error.fatal) status.textContent = 'Playback stopped. Reselect the pace to reconnect.';
            });
            stream.loadSource(playlistUrl);
            stream.attachMedia(player);
          } else if (player.canPlayType('application/vnd.apple.mpegurl')) {
            player.src = playlistUrl;
          } else {
            throw Error('Browser does not support HLS playback');
          }
          signed(base + 'captions.vtt').then(url => { if (alive()) captions(url); }).catch(() => {});
        } else {
          const url = await signed(module.videos[profile]);
          if (!alive()) return;
          player.src = url;
          if (module.captions?.[profile]) signed(module.captions[profile]).then(url => {
            if (alive()) captions(url);
          }).catch(() => {});
        }
        player.playbackRate = Number(speed.value);
        status.textContent = title;
      } catch (error) {
        if (alive()) status.textContent = error.message === 'Browser does not support HLS playback'
          ? 'Whole-syllabus video is unsupported in this browser. Try Chrome or Edge.'
          : 'Video could not open. Reselect the pace to try again.';
      }
    }
  
    function step(delta) {
      if (!current || current.course) return;
      const module = current.available[current.index + delta];
      if (module) open(module.id, true);
    }
  
    dispose = () => { persist(); reset(); };
    mode.onchange = pace.onchange = () => open(P()['video-library']?.module, !player.paused);
    lesson.onchange = () => {
      if (!current?.course) return open(lesson.value, !player.paused);
      const chapter = current.chapters.find(ch => ch.id === lesson.value);
      if (loaded && chapter) player.currentTime = chapter.start;
    };
    speed.onchange = () => {
      player.playbackRate = Number(speed.value);
      save('video-speed', Number(speed.value));
    };
    prev.onclick = () => step(-1);
    next.onclick = () => step(1);
    player.onpause = persist;
    player.onseeked = () => { syncChapter(); persist(); };
    player.ontimeupdate = () => {
      if (!loaded) return;
      syncChapter();
      if (Date.now() - lastSave > 5000) { lastSave = Date.now(); persist(); }
    };
    player.onerror = () => {
      if (player.getAttribute('src')) status.textContent = 'Playback failed. Reselect the pace to reconnect.';
    };
    player.onended = () => {
      if (!current) return;
      loaded = false;
      save(current.key, 0);
      step(1);
    };
    open(saved.module);
  }

  function references(){
    const type=new URLSearchParams(location.hash.split('?')[1]).get('type')||'DATE',labels={DATE:'Timeline',ACT_SEC:'Acts and sections',SDG:'SDGs',CONFUSABLE:'Confusable pairs',ACRONYM:'Acronyms'},all=cards().filter(x=>x.s.slug==='evs'&&x.meta.type===type);
    shell('EVS reference sheets','Source-checked reference cards. Filter by module or cover answers for recall.',`<nav class="subject-tabs glass">${Object.entries(labels).map(([key,label])=>`<a href="#/tools/reference?type=${key}" ${key===type?'aria-current="page"':''}>${label}</a>`).join('')}</nav>${panel('<div class="form-grid"><label>Module<select id="reference-module"><option value="">All modules</option>'+[...new Set(all.map(x=>x.m.id))].map(id=>'<option>'+id+'</option>').join('')+'</select></label><label class="check"><input type="checkbox" id="reference-cover"> Cover answers</label></div>')}<div class="tool-grid" id="reference-items"></div>`);
    const draw=()=>{const list=all.filter(x=>!$('#reference-module').value||x.m.id===$('#reference-module').value),cover=$('#reference-cover').checked;$('#reference-items').innerHTML=list.map(x=>panel(`<p class="qmeta">${esc(x.id)} · ${esc(x.m.id)} · p${(x.meta.src_pages||[]).join(', ')}</p><h2>${esc(x.c[0])}</h2>${cover?'<details><summary>Reveal answer</summary>':''}<p>${esc(x.c[1])}</p>${x.c[2]?`<p class="muted">${esc(x.c[2])}</p>`:''}${cover?'</details>':''}${controls(x.id,'card',x.m.id,x.s.slug)}`)).join('')||empty('No reference cards in this category.');bindControls();};$('#reference-module').onchange=draw;$('#reference-cover').onchange=draw;draw();
  }
  function profileForm(onboarding=false){const profile=P().profile||{},prefs=P().preferences||{},curTheme=prefs.theme||window.Theme?.get()||'light';shell(onboarding?'Set up your study space':'Settings',onboarding?'A few optional details. You can skip this and start studying.':'Your profile, review preferences and data.',`${panel(`<form id="profile-form"><div class="form-grid"><label>Display name<input name="name" maxlength="80" value="${esc(profile.name||LearnSkit.user?.user_metadata?.full_name||'')}" autocomplete="name"></label><label>Branch<select name="branch">${['','CSE','IT','ECE','EEE','Mechanical','Civil','Biotechnology','Other'].map(v=>`<option ${profile.branch===v?'selected':''}>${v}</option>`).join('')}</select></label><label>Admission year<input name="year" type="number" min="2000" max="2100" value="${esc(profile.year||'')}"></label>${!onboarding?`<label>New cards per day<input type="number" name="limit" min="1" max="100" value="${prefs.newCardLimit||20}"></label><label>Theme<select name="theme"><option value="light" ${curTheme==='light'?'selected':''}>Light</option><option value="dark" ${curTheme==='dark'?'selected':''}>Dark</option><option value="system" ${curTheme==='system'?'selected':''}>System</option></select></label><label class="check"><input type="checkbox" name="reverse" ${prefs.reverseCards?'checked':''}> Reverse bidirectional cards</label>`:''}</div><fieldset><legend>Subjects</legend>${SUBJECTS.map(s=>`<label class="check"><input type="checkbox" name="subject" value="${s.slug}" ${!profile.subjects||profile.subjects.includes(s.slug)?'checked':''}> ${esc(s.title)}</label>`).join('')}</fieldset><p class="muted">Your account stores study progress and these optional details. <a href="#/privacy">Privacy notice</a>.</p><div class="row"><button class="btn ink">${onboarding?'Save and start':'Save settings'}</button>${onboarding?'<button class="btn clay" type="button" id="skip-profile">Skip for now</button>':''}</div><p id="settings-status" role="status"></p></form>`)}`+(!onboarding?`${panel('<h2>Your data</h2><div class="row"><button class="btn clay" id="export-data" type="button">Export my data</button><button class="btn clay" id="delete-data" type="button">Delete my account</button><button class="btn clay" id="install-app" type="button">Install app</button></div><p id="account-status" role="status"></p>')}<div class="utility-links row"><a href="#/privacy">Privacy</a><a href="#/terms">Terms</a><a href="#/about">About</a></div>`:''));
    const done=(data)=>{save('profile',{...profile,...data,onboarding_done:true,consent_version:'2026-11-17',consent_at:new Date().toISOString()});LearnSkit.queueRpc?.('study_update_profile',{p_profile:P().profile});if(onboarding)location.hash='#/';};$('#profile-form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target);done({name:String(data.get('name')).trim(),branch:data.get('branch'),year:data.get('year')?Number(data.get('year')):null,subjects:data.getAll('subject')});if(!onboarding){save('preferences',{...prefs,newCardLimit:Number(data.get('limit')),theme:data.get('theme'),reverseCards:data.get('reverse')==='on'});applyTheme();$('#settings-status').textContent='Settings saved.';}};$('#skip-profile')?.addEventListener('click',()=>done({}));$('#export-data')?.addEventListener('click',async()=>{const out=$('#account-status');out.textContent='Preparing export…';let cloud=null;try{cloud=await LearnSkit.rpc('study_export_my_data');}catch{}download('learn-skit-my-data.json',JSON.stringify({exported_at:new Date().toISOString(),user_id:LearnSkit.user?.id,scope:cloud?'cloud and this device':'this device only',cloud,device:LearnSkit.state},null,2));out.textContent=cloud?'Exported your cloud records and device progress.':'Exported this device’s data. Cloud export is unavailable offline.';});$('#delete-data')?.addEventListener('click',async()=>{const typed=prompt('This permanently deletes your account and study data. Type DELETE to continue.');if(typed!=='DELETE')return;try{await LearnSkit.deleteAccount();location.hash='#/';}catch{$('#account-status').textContent='Account deletion is unavailable until the database service is connected. Your data has not been removed.';}});$('#install-app')?.addEventListener('click',async()=>{if(window.installPrompt){await window.installPrompt.prompt();window.installPrompt=null;}else $('#account-status').textContent='Use your browser menu to install this app or add it to your home screen.';});
  }
  function applyTheme(){if(window.Theme){const theme=P().preferences?.theme||window.Theme.get();window.Theme.set(theme);}else{const theme=P().preferences?.theme||'light',dark=theme==='dark'||theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.classList.toggle('dark',dark);}}
  async function adminDashboard(){
    shell('Admin dashboard','Protected usage and content tools.',empty('Checking admin access…'));
    try{
      const data=await LearnSkit.rpc('study_admin_dashboard',{});if(!data?.metrics)throw Error('Admin data unavailable');
      let selected='overview';
      const table=(rows,columns)=>rows?.length?`<div class="table-scroll"><table><thead><tr>${columns.map(([key,label])=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(([key])=>`<td>${esc(typeof row[key]==='object'?JSON.stringify(row[key]):row[key]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="muted">No recorded data yet.</p>';
      const sections=['overview','users','traffic','funnel','retention','content','reports','system'];
      const draw=()=>{
        let body='';
        if(selected==='overview')body=`<div class="tool-grid">${Object.entries(data.metrics).filter(([,v])=>typeof v==='number').map(([key,value])=>panel(`<p class="muted">${esc(key.replace(/_/g,' '))}</p><h2>${value.toLocaleString()}</h2>`)).join('')}</div>`;
        if(selected==='users')body=panel(`<label>Find a user<input id="admin-user-search" type="search" placeholder="Name or account ID"></label><div id="admin-users">${(data.users||[]).map(u=>`<article data-user-row="${esc(u.id)}"><h3>${esc(u.name||u.id)}</h3><p>${u.questions_answered||0} questions · last active ${esc(u.last_active||'No activity')}</p><button class="btn sm clay" data-admin-user="${esc(u.id)}" type="button">View activity</button></article>`).join('')||'<p>No registered users.</p>'}</div><div id="admin-user-detail"></div>`);
        if(selected==='traffic')body=panel(`<h2>Pages</h2>${table(data.pages,[['page','Page'],['views','Views']])}<h2>Devices</h2>${table(data.devices,[['device','Device class'],['views','Views']])}<h2>Referring sites</h2>${table(data.sources,[['source','Source'],['views','Views']])}<p class="muted">Raw IPs and precise locations are not collected.</p>`);
        if(selected==='funnel')body=panel(table(Object.entries(data.funnel||{}).map(([stage,count])=>({stage:stage.replace(/_/g,' '),count})),[['stage','Stage'],['count','Users']]));
        if(selected==='retention')body=panel(`<h2>Day-seven return</h2><p class="muted">Only cohorts old enough to complete the six-to-nine-day return window appear.</p>${table(data.retention,[['cohort','Signup week'],['registered','Registered'],['returned_day_seven','Returned near day seven']])}`);
        if(selected==='content')body=panel(table(data.content,[['subject','Subject'],['module_id','Module'],['cards','Cards'],['core_questions','Core MCQs'],['bonus_questions','Bonus'],['review_status','Verification'],['open_reports','Open reports']]));
        if(selected==='reports')body=panel(`<h2>Content reports</h2>${(data.reports||[]).map(r=>`<article class="admin-report"><p><b>${esc(r.item_id)}</b> · ${esc(r.category)}</p><p>${esc(r.details)}</p><label>Status<select data-report-status="${esc(r.id)}">${['open','reviewing','resolved','dismissed'].map(status=>`<option ${r.status===status?'selected':''}>${status}</option>`).join('')}</select></label><p role="status" id="report-result-${esc(r.id)}"></p></article>`).join('')||'<p>No reports.</p>'}`);
        if(selected==='system')body=panel(table(Object.entries(data.system||{}).map(([field,value])=>({field:field.replace(/_/g,' '),value})),[['field','Field'],['value','Value']]));
        shell('Admin dashboard','Only authorised administrators can read or change these records.',`<nav class="subject-tabs glass" aria-label="Admin sections">${sections.map(section=>`<button class="btn sm clay" type="button" data-admin-section="${section}" aria-pressed="${selected===section}">${section[0].toUpperCase()+section.slice(1)}</button>`).join('')}</nav>${body}<div class="row"><button class="btn clay" id="admin-export" type="button">Export CV metrics</button></div>`);
        $$('[data-admin-section]').forEach(b=>b.onclick=()=>{selected=b.dataset.adminSection;draw();});
        $('#admin-export').onclick=()=>download('learn-skit-cv-metrics.json',JSON.stringify({exported_at:new Date().toISOString(),metrics:data.metrics,retention:data.retention,traffic:data.sources},null,2));
        $('#admin-user-search')?.addEventListener('input',e=>{const term=StudyCore.normal(e.target.value);$$('[data-user-row]').forEach(row=>row.hidden=!StudyCore.normal(row.textContent+' '+row.dataset.userRow).includes(term));});
        $$('[data-admin-user]').forEach(b=>b.onclick=async()=>{const target=$('#admin-user-detail');target.textContent='Loading activity…';try{const user=await LearnSkit.rpc('study_admin_user',{p_user:b.dataset.adminUser});if(!target.isConnected)return;target.innerHTML=`<h2>Recent attempts</h2>${table(user.attempts,[['question_id','Question'],['is_correct','Correct'],['elapsed_ms','Time (ms)'],['created_at','Date']])}<h2>Recent activity</h2>${table(user.events,[['event_type','Event'],['created_at','Date']])}`;}catch{target.textContent='Unable to load this user’s activity.';}});
        $$('[data-report-status]').forEach(select=>select.onchange=async()=>{const id=select.dataset.reportStatus,out=$('#report-result-'+id);try{await LearnSkit.rpc('study_resolve_report',{p_id:id,p_status:select.value});data.reports.find(r=>r.id===id).status=select.value;out.textContent='Status saved.';}catch{out.textContent='Status could not be saved.';}});
      };draw();
    }catch{shell('Admin dashboard','Admin access is checked by the database.',empty('This page needs the connected database and an admin role.'));}
  }
  async function stats(admin=false){shell(admin?'Admin dashboard':'Study statistics','Only recorded activity is counted. No invented usage numbers.',empty('Loading statistics…'));try{const data=await LearnSkit.rpc(admin?'study_admin_dashboard':'study_public_stats',{});if(!root.isConnected)return;const metrics=data?.metrics||data||{};const safeMetrics=Object.entries(metrics).filter(([,value])=>typeof value==='number');shell(admin?'Admin dashboard':'Study statistics','Aggregate usage from the connected database.',`<div class="tool-grid">${safeMetrics.map(([key,value])=>panel(`<p class="muted">${esc(key.replace(/_/g,' '))}</p><h2>${value.toLocaleString()}</h2>`)).join('')}</div>${admin?panel(`<h2>Content reports</h2>${(data.reports||[]).map(r=>`<article><p><b>${esc(r.item_id)}</b> · ${esc(r.category)}</p><p>${esc(r.details)}</p></article>`).join('')||'<p>No content reports.</p>'}<h2>Registered users</h2>${(data.users||[]).map(u=>`<p>${esc(u.name||u.id)} · ${esc(u.last_active||'No activity yet')}</p>`).join('')}<button class="btn clay" id="export-stats" type="button">Export metrics</button>`):''}`);$('#export-stats')?.addEventListener('click',()=>download('learn-skit-admin-metrics.json',JSON.stringify(data,null,2)));}catch{shell(admin?'Admin dashboard':'Study statistics',admin?'Admin access is checked by the database.':'Your recorded activity on this device.',`${panel(`<p>${admin?'This page needs the connected database and an admin role.':'Aggregate statistics will appear after the database is connected.'}</p>${!admin?`<p>Cards reviewed: ${Object.keys(LearnSkit.state.box).length}</p><p>Questions answered: ${Object.keys(LearnSkit.state.mcq).length}</p>`:''}`)}`);}}
  function legal(kind){const content={privacy:['Privacy','We store your Google account identifier, optional profile details, study progress, saved items, content reports and activity needed to provide revision tools. Google sign-in and cloud data use Supabase. Optional details can be omitted. We do not use advertising trackers, collect raw IP addresses in our application analytics, or request precise location. Functional browser storage keeps your session, preferences and unsynced progress. Downloaded offline content stays on this browser until sign-out or removal. You can export your study data in Settings and request account deletion there once the database is connected. Account-linked analytics are removed or anonymised on deletion. Service providers may maintain their own security logs. Content reports are retained to resolve errors. For a privacy request, use the in-app feedback tool; contact details will be added when the owner configures the production service.'],terms:['Terms','learn-skit is an independent student study aid and is not affiliated with VIT. Predicted questions are estimates based on the supplied material, not a promise of exam coverage or results. Source material can conflict or contain errors; confirm flagged items with your faculty. Do not use this service to cheat in an assessment. Keep your account secure and report content errors. Third-party source material belongs to its respective owners. Content may change as errors are corrected.'],about:['About & content notice','learn-skit organises EVS and Quantitative & Qualitative Skills revision into notes, cards, practice and video. Material is paraphrased from the supplied course decks. Computational checks and AI review are disclosed separately from human or faculty approval. No past exam papers were supplied, so “predicted” describes an evidence-based estimate. If you own material and need a correction or takedown, use the in-app feedback tool and include the item ID and source page.'],methodology:['How questions are chosen','Questions prioritise repeated concepts, formulas, named laws, dates, quantities and patterns that fit a four-option MCQ exam. Source citations identify the supporting pages. Questions are checked for a single defensible answer and plausible distractors; numerical questions use executable checks where available. Difficulty and prediction scores describe the study material, not actual exam probabilities. Source conflicts stay labelled. Automated and AI checks do not constitute faculty approval.']}[kind];shell(content[0],'Updated 17 November 2026',panel(`<div class="legal-copy">${content[1].split('. ').map(p=>`<p>${esc(p)}${p.endsWith('.')?'':'.'}</p>`).join('')}</div><div class="row"><a class="btn clay" href="#/">Home</a><a href="#/privacy">Privacy</a><a href="#/terms">Terms</a><a href="#/about">About</a></div>`));}
  function render(target,path){stop();root=target;applyTheme();const route=path.split('?')[0];({tools:dashboard,search,cards:cardDeck,bookmarks:showBookmarks,mistakes,mock:mockBuilder,'full-practice':()=>fullSyllabusPractice(new URLSearchParams(path.split('?')[1]).get('subject')),reference:references,videos:videoLibrary,settings:()=>profileForm(),welcome:()=>profileForm(true),stats:()=>stats(),admin:adminDashboard,privacy:()=>legal('privacy'),terms:()=>legal('terms'),about:()=>legal('about'),methodology:()=>legal('methodology')}[route]||dashboard)();}
  return{render,stop,controls,bindControls,report,applyTheme,save,questions,cards,download};
})();
