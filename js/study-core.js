/* Pure study scheduling and test helpers, shared by the UI and unit tests. */
(function(root){
  const DAY=86400000, intervals=[0,1,3,7,16,35];
  function review(previous,rating,now=Date.now()) {
    if(!Number.isInteger(rating)||rating<0||rating>3)throw Error('Invalid card rating');
    const old=previous&&typeof previous==='object'?previous:{box:0,seen:0,lapses:0};
    const box=rating===0?0:rating===1?(old.box||0):Math.min(5,(old.box||0)+(rating===3?2:1));
    return {box,due:now+intervals[box]*DAY,reviewedAt:now,seen:(old.seen||0)+1,lapses:(old.lapses||0)+(rating===0?1:0),rating};
  }
  const due=(record,now=Date.now())=>!record||!Number.isFinite(record.due)||record.due<=now;
  function shuffle(items,seed=1) {
    const out=[...items];let n=(Number(seed)>>>0)||1;
    const random=()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};
    for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;
  }
  function score(questions,answers) {
    let correct=0,answered=0;const wrong=[],byModule={};
    questions.forEach(q=>{const pick=answers[q.id],hit=pick===q.answer;if(Number.isInteger(pick))answered++;if(hit)correct++;else wrong.push(q.id);const m=byModule[q.module]||={correct:0,total:0};m.total++;if(hit)m.correct++;});
    return {correct,total:questions.length,answered,unanswered:questions.length-answered,percent:questions.length?Math.round(correct/questions.length*100):0,wrong,byModule};
  }
  const normal=s=>String(s).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
  root.StudyCore={review,due,shuffle,score,normal,intervals};
})(typeof window==='undefined'?globalThis:window);
