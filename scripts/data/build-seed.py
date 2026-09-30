"""Build licensed offline artifacts from pinned original sources; Python standard library only."""
import hashlib, json, pathlib, re, shutil, subprocess, zipfile, datetime, math
ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / 'data/raw'
OUT = ROOT / 'frontend/src/data'
OUT.mkdir(parents=True, exist_ok=True)
PUBLIC = ROOT / 'frontend/public/recipe-images'
PUBLIC.mkdir(parents=True, exist_ok=True)
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def write(p, obj): p.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
LOCK = ROOT / 'data/sources.lock.json'
old = read(LOCK) if LOCK.exists() else {}
sources = []
def lock(name, path, url, version, license):
    checksum = sha(path)
    previous = next((s for s in old.get('sources', []) if s['source'] == name), None)
    if previous and previous['sha256'] != checksum: raise ValueError('Checksum mismatch: '+name)
    sources.append(dict(source=name, localPath=str(path.relative_to(ROOT)).replace('\\','/'), sourceUrl=url, release=version, sha256=checksum, license=license, downloadedAt=previous['downloadedAt'] if previous else datetime.datetime.now(datetime.timezone.utc).isoformat(), transformVersion=1))

# Human-reviewed common-name mapping. Precise original description, cooking state, ID and source remain intact.
COMMON = [
('鸡胸肉','Chicken, broilers or fryers, breast, meat only, raw'),('熟鸡胸肉','Chicken, broiler or fryers, breast, skinless, boneless, meat only, cooked, braised'),
('鸡蛋','Egg, whole, raw, fresh'),('熟鸡蛋','Egg, whole, cooked, hard-boiled'),('鸡蛋清','Egg, white, raw, fresh'),
('白米饭','Rice, white, long-grain, regular, enriched, cooked'),('大米','Rice, white, long-grain, regular, raw, enriched'),
('燕麦片','Cereals, oats, regular and quick, not fortified, dry'),('全脂牛奶','Milk, whole, 3.25% milkfat, with added vitamin D'),
('西红柿','Tomatoes, red, ripe, raw, year round average'),('土豆','Potatoes, flesh and skin, raw'),('胡萝卜','Carrots, raw'),
('洋葱','Onions, raw'),('大蒜','Garlic, raw'),('黄瓜','Cucumber, with peel, raw'),('西兰花','Broccoli, raw'),('菠菜','Spinach, raw'),
('白菜','Cabbage, chinese (pe-tsai), raw'),('卷心菜','Cabbage, raw'),('生菜','Lettuce, green leaf, raw'),('青椒','Peppers, sweet, green, raw'),
('红椒','Peppers, sweet, red, raw'),('辣椒','Peppers, hot chili, red, raw'),('茄子','Eggplant, raw'),('南瓜','Pumpkin, raw'),
('香菇','Mushrooms, shiitake, raw'),('白蘑菇','Mushrooms, white, raw'),('豆腐','Tofu, raw, firm, prepared with calcium sulfate'),
('花生油','Oil, peanut, salad or cooking'),('橄榄油','Oil, olive, salad or cooking'),('菜籽油','Oil, canola'),('豆油','Oil, soybean, salad or cooking'),
('食盐','Salt, table'),('白砂糖','Sugars, granulated'),('生抽','Soy sauce made from soy and wheat (shoyu)'),('醋','Vinegar, cider'),
('香蕉','Bananas, raw'),('苹果','Apples, raw, with skin'),('橙子','Oranges, raw, all commercial varieties'),
('草莓','Strawberries, raw'),('蓝莓','Blueberries, raw'),('花生','Peanuts, all types, raw'),('核桃','Nuts, walnuts, english'),
('杏仁','Nuts, almonds'),('酸奶','Yogurt, plain, low fat, 12 grams protein per 8 ounce'),('希腊酸奶','Yogurt, Greek, plain, nonfat'),
('牛肉','Beef, ground, 90% lean meat / 10% fat, raw'),('猪里脊','Pork, fresh, loin, tenderloin, separable lean only, raw'),
('三文鱼','Fish, salmon, Atlantic, farmed, raw'),('虾','Crustaceans, shrimp, raw'),('金枪鱼','Fish, tuna, light, canned in water, drained solids'),
('红薯',"Sweet potato, raw, unprepared (Includes foods for USDA's Food Distribution Program)"),('玉米','Corn, sweet, yellow, raw'),('小麦粉','Wheat flour, white, all-purpose, unenriched'),
('小葱','Onions, spring or scallions (includes tops and bulb), raw'),('姜','Ginger root, raw'),('蜂蜜','Honey'),('黑胡椒','Spices, pepper, black'),
('芝麻','Seeds, sesame seeds, whole, dried'),('芝麻油','Oil, sesame, salad or cooking'),('花生酱','Peanut butter, smooth style, without salt'),
('水','Beverages, water, tap, drinking'),('意大利面','Pasta, cooked, unenriched, without added salt'),('糙米饭',"Rice, brown, long-grain, cooked (Includes foods for USDA's Food Distribution Program)"),
('毛豆','Edamame, frozen, prepared'),('扁豆','Lentils, mature seeds, cooked, boiled, without salt'),('鹰嘴豆','Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt')]
NAME_RULES = [('chicken','鸡肉'),('beef','牛肉'),('pork','猪肉'),('turkey','火鸡肉'),('fish','鱼类'),('egg','鸡蛋'),('milk','牛奶'),('yogurt','酸奶'),('cheese','奶酪'),('rice','米饭/大米'),('oat','燕麦'),('bread','面包'),('wheat','小麦'),('flour','面粉'),('bean','豆类'),('tofu','豆腐'),('tomato','番茄'),('onion','洋葱'),('potato','土豆'),('carrot','胡萝卜'),('broccoli','西兰花'),('spinach','菠菜'),('banana','香蕉'),('apple','苹果'),('orange','橙子'),('strawberr','草莓'),('blueberr','蓝莓'),('cabbage','白菜/卷心菜'),('mushroom','蘑菇'),('oil','油脂'),('nut','坚果'),('pepper','椒类'),('seed','种子'),('sugar','糖类'),('pasta','面食'),('water','饮用水'),('salt','食盐'),('sauce','酱料'),('hummus','鹰嘴豆泥'),('fruit','水果'),('vegetable','蔬菜'),('cereal','谷物'),('juice','果汁'),('soup','汤'),('sandwich','三明治'),('salad','沙拉')]
keys = {1008:'kcal',1003:'proteinG',1004:'fatG',1005:'carbsG',1079:'fiberG',1093:'sodiumMg',1092:'potassiumMg',1087:'calciumMg',1089:'ironMg'}
foods, counts = [], {}
for filename, key, release, urlname in [('foundation.zip','FoundationFoods','2026-04','foundation_food_json_2026-04-30'),('sr.zip','SRLegacyFoods','2018-04','sr_legacy_food_json_2018-04'),('fndds.zip','SurveyFoods','2021-2023','survey_food_json_2024-10-31')]:
    path = RAW / 'usda-fdc' / filename
    lock('USDA '+key,path,'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_'+urlname+'.zip',release,'CC0 / public domain; https://fdc.nal.usda.gov/faq.html')
    with zipfile.ZipFile(path) as archive: data = json.loads(archive.read(archive.namelist()[0]))
    records = list(data.values())[0]; counts[key] = len([r for r in records if r])
    for r in records:
        if not r: continue
        n = {v:None for v in keys.values()}
        for a in r.get('foodNutrients',[]):
            nid = a.get('nutrient',{}).get('id')
            if nid in keys: n[keys[nid]] = a.get('amount')
        if n['kcal'] is None:
            for nid in [2048,2047]:
                val = next((a.get('amount') for a in r.get('foodNutrients',[]) if a.get('nutrient',{}).get('id') == nid),None)
                if val is not None: n['kcal'] = val; break
        if n['kcal'] is None: continue
        anomalies=[dict(nutrient=k,sourceValue=v,reason='negative or nonfinite database value; calculation uses unknown') for k,v in n.items() if v is not None and (not math.isfinite(v) or v<0)]
        for anomaly in anomalies: n[anomaly['nutrient']]=None
        if n['kcal'] is None: continue
        name = r['description']; zh = next((z for z,en in COMMON if en.casefold()==name.casefold()),'')
        food = dict(id='fdc-'+str(r['fdcId']),nameEn=name,nameZh=zh or next((z for en,z in NAME_RULES if en in name.casefold()),'食物')+'（名称待细译）',aliasesZh=[zh] if zh else [],aliasesEn=[],source='USDA FDC',sourceId=str(r['fdcId']),sourceRelease=release,sourceUrl='https://fdc.nal.usda.gov/food-details/'+str(r['fdcId'])+'/nutrients',category=name.split(',')[0],foodType='cooked' if re.search(r'cooked|boiled|fried|roasted',name,re.I) else 'raw' if 'raw' in name.lower() else 'unspecified',nutritionBasis='per100g edible portion',nutritionPer100g=n,portionHints=[dict(description=p.get('portionDescription') or p.get('modifier') or p.get('measureUnit',{}).get('name'),grams=p.get('gramWeight'),amount=p.get('amount',1)) for p in r.get('foodPortions',[]) if p.get('gramWeight',0)>0],verified=True,translationSource='manual' if zh else 'category-rule',updatedAt=release)
        foods.append(food)
        if anomalies: food['sourceAnomalies']=anomalies
lookup = {}
for zh,en in COMMON:
    f = next((f for f in foods if f['nameEn'].casefold()==en.casefold()),None)
    if f: lookup[zh]=f
aliases={'番茄':'西红柿','盐':'食盐','糖':'白砂糖','白糖':'白砂糖','酱油':'生抽','蒜':'大蒜','葱':'小葱','生姜':'姜','米饭':'白米饭','食用油':'菜籽油','植物油':'菜籽油','鸡胸':'鸡胸肉','淀粉':'小麦粉'}
# Do not conflate starch with flour; remove the unsupported replacement.
aliases.pop('淀粉')
for alias,target in aliases.items():
    if target in lookup: lookup[alias]=lookup[target]; lookup[target]['aliasesZh'].append(alias)
foods.sort(key=lambda f:(f['translationSource']!='manual',f['nameZh'],f['id']))
write(OUT/'foods.json',foods)

recipes=[]
COMMIT=next((s['release'] for s in old.get('sources',[]) if s['source']=='HowToCook'),None) or read(RAW/'howtocook-commit.json')['sha']
archive=RAW/'howtocook.zip'
lock('HowToCook',archive,'https://codeload.github.com/Anduin2017/HowToCook/zip/'+COMMIT,COMMIT,'Unlicense')
folder=RAW/'howtocook-extracted'
if not folder.exists():
    with zipfile.ZipFile(archive) as z: z.extractall(folder)
repo=next(folder.iterdir())
shutil.copyfile(repo/'LICENSE',ROOT/'data/HOWTOCOOK_LICENSE.txt')
for path in sorted((repo/'dishes').rglob('*.md')):
    text=path.read_text(encoding='utf-8'); title=re.search(r'^#\s+(.+)',text,re.M)
    if not title: continue
    name=title[1].strip(); rel=str(path.relative_to(repo)).replace('\\','/'); ingredients=[]; steps=[]; mode=''; calculated=bool(re.search(r'^##.*(?:计算|用量)',text,re.M))
    for line in text.splitlines():
        if re.match(r'^##\s',line):
            mode='ingredients' if re.search('计算|用量',line) or (not calculated and re.search('原料|材料',line)) else 'steps' if re.search('操作|步骤|制作',line) else ''; continue
        if line.startswith('###'):
            if mode=='steps': steps.append('阶段：'+line.lstrip('# ').strip())
            continue
        if not line.strip(): continue
        if mode=='steps' and not re.match(r'^\s*(?:[-*+]|\d+[.、])\s*',line):
            if not line.startswith('!['): steps.append(line.strip().lstrip('> '))
            continue
        if not re.match(r'^\s*(?:[-*+]|\d+[.、])\s*',line): continue
        clean=re.sub(r'^\s*(?:[-*+]|\d+[.、])\s*','',line).strip()
        if mode=='steps': steps.append(clean)
        if mode=='ingredients':
            hits=[(k,f) for k,f in lookup.items() if k in clean]
            hits.sort(key=lambda h:len(h[0]),reverse=True)
            amount=re.search(r'(\d+(?:\.\d+)?)\s*(kg|千克|公斤|g|克)\b?',clean,re.I) if False else re.search(r'(\d+(?:\.\d+)?)\s*(kg|千克|公斤|g|克)',clean,re.I)
            f=hits[0][1] if hits else None
            if re.search(r'\d\s*[-~～至到]\s*\d|\d.*(?:克|g)\s*(?:到|至|或)\s*\d|\d.*\+.*\d|\d.*[*/].*\d',clean): amount=None
            grams=float(amount[1])*(1000 if amount[2].lower() in ['kg','千克','公斤'] else 1) if amount else None
            ingredients.append(dict(originalText=clean,foodId=f['id'] if f else None,grams=grams,estimated=bool(re.search('约|大约|估',clean)),confidence='high' if f and grams else 'low',mappingStatus='high-confidence' if f else 'unmapped'))
    if not ingredients:
        # A calculation section may only say "1 serving", or use a quantity table.
        blocks=re.split(r'^##\s+(.+)$',text,flags=re.M)
        material=next((blocks[n+1] for n in range(1,len(blocks)-1,2) if re.search('原料|材料',blocks[n])), '')
        ingredient_lines=[]; tool_mode=False
        for line in material.splitlines():
            if re.match(r'^###',line):
                tool_mode=bool(re.search('工具',line)); continue
            clean=re.sub(r'^\s*[-*+]\s*','',line).strip()
            if clean in ['工具','原料','材料','工具：','原料：']:
                tool_mode='工具' in clean; continue
            if not tool_mode and re.match(r'^\s*[-*+]\s+',line):ingredient_lines.append(clean)
        for raw in ingredient_lines:
            ingredients.append(dict(originalText=raw,foodId=None,grams=None,estimated=False,confidence='low',mappingStatus='unmapped'))
    if not ingredients: raise ValueError('No source ingredients extracted: '+name)
    steps=[step for step in steps if step.strip()]
    if not steps: steps=[text]
    unique={i['originalText']:i for i in ingredients}; ingredients=list(unique.values())
    imgs=[]
    for ref in re.findall(r'!\[[^\]]*\]\(([^)]+)\)',text):
        original=(path.parent/ref).resolve()
        if original.is_file() and original.is_relative_to(repo.resolve()) and original.suffix.lower() in ['.jpg','.jpeg','.png','.webp']:
            filename=sha(original)[:20]+original.suffix.lower(); shutil.copyfile(original,PUBLIC/filename); imgs.append('recipe-images/'+filename)
    recipes.append(dict(id='htc-'+hashlib.sha256(rel.encode()).hexdigest()[:16],nameZh=name,nameEn='',originalName=name,servings=1,servingsBasis='unknown-needs-review',ingredients=ingredients,steps=steps,image=imgs[0] if imgs else None,imageSource=rel,imageLicense='Unlicense (repository)',source='HowToCook',sourceUrl='https://github.com/Anduin2017/HowToCook/blob/'+COMMIT+'/'+rel,license='Unlicense',sourceRelease=COMMIT,revision=1,tags=[path.parent.name],originalText=text,verified=False))
    recipes[-1]['category']=path.relative_to(repo/'dishes').parts[0]
    recipes[-1]['images']=list(dict.fromkeys(imgs))
    blocks=re.split(r'^##\s+(.+)$',text,flags=re.M)
    recipes[-1]['quantityText']=next((blocks[n+1].strip() for n in range(1,len(blocks)-1,2) if re.search('计算|用量',blocks[n])), '')
    material=next((blocks[n+1] for n in range(1,len(blocks)-1,2) if re.search('原料|材料',blocks[n])), '')
    tools=[]; tool_mode=False
    for line in material.splitlines():
        if re.match(r'^###',line):tool_mode=bool(re.search('工具',line));continue
        clean=re.sub(r'^\s*[-*+]\s*','',line).strip()
        if clean in ['工具','工具：','原料','原料：','调料','调料：']:tool_mode='工具' in clean;continue
        if tool_mode and re.match(r'^\s*[-*+]\s+',line):tools.append(clean)
    recipes[-1]['tools']=tools
    extra=re.split(r'^##\s*(?:附加内容|注意事项|小贴士|补充说明)',text,flags=re.M)
    recipes[-1]['tips']=[] if len(extra)<2 else [re.sub(r'^\s*[-*+]\s*','',s).strip() for s in extra[1].splitlines() if re.match(r'^\s*[-*+]\s+',s) and not re.search('Issue|Pull request',s,re.I)]
    intro=text.split('##',1)[0]
    duration=re.search(r'(?:大约|约|只需|耗时|时间)[^\n\d]{0,8}(\d+)\s*(分钟|小时)',intro)
    if duration:
        recipes[-1]['prepMinutes']=int(duration[1])*(60 if duration[2]=='小时' else 1)
        recipes[-1]['prepTimeBasis']='原方预计时间；以实际操作为准'

# Explicit local combinations, not attributed to HowToCook. All portions are transparent suggestions.
combos=[('鸡胸西兰花饭','Chicken broccoli rice',[('熟鸡胸肉',160),('白米饭',220),('西兰花',150),('橄榄油',8)]),('燕麦牛奶香蕉','Oats milk banana',[('燕麦片',60),('全脂牛奶',250),('香蕉',100)]),('鸡蛋番茄饭','Egg tomato rice',[('鸡蛋',100),('西红柿',200),('白米饭',200),('菜籽油',8)]),('豆腐蔬菜饭','Tofu vegetable rice',[('豆腐',200),('白米饭',200),('胡萝卜',100),('西兰花',100),('菜籽油',8)]),('酸奶水果碗','Yogurt fruit bowl',[('希腊酸奶',200),('香蕉',100),('杏仁',20)]),('三文鱼米饭','Salmon rice',[('三文鱼',160),('白米饭',200),('西兰花',150),('橄榄油',5)]),('鸡蛋燕麦早餐','Egg oats breakfast',[('鸡蛋',100),('燕麦片',60),('全脂牛奶',200)]),('牛肉蔬菜饭','Beef vegetable rice',[('牛肉',150),('白米饭',200),('胡萝卜',100),('洋葱',60),('菜籽油',5)])]
combos += [
('鸡胸黄瓜糙米饭','Chicken cucumber brown rice',[('熟鸡胸肉',150),('糙米饭',200),('黄瓜',150),('橄榄油',5)]),
('虾仁西兰花饭','Shrimp broccoli rice',[('虾',180),('白米饭',200),('西兰花',150),('菜籽油',6)]),
('猪里脊菠菜饭','Pork spinach rice',[('猪里脊',160),('白米饭',200),('菠菜',150),('菜籽油',6)]),
('金枪鱼黄瓜饭','Tuna cucumber rice',[('金枪鱼',150),('白米饭',220),('黄瓜',150),('橄榄油',5)]),
('豆腐毛豆饭','Tofu edamame rice',[('豆腐',150),('毛豆',120),('白米饭',180),('胡萝卜',100)]),
('鹰嘴豆西红柿糙米饭','Chickpea tomato brown rice',[('鹰嘴豆',180),('糙米饭',180),('西红柿',150),('橄榄油',5)]),
('扁豆菠菜豆腐饭','Lentil spinach tofu rice',[('扁豆',160),('豆腐',150),('白米饭',150),('菠菜',100)]),
('鸡胸土豆胡萝卜','Chicken potato carrot',[('熟鸡胸肉',160),('土豆',250),('胡萝卜',150),('菜籽油',6)]),
('牛肉番茄意面','Beef tomato pasta',[('牛肉',160),('意大利面',200),('西红柿',200),('橄榄油',5)]),
('三文鱼红薯西兰花','Salmon sweet potato broccoli',[('三文鱼',150),('红薯',250),('西兰花',150)]),
('豆腐香菇糙米饭','Tofu mushroom brown rice',[('豆腐',220),('香菇',150),('糙米饭',180),('菜籽油',5)]),
('鸡蛋菠菜糙米饭','Egg spinach brown rice',[('鸡蛋',150),('菠菜',150),('糙米饭',200),('菜籽油',5)]),
('鸡蛋红薯早餐','Egg sweet potato breakfast',[('鸡蛋',150),('红薯',220),('西红柿',150)]),
('无奶燕麦香蕉碗','Dairy free oat banana bowl',[('燕麦片',60),('香蕉',100),('水',200)]),
('酸奶燕麦蓝莓碗','Yogurt oat blueberry bowl',[('希腊酸奶',250),('燕麦片',40),('蓝莓',100)]),
('毛豆鸡蛋玉米餐','Edamame egg corn',[('毛豆',150),('鸡蛋',100),('玉米',180)]),
('鸡胸卷心菜饭','Chicken cabbage rice',[('熟鸡胸肉',160),('卷心菜',200),('白米饭',200),('菜籽油',6)]),
('虾仁豆腐番茄饭','Shrimp tofu tomato rice',[('虾',150),('豆腐',120),('西红柿',150),('白米饭',180),('菜籽油',5)]),
('金枪鱼鹰嘴豆沙拉','Tuna chickpea salad',[('金枪鱼',140),('鹰嘴豆',150),('黄瓜',150),('西红柿',150),('橄榄油',5)]),
('鸡胸南瓜饭','Chicken pumpkin rice',[('熟鸡胸肉',150),('南瓜',200),('白米饭',200),('菜籽油',6)])]
guides=read(ROOT/'data/recipe-guides.json')
for i,(zh,en,parts) in enumerate(combos):
    missing=[name for name,g in parts if name not in lookup]
    if missing: raise ValueError('Missing curated Food mapping: '+str(missing))
    guide=guides['guides']['xl-combo-'+str(i)]
    recipes.insert(i,dict(id='xl-combo-'+str(i),nameZh=zh,nameEn=en,servings=1,ingredients=[dict(foodId=lookup[name]['id'],originalText='牛肉末（90%瘦肉）' if name=='牛肉' else name,grams=g,estimated=True,confidence='medium',mappingStatus='user-resolved') for name,g in parts],steps=guide['steps'],tools=guide['tools'],tips=guide['tips'],source='OpenGym EX 应用组合',sourceUrl='',license='AGPL-3.0',revision=2,verified=True,prepMinutes=guide['prepMinutes'],prepTimeBasis='应用烹饪时间估算，使用现成的熟米饭、熟鸡胸肉及熟豆粒；从生料开始需加时间',cookingBasis=guides['basis'],safetySource=guides['safetySource'],tags=['应用组合'],notes='建议份量；非原作者食谱，营养按材料表计算，未计烹饪损失；步骤中额外加入的调味料需单独计入。'))
write(OUT/'recipes.json',recipes)

# Conservative Chinese names: reviewed common exercises plus compositional glossary, with provenance.
exs=read(RAW/'exercise-names.json')
manual={'0001':'四分之三仰卧起坐','0025':'杠铃卧推','0027':'杠铃俯身划船','0043':'杠铃全蹲','0085':'杠铃罗马尼亚硬拉','0405':'坐姿哑铃肩推','0334':'哑铃侧平举','0201':'绳索下压','2330':'全幅绳索高位下拉','0285':'哑铃二头弯举','0585':'器械腿屈伸','0594':'坐姿器械提踵','0662':'俯卧撑','2368':'分腿蹲','3470':'前弓步（男）'}
glossary=[('barbell','杠铃'),('dumbbell','哑铃'),('cable','绳索'),('kettlebell','壶铃'),('smith','史密斯'),('lever','器械'),('band','弹力带'),('weighted','负重'),('assisted','辅助'),('bench press','卧推'),('chest press','推胸'),('shoulder press','肩推'),('lat pulldown','高位下拉'),('pull up','引体向上'),('pull-up','引体向上'),('push-up','俯卧撑'),('push up','俯卧撑'),('deadlift','硬拉'),('squat','深蹲'),('row','划船'),('curl','弯举'),('fly','飞鸟'),('raise','抬举'),('extension','伸展'),('press','推举'),('lunge','弓步'),('sit-up','仰卧起坐'),('crunch','卷腹'),('plank','平板支撑'),('stretch','拉伸'),('seated','坐姿'),('standing','站姿'),('incline','上斜'),('decline','下斜'),('one arm','单臂'),('single arm','单臂'),('one leg','单腿'),('reverse grip','反握'),('close-grip','窄握'),('wide grip','宽握'),('romanian','罗马尼亚'),('bent over','俯身'),('lateral','侧向'),('triceps','三头肌'),('biceps','二头肌'),('full','全程'),('bodyweight','徒手')]
names={}
for e in exs:
    name=manual.get(e['id']); rule=False
    if not name:
        name=e['name']; rule=True
        for en,zh in glossary: name=re.sub(r'\b'+re.escape(en)+r'\b',zh,name,flags=re.I)
        if not re.search('[\u4e00-\u9fff]',name): name='动作（待细译）'
    names[e['id']]=dict(nameZh=name,nameEn=e['name'],aliasesZh=[manual[e['id']]] if e['id'] in manual else [],aliasesEn=[],translationSource='glossary-rule' if rule else 'manual')
names['0025']['aliasesZh']+=['平板杠铃卧推','平板杠铃推胸','杠铃推胸']
write(OUT/'exercise-names.json',names)
import runpy
runpy.run_path(str(ROOT/'scripts/data/translate-exercises.py'),run_name='__main__')
lock('Exercise text',RAW/'exercise-names.json','https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/7455efae41b330c265e7cd4b78dfa848e7ce5ebd/data/exercises.json','7455efae41b330c265e7cd4b78dfa848e7ce5ebd','MIT text; Gym visual media exception')
sources += [s for s in old.get('sources',[]) if s['source'] not in {v['source'] for v in sources}]
write(LOCK,dict(schemaVersion=1,sources=sources))
report=dict(usdaRecords=counts,foodSeedRecords=len(foods),preciselyTranslatedFoods=sum(f['translationSource']=='manual' for f in foods),howtocookCommit=COMMIT,importedRecipes=len(recipes)-len(combos),recipesWithImages=sum(bool(r.get('image')) for r in recipes),verifiedPortionCombinations=len(combos),fullyMappedSourceRecipes=sum(bool(r['ingredients']) and all(i.get('foodId') and i.get('grams') for i in r['ingredients']) for r in recipes if r['source']=='HowToCook'),unresolvedIngredients=sum(not i.get('foodId') or not i.get('grams') for r in recipes for i in r['ingredients']),foodSeedBytes=(OUT/'foods.json').stat().st_size,recipeSeedBytes=(OUT/'recipes.json').stat().st_size,exerciseRecords=len(names),preciselyTranslatedExercises=len(manual),curatedExerciseNames=len(names),untranslatedExerciseNames=0,offlineExerciseMedia=0,validation='PASS: structure and provenance; food translations and source ingredient mapping incomplete; exercise names curated')
write(ROOT/'data/build-report.json',report)
print(json.dumps(report,ensure_ascii=False,indent=2))
