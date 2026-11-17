"""Verify source links, allocations, item relationships, and quantitative answers.
This does not substitute for the human review queue required by the content spec.
"""
import ast
from collections import Counter
from fractions import Fraction
import itertools
import json
import math
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parents[2]
STUDY=ROOT/'study-content'
ALLOC={'QA-TSD':(26,22,6),'QA-MIX':(16,12,3),'QA-AVG':(14,10,0),'QA-PART':(12,8,0),'QA-PL':(18,12,3),'QA-SICI':(16,14,4),'QA-PCT':(12,8,4),'QA-CRYPT':(10,8,0),'QA-SQCUBE':(30,12,0),'QA-SPEED':(16,14,5),'QL-BLOOD':(12,14,4),'QL-SEAT':(10,14,4),'QL-ANALOGY':(12,12,3),'QL-SYN':(14,7,2),'QL-ANT':(13,7,2),'QL-JUMBLE':(13,6,0),'QL-RC':(8,10,0),'SS-RESUME':(10,4,0),'SS-PROFILE':(7,3,0),'SS-NET':(7,3,0)}
NOTE_KEYS={'what_exam_asks','core_ideas','formula_box','method_steps','shortcuts','worked_examples','traps','patterns','prerequisites'}
FUNCTIONS={'F':Fraction,'sqrt':math.sqrt,'factorial':math.factorial,'sum':sum,'range':range,'min':min,'max':max,'round':round}
NODES=(ast.Expression,ast.BinOp,ast.UnaryOp,ast.Add,ast.Sub,ast.Mult,ast.Div,ast.FloorDiv,ast.Mod,ast.Pow,ast.USub,ast.UAdd,ast.Call,ast.Name,ast.Load,ast.Constant,ast.List,ast.Tuple,ast.Compare,ast.Eq,ast.NotEq,ast.Gt,ast.GtE,ast.Lt,ast.LtE,ast.BoolOp,ast.And,ast.Or)

def calculate(expression):
    tree=ast.parse(expression,mode='eval')
    for node in ast.walk(tree):
        if not isinstance(node,NODES):raise ValueError(f'Unsafe expression node {type(node).__name__}')
        if isinstance(node,ast.Name) and node.id not in FUNCTIONS:raise ValueError(f'Unknown function {node.id}')
    return eval(compile(tree,'<quant-check>','eval'),{'__builtins__':{}},FUNCTIONS)

def number(text):
    text=str(text).replace(',','').replace('₹','').replace('%','').strip()
    if ':' in text:
        a,b=text.split(':');return Fraction(a.strip())/Fraction(b.strip())
    return Fraction(text)

def solve_crypt(equation,extra=()):
    words=re.findall(r'[A-Z]+',equation+' '+' '.join(extra));letters=sorted(set(''.join(words)))
    leading={word[0] for word in words if len(word)>1};solutions=[]
    for digits in itertools.permutations(range(10),len(letters)):
        assigned=dict(zip(letters,digits))
        if any(assigned[c]==0 for c in leading):continue
        sub=lambda e:re.sub(r'[A-Z]+',lambda m:str(int(''.join(str(assigned[c]) for c in m[0]))),e)
        if calculate(sub(equation)) and all(calculate(sub(e)) for e in extra):solutions.append(assigned)
    return solutions

def verify_question(q):
    v=q.get('verification',{})
    if v.get('kind')=='expression':
        value=calculate(v['expression']);expected=Fraction(v['expected'])
        assert abs(float(value)-float(expected))<1e-8,'numeric solver mismatch'
        actual=number(q['options'][q['answer']])
        assert abs(float(actual)-float(expected))<1e-8,'answer option disagrees with solver'
        assert sum(abs(float(number(o))-float(expected))<1e-8 for o in q['options'].values())==1,'equivalent distractor duplicates answer'
    elif v.get('kind')=='crypt':
        solutions=solve_crypt(v['equation'],v.get('constraints',[]))
        assert len(solutions)==1,f'{len(solutions)} cryptarithmetic solutions'
        d=solutions[0]
        query=re.sub(r'[A-Z]',lambda m:str(d[m[0]]),v['query'])
        answer=calculate(query)
        assert number(q['options'][q['answer']])==answer,'crypt answer mismatch'
    elif v.get('kind')=='outside-range':
        lo,hi=v['bounds'];outside=[k for k,s in q['options'].items() if not lo<=float(number(s))<=hi]
        assert outside==[q['answer']],'feasibility question has ambiguous options'
    elif v.get('kind')=='odd-expression':
        values={k:calculate(s.replace('×','*').replace('÷','/')) for k,s in q['options'].items()}
        outside=[k for k,value in values.items() if value!=v['target']]
        assert outside==[q['answer']],'odd expression question is ambiguous'
    elif v.get('kind')=='anagram':
        key=lambda text:sorted(re.sub(r'[^a-z]','',text.lower()))
        assert key(v['target'])==key(v['scrambled']),'scramble letters do not match target'
        matches=[letter for letter,option in q['options'].items() if key(option)==key(v['target'])]
        assert matches==[q['answer']],'anagram options do not isolate target'
    elif v.get('kind') in ('manual','constraint','graph','passage','vocabulary','analogy'):
        assert q.get('verify',{}).get('method'),'manual/qualitative item needs a verification method'
    else:
        raise AssertionError('missing executable verification or explicit qualitative review method')

def validate(paths=None):
    paths=paths or sorted((STUDY/'modules').glob('*.json'))
    errors=[];reports=[];all_ids=set();review=[]
    for path in paths:
        pack=json.loads(path.read_text(encoding='utf-8'));mid=pack['module'];local=[]
        cards=pack['cards'];core=pack['mcq_core'];bonus=pack.get('mcq_bonus',[]);qs=core+bonus
        expected=ALLOC[mid]
        if (len(cards),len(core),len(bonus))!=expected:local.append('allocation counts differ')
        card_ids={c['id'] for c in cards};question_ids={q['id'] for q in qs}
        stems=set();fronts=set()
        for item in cards+qs:
            if item['id'] in all_ids:local.append(f'duplicate ID {item["id"]}')
            all_ids.add(item['id'])
            pages=item.get('source_ref',{}).get('pages',[])
            if not pages or any(not 1<=p<=1006 or not (STUDY/'source/text'/f'p{p:04d}.txt').exists() for p in pages):local.append(f'{item["id"]}: invalid source pages')
            if item.get('status') not in ('auto_verified','human_reviewed','approved','needs_review'):local.append(f'{item["id"]}: invalid status')
        for c in cards:
            front=' '.join(c['front'].lower().split())
            if front in fronts:local.append(f'{c["id"]}: duplicate card front')
            fronts.add(front)
            if len(c['front'].split())>25 or len(c['back'].split())>40:local.append(f'{c["id"]}: card word limit')
            if c.get('example_mcq') and c['example_mcq'] not in question_ids:local.append(f'{c["id"]}: missing example')
            if c['type'] in ('F','T') and not all(c.get(key) for key in ('trigger','formula','trap','example_id')):local.append(f'{c["id"]}: incomplete formula/trap card')
        for q in qs:
            stem=' '.join(q['question'].lower().split())
            if stem in stems:local.append(f'{q["id"]}: duplicate question')
            stems.add(stem)
            if len(q['options'])!=4 or len(set(q['options'].values()))!=4 or q['answer'] not in q['options']:local.append(f'{q["id"]}: ambiguous options')
            if not all(q.get('solution',{}).get(k) for k in ('hint','standard')) or not q.get('common_trap'):local.append(f'{q["id"]}: incomplete solution')
            if any(c not in card_ids for c in q.get('related_flashcards',[])):local.append(f'{q["id"]}: missing related card')
            try:verify_question(q)
            except Exception as error:local.append(f'{q["id"]}: {error}')
            if q.get('difficulty')=='hard' or int(q['id'].split('-')[-1])%5==1:review.append({'id':q['id'],'module':mid,'reason':'hard' if q.get('difficulty')=='hard' else 'deterministic 20% sample'})
        note=pack['note']
        if not NOTE_KEYS<=note.keys():local.append('note lacks one of nine required sections')
        examples=[x.get('mcq_id') if isinstance(x,dict) else x for x in note.get('worked_examples',[])]
        if len(examples)<2 or any(i not in question_ids for i in examples):local.append('worked example links do not resolve')
        letters=Counter(q['answer'] for q in core)
        if max(letters.values(),default=0)-min(letters.values(),default=0)>1:local.append('unbalanced main answer letters')
        errors.extend(f'{mid}: {e}' for e in local)
        reports.append({'module':mid,'cards':len(cards),'core':len(core),'bonus':len(bonus),'errors':local,'status':'PASS' if not local else 'FAIL','human_review_pending':pack.get('human_review_required',True)})
        print(mid,'PASS' if not local else 'FAIL',f'{len(cards)} cards {len(core)}+{len(bonus)} MCQs',flush=True)
    (STUDY/'reports').mkdir(exist_ok=True)
    (STUDY/'reports/validation.json').write_text(json.dumps({'modules':reports,'errors':errors,'review_queue':review},indent=2),encoding='utf-8')
    (STUDY/'reports/review_queue.md').write_text('# Human review queue\n\nAll packs remain AI checked (`auto_verified`), not human approved. Review every hard question and the listed deterministic 20% sample. OCR-derived source references also require the source image comparison requested by the spec.\n\n'+'\n'.join(f'- {r["id"]}: {r["reason"]}' for r in review),encoding='utf-8')
    if errors:print('\n'.join(errors))
    return not errors

if __name__=='__main__':
    paths=[STUDY/'modules'/f'{mid}.json' for mid in sys.argv[1:]] if len(sys.argv)>1 else None
    sys.exit(0 if validate(paths) else 1)
