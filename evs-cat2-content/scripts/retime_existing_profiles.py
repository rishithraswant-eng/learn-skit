"""Source-preserving concise profile edits. No speech service or shared config changes."""
import json
import re
from pathlib import Path

EVS=Path(__file__).resolve().parents[1]
ROOT=EVS/'video/scenes/src'

def lite(scene,profile,text,lines):
    field={'full':'narration','sprint':'narration_short','blitz':'narration_blitz'}[profile]
    scene[field]=text
    actions=[]
    for action in scene['actions']:
        if profile in action.get('only',scene['profile']):
            action=dict(action)
            action['only']=[p for p in action.get('only',scene['profile']) if p!=profile]
            if not action['only']:
                continue
        actions.append(action)
    plain=re.sub(r'\[\[pause[^\]]*\]\]','',text).strip()
    sentences=[s.strip() for s in re.split(r'(?<=[.!?])\s+',plain) if s.strip()]
    def anchor(s,n):
        words=s.split()
        return ' '.join(words[:min(n,len(words))])
    actions.append(dict(id=f'{profile}-title',t='write',target='title',text=scene['title'].upper(),style='heading',on_phrase=anchor(sentences[0],4),until_phrase=' '.join(sentences[0].split()[-4:]),only=[profile]))
    for i,line in enumerate(lines):
        sentence=sentences[min(i,len(sentences)-1)]
        actions.append(dict(id=f'{profile}-line{i}',t='write',text=line,style='small',on_phrase=anchor(sentence,4),until_phrase=' '.join(sentence.split()[-4:]),only=[profile]))
    actions.append(dict(id=f'{profile}-star',t='stamp',target=f'{profile}-line0',text='★ recall',on_phrase=' '.join(sentences[0].split()[-4:]),only=[profile]))
    for i,pause in enumerate(re.findall(r'\[\[pause\s+(\d+(?:\.\d+)?)\]\]',text)):
        actions.append(dict(id=f'{profile}-recall{i}',t='recall_beat',seconds=float(pause),prompt='Recall the key distinction',only=[profile]))
    scene['actions']=actions

def recall_profile(scene,profile,prompts):
    field={'full':'narration','sprint':'narration_short','blitz':'narration_blitz'}[profile]
    durations=re.findall(r'\[\[pause\s+(\d+(?:\.\d+)?)\]\]',scene[field])
    assert len(durations)==len(prompts)
    actions=[]
    for action in scene['actions']:
        if action['t']=='recall_beat' and profile in action.get('only',scene['profile']):
            action=dict(action)
            action['only']=[p for p in action.get('only',scene['profile']) if p!=profile]
            if not action['only']:
                continue
        actions.append(action)
    actions += [dict(id=f'{profile}-aligned-recall{i}',t='recall_beat',seconds=float(duration),prompt=prompt,only=[profile]) for i,(duration,prompt) in enumerate(zip(durations,prompts))]
    scene['actions']=actions

SHORT={
'M01':{
'S-M01-01':('Science studies natural systems; studies connects ethical, social, political and economic issues. Engineering designs waste, pollution-control and purification systems. [[pause 2]] Remember the jobs: science understands, studies connects, engineering designs.',['Science understands · studies connects · engineering designs']),
'S-M01-03':('Ten disciplines feed environmental studies: biology, chemistry, physics, geology, geography, economics, political science, sociology, engineering and ethics. Bright Chalk Paints Great Graphs; Every Pupil Studies Every Evening. [[pause 2]]',['Ten disciplines: Biology → Ethics','Bright Chalk Paints Great Graphs; Every Pupil Studies…']),
'S-M01-04':('Climate change involves greenhouse gases and about one point one degrees of warming. Logging causes deforestation; landfill methane is a waste problem. Industry and vehicles cause smog. [[pause 2]] Match the problem to its source.',['Climate ~1.1°C · logging · landfill methane · smog']),
'S-M01-05':('Punjab groundwater: Endosulfan and D-D-T. Ranipet tanneries: chromium. Delhi after Diwali: Severe A-Q-I. India is third-largest in e-waste, over one million tonnes yearly; EPR is the policy response. [[pause 2]]',['Punjab pesticides · Ranipet chromium','Delhi Diwali AQI · India e-waste: 3rd, >1 million t']),
'S-M01-06':('Global figures: one million species at risk; eight million tons of ocean plastic yearly; ninety-nine percent breathe unsafe air; fifty-three million metric tons of e-waste. India: fourteen of twenty polluted cities, seventy percent polluted surface water, and seventh in climate risk. [[pause 2]]',['Global: 1 million species · 8 million t ocean plastic','99% unsafe air · 53 million t e-waste','India: 14/20 cities · 70% water · climate rank 7'])},
'M02':{
'S-M02-01':('Atmosphere gives air, hydrosphere water, biosphere food, and lithosphere ground and nutrients. Air contains seventy-eight percent nitrogen and twenty-one percent oxygen; other gases occupy the remaining one percent. [[pause 2]]',['Atmosphere · hydrosphere · biosphere · lithosphere','Air: N₂ 78% · O₂ 21% · other 1%']),
'S-M02-02':('Bottom to top: troposphere, stratosphere, mesosphere, thermosphere and exosphere. Weather belongs to the troposphere; ozone to the stratosphere. The mesosphere is coldest; thermosphere has auroras. Tall Students Must Think Everyday. [[pause 2]]',['Tropo → strato → meso → thermo → exo','Weather / ozone / coldest / auroras']),
'S-M02-03':('Temperature falls in the troposphere, rises in the ozone-rich stratosphere, falls in the mesosphere, then rises in the thermosphere. Meteors burn in the mesosphere; auroras occur in the thermosphere. [[pause 2]]',['Temperature pattern: ↓ ↑ ↓ ↑','Mesosphere: meteors · thermosphere: auroras']),
'S-M02-04':('Hydrosphere means all water: liquid, ice and vapour. Around ninety-seven percent is ocean water. This lecture says one percent usable freshwater; other lectures give two point five or three percent freshwater. Confirm the source distinction. [[pause 2]]',['All water: liquid · ice · vapour','Ocean ~97%; usable 1% vs fresh 2.5–3%: verify']),
'S-M02-06':('Inner core: solid iron and nickel. Outer core: liquid and associated with the magnetic field. Mantle convection drives plate tectonics; crust is outermost. Igneous, sedimentary and metamorphic are the three rock types. [[pause 2]]',['Inner solid · outer liquid · mantle convection · crust','Rocks: igneous · sedimentary · metamorphic']),
'S-M02-07':('Biosphere means the global sum of ecosystems. Producers, consumers and decomposers interact. Volcanic gases connect solid Earth and air; erosion connects water and rock; roots connect life and rock. [[pause 2]]',['Biosphere: all ecosystems; producers → consumers → recyclers','Spheres interact: volcanoes · erosion · roots'])},
'M05':{
'S-M05-02':('Kyoto was adopted on eleven December nineteen ninety-seven at C-O-P three. It entered into force on sixteen February two thousand five. The first commitment period was two thousand eight to two thousand twelve. [[pause 2]] Adoption, legal force and the commitment period are three different dates.',['Kyoto: adopted 1997 · in force 2005 · first period 2008–12']),
'S-M05-03':('Annex One comprised thirty-seven industrialised nations with binding targets. Non-Annex One countries, including India, had no binding targets. The group target was at least five percent below nineteen ninety levels. Six gases include carbon dioxide, methane, nitrous oxide, HFCs, PFCs and sulphur hexafluoride. [[pause 2]]',['Annex I: 37 nations, binding; Non-Annex I: no targets','Group ≥5% below 1990; six greenhouse gases']),
'S-M05-04':('Kyoto has three mechanisms: Emissions Trading, Joint Implementation and the Clean Development Mechanism. Joint Implementation links Annex One countries; CDM funds a developing-country project and earns Certified Emission Reductions. India ratified Kyoto in August two thousand two and became a major CDM host. [[pause 2]]',['ET · JI: Annex I ↔ Annex I · CDM: developing host','India ratified: August 2002; CERs from CDM']),
'S-M05-06':('Paris was adopted by one hundred ninety-six parties at C-O-P twenty-one in December twenty fifteen. It entered into force on four November twenty sixteen. Article Two calls for well below two degrees warming, pursuing one point five. [[pause 2]] Keep adoption and entry into force separate.',['Paris: COP21 · 196 parties · 2015 / 4 Nov 2016','Article 2: well below 2°C; pursue 1.5°C']),
'S-M05-07':('Paris uses bottom-up NDCs, renewed every five years with greater ambition. India targets fifty percent non-fossil installed capacity by twenty thirty, a forty-five percent reduction in GDP emissions intensity from two thousand five, and an extra carbon sink of two point five to three billion tonnes. [[pause 2]]',['NDCs: bottom-up, every 5 years, increasing ambition','India: 50% capacity · 45% intensity cut · 2.5–3 bn t sink']),
'S-M05-08':('Paris Article Four places net-zero in the second half of the century. The IPCC twenty fifty figure is a different source. Article Seven concerns adaptation; Article Nine concerns finance, including one hundred billion dollars yearly through the Green Climate Fund. [[pause 2]] Two, four, seven, nine: temperature, net-zero, adaptation, finance.',['Paris 4: net-zero; distinguish IPCC 2050','Article 7 adaptation · Article 9 finance: $100 bn/year']),
'S-M05-10':('Kyoto assigns top-down targets binding on Annex One. Paris uses bottom-up NDCs from every country. Kyoto dates are nineteen ninety-seven and two thousand five; Paris dates are twenty fifteen and twenty sixteen. [[pause 2]] Name the treaty before choosing the date or target system.',['Kyoto: top-down, Annex I · Paris: bottom-up, all','Kyoto 1997/2005 · Paris 2015/2016'])},
'M06':{
'S-M06-01':('Sustainable development meets present needs without undermining future generations. Development and environmental protection support one another. [[pause 2]]',['Present needs + future generations']),
'S-M06-02':('Johannesburg produced its implementation plan. The goals were agreed in September twenty fifteen, at the United Nations in New York. [[pause 2]]',['JPOI → SDGs; September 2015, New York']),
'S-M06-03':('Goals one through six: poverty, hunger, health, education, gender equality, and water with sanitation. Water is goal six. [[pause 2]]',['1 Poverty · 2 Hunger · 3 Health','4 Education · 5 Gender · 6 Water']),
'S-M06-04':('Seven: energy. Eight: work and growth. Nine: industry and infrastructure. Ten: inequalities. Eleven: cities. Twelve: consumption and production. [[pause 2]]',['7 Energy · 8 Work · 9 Industry','10 Inequality · 11 Cities · 12 Consumption']),
'S-M06-05':('Thirteen: climate. Fourteen: oceans. Fifteen: land. Sixteen: peace and justice. Seventeen: partnership. Distinguish sea, fourteen, from land, fifteen. [[pause 2]]',['13 Climate · 14 Sea · 15 Land','16 Peace · 17 Partnership']),
'S-M06-06':('Hydroelectric and geothermal projects link goals seven, nine, eleven and thirteen. Water conservation links goal six and the twenty thirty target. [[pause 2]]',['Hydro/geothermal: 7 · 9 · 11 · 13','Water conservation: SDG 6; 2030']),
'S-M06-08':('Recall four chunks: people, economy, planet, then peace and partnership. Use the goal number to distinguish related topics. [[pause 2]]',['People → economy → planet → peace/partnership'])},
'M10':{
'S-M10-01':('An ecosystem contains living communities and non-living surroundings, exchanging energy and matter. Terrestrial examples include forest, grassland, tundra and desert; aquatic examples include freshwater and marine systems. Organism, population, community and ecosystem increase in scale; all ecosystems form the biosphere. [[pause 2]]',['Ecosystem = living + non-living interactions','Organism → population → community → ecosystem → biosphere']),
'S-M10-03':('Trophic levels describe feeding steps. Producers are first, followed by primary, secondary and tertiary consumers. The notes use grass, grasshopper, frog, snake and eagle. A food web connects chains and allows predators to switch prey. The frog eats the herbivore in this example. [[pause 2]]',['Producer → primary → secondary → tertiary consumers','Food web = connected chains; alternative prey']),
'S-M10-04':('Elton proposed ecological pyramids in nineteen twenty-seven. Numbers can invert around a tree, and marine biomass can invert. The energy pyramid stays upright because only about ten percent passes upward. Remember numbers, biomass and energy as distinct measurements. [[pause 2]]',['Elton 1927: numbers · biomass · energy','Energy always upright; only ~10% moves upward']),
'S-M10-05':('Photosynthesis uses carbon dioxide, water and light to produce glucose and oxygen. N-P-P equals G-P-P minus respiration; N-P-P is available to consumers. Lindemann\'s nineteen forty-two law transfers about ten percent upward; roughly ninety percent is lost, mainly as heat. [[pause 2]]',['NPP = GPP − respiration; available to consumers','Lindemann 1942: ~10% transferred; ~90% lost']),
'S-M10-06':('Energy flows one way, while matter cycles. Water evaporates, condenses, precipitates, and infiltrates or runs off. Carbon moves through photosynthesis, food chains, respiration, decomposition and combustion. Oceans absorb about thirty percent of human carbon dioxide. Keep energy flow separate from nutrient recycling. [[pause 2]]',['Energy one-way; matter cycles','Water: evaporate → condense → rain → infiltration/runoff','Carbon: photosynthesis ↔ respiration; oceans ~30%']),
'S-M10-07':('Nitrogen fixation involves Rhizobium and Azotobacter; nitrification uses Nitrosomonas and Nitrobacter. Plants assimilate nitrogen, decomposers ammonify it, and Pseudomonas denitrifies it. Phosphorus has no atmospheric phase and is often limiting in freshwater. Recall the process before matching its organism. [[pause 2]]',['Fix → nitrify → assimilate → ammonify → denitrify','Phosphorus: no atmospheric phase; freshwater limitation']),
'S-M10-09':('Primary succession begins without soil, on bare rock, and takes around a thousand years. Secondary succession retains soil after disturbance and takes fifty to two hundred years. The stages are nudation, invasion, competition and climax. A burned forest with soil remaining follows secondary succession. [[pause 2]]',['Primary: no soil, ~1000 years','Secondary: soil remains, ~50–200 years','Nudation → invasion → competition → climax'])},
'M13':{
'S-M13-01':('A GM crop has DNA altered through genetic engineering to add a desired trait. Conventional breeding crosses plants over generations, while genetic modification can introduce a chosen gene from an unrelated species. Benefits described include pest resistance, yield and environmental-stress tolerance. [[pause 2]]',['GM: altered DNA → desired trait','Conventional crossing ≠ targeted gene introduction']),
'S-M13-03':('GEAC means Genetic Engineering Appraisal Committee. According to the notes, Bt cotton was introduced commercially in two thousand two against bollworm. GM brinjal received approval in two thousand nine followed by a moratorium; it is not grown commercially in this account. [[pause 2]]',['GEAC: Genetic Engineering Appraisal Committee','Bt cotton 2002 approved · brinjal: moratorium']),
'S-M13-04':('In Maharashtra, Bt cotton occupied over ninety percent of cotton area by twenty ten. Pesticide savings were twenty-five to fifty percent, but resistance, secondary pests and costly seed created problems. Drought and poor irrigation affected rainfed Vidarbha yields. [[pause 2]]',['Maharashtra 2010: >90% Bt cotton; pesticides −25–50%','Risks: resistance · secondary pests · cost · drought'])},
'M15':{
'S-M15-01':('Safe-water figures in the notes: p-H six point five to eight point five; turbidity below one N-T-U; dissolved solids below five hundred milligrams per litre; zero E coli. [[pause 2]]',['pH 6.5–8.5 · turbidity <1 NTU · TDS <500 mg/L']),
'S-M15-03':('Nitrates cause Blue Baby Syndrome. In eutrophication, excess nutrients feed algae; decomposition then consumes oxygen and creates a hypoxic dead zone. Biomagnification increases pollutant concentration along a food chain. [[pause 2]] Distinguish oxygen depletion from concentration increase.',['Nitrates → Blue Baby Syndrome','Eutrophication: nutrients → algae → low O₂','Biomagnification: concentration increases up food chain']),
'S-M15-04':('Primary sewage treatment is physical, removing about sixty percent of suspended solids and thirty percent of BOD. Secondary treatment is biological and removes eighty-five to ninety-five percent of BOD. Tertiary treatment uses advanced nutrient removal and disinfection. [[pause 2]]',['Primary physical · secondary biological · tertiary advanced','Primary: ~60% SS, ~30% BOD; secondary: 85–95% BOD']),
'S-M15-05':('The Water Act nineteen seventy-four created Pollution Control Boards. EPA nineteen eighty-six is umbrella legislation. Minamata in nineteen fifty-six involved methylmercury accumulating in fish; the Minamata Convention followed in twenty thirteen. [[pause 2]]',['Water Act 1974 · EPA 1986','Minamata 1956 → mercury Convention 2013']),
'S-M15-06':('A-Q-I colours progress green, yellow, orange, red, purple and maroon. Boundaries are fifty, one hundred, two hundred, three hundred, four hundred and five hundred. The notes label both orange and red unhealthy. Good Yogis Often Run Past Midnight recalls the colours. [[pause 2]]',['AQI: green → yellow → orange → red → purple → maroon','Bounds: 50 · 100 · 200 · 300 · 400 · 500']),
'S-M15-07':('Primary pollutants are emitted directly. Carbon monoxide binds haemoglobin two hundred times more strongly than oxygen. Secondary pollutants form in air: nitrogen oxides, V-O-Cs and sunlight produce ground-level ozone. P-A-N and acid droplets are secondary examples. [[pause 2]]',['Primary emitted · secondary formed in air','CO binds Hb 200×; NOₓ + VOCs + sunlight → O₃']),
'S-M15-09':('B-S six arrived in twenty twenty, matching Euro six. NCAP began in twenty nineteen, targeting twenty to thirty percent particulate reduction by twenty twenty-four in one hundred twenty-two cities. London\'s nineteen fifty-two smog preceded its nineteen fifty-six Clean Air Act. [[pause 2]]',['BS-VI 2020 · NCAP 2019: −20–30%, 122 cities','London smog 1952 → Clean Air Act 1956']),
'S-M15-10':('Soil pollution includes xenobiotic, or human-made, chemicals. Construction is a major urban source; excess chemical fertiliser harms useful microbes. [[pause 2]] Match the pollutant source with the affected soil process.',['Xenobiotic = human-made; excess fertiliser harms microbes']),
'S-M15-12':('Thermal pollution changes natural water temperature through human activity. Plants can return river water at forty to fifty degrees after taking it at twenty to twenty-five. Cooling ponds, cooling towers and closed-loop systems reduce this impact. [[pause 2]]',['Thermal: human-caused temperature change','River 20–25°C → return 40–50°C; cool before discharge'])},
'M16':{
'S-M16-01':('Only about two point five percent of Earth\'s water is fresh; ninety-seven point five percent is saline. Agriculture accounts for seventy percent of freshwater withdrawals. Other lecture pages use a three percent freshwater figure, so name the source. [[pause 2]]',['Fresh ~2.5%, saline 97.5%; source conflict ~3%','Agriculture: ~70% of freshwater withdrawals']),
'S-M16-02':('Drip irrigation targets plant roots and uses fifty percent less water in the Rajasthan example. SRI cuts paddy water use by thirty percent. Israel recycles eighty-five percent of treated wastewater for crop irrigation. [[pause 2]]',['Drip: 50% less · SRI: −30% · Israel reuse: 85%']),
'S-M16-03':('India\'s National Water Policy began in nineteen eighty-seven, with updates in two thousand two and two thousand twelve. Jal Shakti Abhiyan launched in twenty nineteen. SDG six targets clean water and sanitation by twenty thirty. Keep policy versions separate from programme launches. [[pause 2]]',['Water Policy: 1987 / 2002 / 2012','Jal Shakti 2019 · SDG 6 → 2030'])}
}

EXERCISES={
'M01':{
'S-M01-01':'The same pollution problem can require natural science, social decisions and an engineering solution.',
'S-M01-03':'The subject combines these perspectives instead of limiting environmental problems to a single discipline.',
'S-M01-06':'Ten percent of Indian flora and fauna are at risk. Keep global totals separate from Indian ranks.'},
'M02':{
'S-M02-01':'All Have Bread Lately recalls these four spheres in the stated order.',
'S-M02-04':'Freshwater share and freshwater available for human use are different quantities.'},
'M06':{
'S-M06-01':'The lecture treats development and environmental protection as complementary rather than opposing objectives.',
'S-M06-02':'The earlier promise appeared in The Future We Want in twenty twelve.',
'S-M06-08':'Water six, energy seven, climate thirteen, oceans fourteen, land fifteen.'},
'M10':{
'S-M10-01':'Exchanging energy and matter is essential; a list of organisms without their interactions is incomplete.',
'S-M10-03':'The frog is a secondary consumer, while the grasshopper is the primary consumer. Trace the arrows from food to feeder.',
'S-M10-04':'An inverted biomass diagram does not create energy, and a large tree can support many smaller consumers.',
'S-M10-05':'Distinguish the energy available to the next level from the amount lost during metabolism.',
'S-M10-06':'Decomposition returns material to circulation, but energy dissipated as heat is not recycled through the food chain.',
'S-M10-07':'Fixation brings usable nitrogen into the cycle, while denitrification returns nitrogen to the atmosphere.',
'S-M10-09':"Clemens' monoclimax and Tansley's polyclimax are distinct theories. Retained soil is the quickest test for secondary succession."},
'M13':{
'S-M13-01':'A desired trait does not mean every possible environmental or farming risk disappears.',
'S-M13-03':'Separate approval, a moratorium and actual commercial cultivation.'},
'M15':{
'S-M15-01':'The unit matters: turbidity uses N-T-U, while dissolved solids use milligrams per litre.',
'S-M15-03':'The former is a nutrient-and-oxygen process; the latter follows pollutants through successive feeding levels.',
'S-M15-04':'Distinguish suspended-solid removal in the first stage from biological oxygen-demand removal in the second.',
'S-M15-06':'Green is the first band, maroon the last; unhealthy describes two intermediate bands in the lecture.',
'S-M15-07':'Ground-level ozone forms secondarily; distinguish it from an emitted primary pollutant.',
'S-M15-10':'Prevention requires controlling the source rather than assuming every soil change is naturally occurring.'}
}
for module,scenes in EXERCISES.items():
    for scene_id,exercise in scenes.items():
        text,lines=SHORT[module][scene_id]
        SHORT[module][scene_id]=(text+' '+exercise,lines)

for module,updates in SHORT.items():
    file=ROOT/f'{module}.json'
    scenes=json.loads(file.read_text(encoding='utf-8'))
    for scene in scenes:
        if scene['id'] in updates:
            if module=='M16' and 'sprint' not in scene['profile']:
                scene['profile'].append('sprint')
            lite(scene,'sprint',*updates[scene['id']])
    file.write_text(json.dumps(scenes,ensure_ascii=False,indent=1),encoding='utf-8')

# Enrich short full chapters with an actual retrieval exercise, not empty silence.
file=ROOT/'M07.json'
scenes=json.loads(file.read_text(encoding='utf-8'))
scene=scenes[-1]
addition=' Before leaving, test the order of an engineering response. Start with a product or process and examine its whole life cycle, rather than only the factory stage. Use activity data and an emissions factor to estimate the footprint in carbon dioxide equivalent. Then identify a direct reduction, such as using less energy or changing its source. [[pause 3]] Only after considering reductions should an unavoidable remainder lead to an offset. The key distinction is between reducing the emissions of the activity itself and supporting equivalent reductions elsewhere. Both may feature in a plan, but an offset does not cancel the need to cut emissions first. [[pause 3]]'
if 'Before leaving, test the order' not in scene['narration']:
    scene['narration']+=addition
    scene['actions'] += [dict(id='decision-recall1',t='recall_beat',seconds=3,prompt='Measure, cut or offset: which comes first?',only=['full']),dict(id='decision-recall2',t='recall_beat',seconds=3,prompt='Can an offset replace direct reductions?',only=['full'])]
recall_profile(scene,'full',['Name two footprint standards','Largest global emissions sector?','Name a direct reduction','Can offsets replace cuts?','Measure or offset first?','Direct reduction versus offset: explain'])
file.write_text(json.dumps(scenes,ensure_ascii=False,indent=1),encoding='utf-8')

file=ROOT/'M16.json'
scenes=json.loads(file.read_text(encoding='utf-8'))
scene=scenes[-1]
addition=' Read a policy question carefully: it may ask about the first policy, a later revision, or a campaign launch. These are different events. Identify that event before matching a year, and keep the international water-and-sanitation goal separate from the national policy timeline. [[pause 3]]'
if 'Read a policy question carefully' not in scene['narration']:
    scene['narration']+=addition
    scene['actions'].append(dict(id='policy-recall',t='recall_beat',seconds=3,prompt='Policy adoption, revision, or campaign launch?',only=['full']))
recall_profile(scene,'full',['First policy and revision years?','When did Jal Shakti Abhiyan launch?','Which global goal and target?','Policy adoption, revision or campaign launch?'])
lite(scene,'blitz',"Recall India's National Water Policy: nineteen eighty-seven, two thousand two, and twenty twelve. Jal Shakti Abhiyan launched in twenty nineteen. United Nations SDG six targets clean water and sanitation by twenty thirty. [[pause 2]] The first three dates are policy versions; the campaign and the global goal are different events. Name the event before selecting its year. [[pause 2]]",['Water Policy 1987 / 2002 / 2012','Jal Shakti 2019 · SDG 6 → 2030'])
file.write_text(json.dumps(scenes,ensure_ascii=False,indent=1),encoding='utf-8')

file=ROOT/'M12.json'
scenes=json.loads(file.read_text(encoding='utf-8'))
scene=next(s for s in scenes if 'blitz' in s['profile'])
lite(scene,'blitz','Recall the conservation dates. Wildlife Protection Act: nineteen seventy-two. Biological Diversity Act: two thousand two. Convention on Biological Diversity: nineteen ninety-two. Project Tiger: nineteen seventy-three. Project Elephant: nineteen ninety-two. [[pause 2]] Tiger and elephant have different launch years; the international convention shares the elephant year. Keep each name attached to its date. [[pause 2]]',['WPA 1972 · BDA 2002 · CBD 1992','Project Tiger 1973 · Project Elephant 1992'])
file.write_text(json.dumps(scenes,ensure_ascii=False,indent=1),encoding='utf-8')
print('Updated source-preserving duration-review profiles; exact TTS checks remain central.')
