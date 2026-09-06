"""Build the local, attributed campus dataset from the downloaded public snapshots.

Geometry: OSM contributors (ODbL). Official names/photos: Catholic University.
Building heights are visual estimates except for explicitly sourced OSM heights.
No API keys or live third-party calls are needed by the finished viewer.
"""
import json, math, pathlib, urllib.request
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'public/data'
REF = ROOT / 'public/reference'
LON, LAT = 126.8016, 37.4864
MX = math.pi / 180 * 6378137 * math.cos(math.radians(LAT))
MZ = math.pi / 180 * 6378137
ANGLE = .31

def project(p):
    return [round((p['lon']-LON)*MX,3), round(-(p['lat']-LAT)*MZ,3)]

places=json.loads((DATA/'official-places.json').read_text())['items']
osm=json.loads((DATA/'osm.json').read_text())
extra=json.loads((DATA/'osm-extra.json').read_text())
francisco=json.loads((DATA/'osm-francisco.json').read_text())
all_elements={e['id']:e for e in osm['elements']+extra['elements']+francisco['elements']}
official={p['orderNo']:p for p in places}
architecture=json.loads((DATA/'architectural-evidence.json').read_text())['buildings']
# Height is a model parameter, not a surveyed dimension. Explicitly preserved in output.
configs=[
    (2,278736793,'incubator',11.4,3,'#deded6','창업 지원 · 어린이집'),
    (3,343596941,'kim',57.7,15,'#ac5542','강의동 · 스테파노기숙사'),
    (5,1196300637,'andrea',34.8,10,'#ad6553','2022년 준공 · 생활관'),
    (6,343597050,'maria',20.0,5,'#ac5a48','강의동'),
    (7,343597087,'nicholls',16.8,4,'#b87561','강의동 · 카페하랑'),
    (8,343597646,'bambino',8.0,2,'#e3d8b6','밤비노관'),
    (9,9310609,'dasol',27.2,7,'#a65343','이공계 강의·연구동'),
    (10,343597329,'virtus',13.2,3,'#a65945','강의실 · 교수연구실'),
    (11,343597846,'student',18.3,3,'#a96149','학생미래인재관 · 소피이바라관'),
    (13,343597964,'michael',34.0,7,'#d5cbb6','행정동 · 교수연구동'),
    (15,278736790,'library',19.5,5,'#d7d5c4','베리타스관 · 중앙도서관'),
    (16,343598901,'songsim',20.6,5,'#a25b49','성심관'),
    (17,468614431,'pharmacy',24.0,5,'#a65c46','약학대학 · 실험연구실'),
    (18,343598816,'concert',13.0,2,'#ad4f3b','콘서트홀 · 음악과'),
    (20,343598741,'paul',8.0,2,'#a96c50','바오로관'),
    (21,343598659,'international',10.8,3,'#aa6550','국제교류관'),
    (22,278736792,'chapel',10.0,1,'#d7cbb0','예수성심성당'),
    (23,1518221582,'francisco',42.0,14,'#d6d8d4','교외 기숙사 · 지봉로63번길'),
]
buildings=[]
for no,oid,kind,height,floors,color,subtitle in configs:
    e=all_elements[oid]
    if e['type']=='relation':
        outer=[m['geometry'] for m in e['members'] if m['role']=='outer'][0]
        holes=[m['geometry'] for m in e['members'] if m['role']=='inner']
    else:
        outer=e['geometry'];holes=[]
    ring=[project(p) for p in outer[:-1]]
    center=[sum(p[i] for p in ring)/len(ring) for i in range(2)]
    p=official.get(no)
    name=p['placeName'] if p else ('바오로관' if no==20 else '국제교류관')
    if no==13:name='미카엘관'
    if no==15:name='베리타스관'
    source_note='OSM 외곽선 · 공식 외관 사진. 높이와 세부 창호는 사진을 기준으로 추정한 재구성입니다.'
    if no==3:source_note='설계사 정림건축의 지상 15층·지하 3층 기록과 정문을 향한 좁은 타워 면 배치를 반영했습니다. 학교·설계사 사진으로 외장 패널과 컨벤션센터를 보정했습니다. 상세 치수는 추정입니다.'
    if no==5:source_note='설계자 공개 기준층·단면도(WIDE AR 91, pp.84–85)에서 곡선 외곽선, 원형 아트리움과 3개 층 높이의 필로티를 반영했습니다. 미터 치수와 지리적 정합은 추정입니다.'
    if no==11:source_note='경기건축포털의 지상 3층·지하 1층 자료를 반영했습니다. 공식 외관 사진과 건축 사진으로 돌출 벽, 입구와 수평 창을 재구성했습니다. 상세 치수는 추정입니다.'
    if no==15:source_note='학교 중앙도서관 안내의 5층 정보를 반영했습니다. 공식 사진의 녹색 경사지붕과 곡면 출입구를 보정했으며, 주 출입구 아래 층의 지형 관계와 치수는 추정입니다.'
    if no==23:source_note='공식 14층 안내와 OSM의 42m 높이·외곽선 반영. 창호와 외장 패널 배치는 공식 사진을 참고한 추정입니다.'
    if no in [20,21]:source_note='공식 캠퍼스 평면도와 OSM 외곽선 기반. 별도 외관 사진을 확보하지 못해 상세 외관은 미검증입니다.'
    buildings.append(dict(id=str(no),number=no,osmId=oid,name=name,english=p['placeNameEn'] if p else subtitle,
        code=p['abbreviation'].replace('관','') if p else ('P' if no==20 else 'I'),
        kind=kind,height=height,floors=floors,floorsVerified=no in [2,3,5,11,15,18,23],
        color=color,subtitle=subtitle,center=[round(v,3) for v in center],ring=ring,
        holes=[[project(q) for q in h[:-1]] for h in holes],
        latitude=p['latitude'] if p else LAT-center[1]/MZ,
        longitude=p['longitude'] if p else LON+center[0]/MX,
        photo='/reference/place-'+str(no)+'.webp' if p else None,
        photoSource='https://www.catholic.ac.kr'+p['fileName'] if p else None,
        sourceNote=source_note,
        sourceUrl='https://www.openstreetmap.org/'+e['type']+'/'+str(oid)))
    if str(no) in architecture:
        buildings[-1]['architecture']=architecture[str(no)]
    if no==5:
        model=architecture['5']['model']
        def to_world(p):
            u,v=p;c,s=math.cos(ANGLE),math.sin(ANGLE)
            return [round(center[0]+u*c+v*s,3),round(center[1]-u*s+v*c,3)]
        buildings[-1]['ring']=[to_world(p) for p in model['localOutline'][:-1]]
        u,v=model['headCenter'];r=model['atriumRadius']
        buildings[-1]['holes']=[[to_world([u+r*math.cos(i/64*2*math.pi),v+r*math.sin(i/64*2*math.pi)]) for i in range(64)]]
    if no==22:
        # Photo-derived court limits, separate from the mapped church footprint.
        c,s=math.cos(ANGLE),math.sin(ANGLE)
        local=[[(x-center[0])*c-(z-center[1])*s,(x-center[0])*s+(z-center[1])*c] for x,z in ring]
        half_width=(max(p[0] for p in local)-min(p[0] for p in local))/2+9
        half_depth=(max(p[1] for p in local)-min(p[1] for p in local))/2
        court=[[-half_width,-half_depth-10],[half_width,-half_depth-10],[half_width,half_depth+14],[-half_width,half_depth+14]]
        buildings[-1]['siteRing']=[[round(center[0]+u*c+v*s,3),round(center[1]-u*s+v*c,3)] for u,v in court]
        buildings[-1]['sourceNote']='OSM 성당 외곽선과 공식 사진의 팔각 지붕, 아치형 창과 중정을 반영했습니다. 중정 범위·부속실·상세 치수와 지면 높이는 사진 기반 추정입니다.'

# The convention wing is one part of the K complex, not a second independent hall.
wing=all_elements[621412082]
buildings[1]['annex']=[project(p) for p in wing['geometry'][:-1]]
campus=all_elements[621412078]
boundary=[project(p) for p in campus['geometry'][:-1]]
roads=[]
for e in osm['elements']:
    t=e.get('tags',{})
    if 'highway' not in t or t.get('area')=='yes':continue
    points=[project(p) for p in e['geometry']]
    if not any(-420<x<470 and -370<z<300 for x,z in points):continue
    roads.append(dict(id=e['id'],type=t['highway'],name=t.get('name',''),points=points))
grounds=[]
for oid in [278736791,517201104,621412084]:
    e=all_elements[oid]
    grounds.append(dict(id=oid,kind='field' if oid==278736791 else 'tennis',ring=[project(p) for p in e['geometry'][:-1]]))
context=[]
used={c[1] for c in configs}|{621412082}
for e in {e['id']:e for e in osm['elements']+francisco['elements']}.values():
    t=e.get('tags',{})
    if 'building' not in t or e['id'] in used:continue
    ring=[project(p) for p in e['geometry'][:-1]]
    cx=sum(p[0] for p in ring)/len(ring);cz=sum(p[1] for p in ring)/len(ring)
    if not (-410<cx<465 and -320<cz<310):continue
    context.append(dict(id=e['id'],ring=ring,height=float(t.get('height',float(t.get('building:levels',3))*3.1))))

# Raw Terrarium elevation, bilinear resampling. This is a regional DEM, not a survey.
ZOOM=15; N=2**ZOOM
def tilepos(lon,lat):return (lon+180)/360*N,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*N
tiles={}
tile_urls=[]
def elevation(x,z):
    lon=LON+x/MX;lat=LAT-z/MZ
    tx,ty=tilepos(lon,lat);ix,iy=int(tx),int(ty)
    if (ix,iy) not in tiles:
        url=f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{ix}/{iy}.png'
        dest=DATA/f'dem-{ZOOM}-{ix}-{iy}.png'
        if not dest.exists():urllib.request.urlretrieve(url,dest)
        tiles[ix,iy]=Image.open(dest).convert('RGB')
        tile_urls.append(url)
    image=tiles[ix,iy];fx=(tx-ix)*255;fy=(ty-iy)*255
    ax,ay=int(fx),int(fy);dx=fx-ax;dy=fy-ay
    def v(xx,yy):
        r,g,b=image.getpixel((min(255,xx),min(255,yy)))
        return r*256+g+b/256-32768
    return v(ax,ay)*(1-dx)*(1-dy)+v(ax+1,ay)*dx*(1-dy)+v(ax,ay+1)*(1-dx)*dy+v(ax+1,ay+1)*dx*dy

extent=[-480,-410,490,355];resolution=97
values=[]
for j in range(resolution):
    z=extent[1]+j/(resolution-1)*(extent[3]-extent[1])
    for i in range(resolution):
        x=extent[0]+i/(resolution-1)*(extent[2]-extent[0])
        values.append(round(elevation(x,z),2))
datum=round(elevation(265,50),1)
for b in buildings:b['baseElevation']=round(elevation(*b['center'])-datum,2)

for p in places:
    src=next(REF.glob('place-'+str(p['orderNo'])+'.*'))
    image=Image.open(src).convert('RGB');image.thumbnail((1440,1080))
    image.save(REF/('place-'+str(p['orderNo'])+'.webp'),'WEBP',quality=86)

dataset=dict(origin=dict(latitude=LAT,longitude=LON,metersPerLongitude=MX,metersPerLatitude=MZ),
    retrievedAt='2026-09-06',osmTimestamp=osm.get('osm3s',{}).get('timestamp_osm_base'),
    angle=ANGLE,buildings=buildings,boundary=boundary,roads=roads,grounds=grounds,context=context,
    landmarks=[dict(number=p['orderNo'],name=p['placeName'],position=project({'lat':p['latitude'],'lon':p['longitude']}),photo='/reference/place-'+str(p['orderNo'])+'.webp') for p in places if p['orderNo'] in [1,4,12,14,19,23,24]],
    terrain=dict(extent=extent,resolution=resolution,values=values,datum=datum,sources=tile_urls),
    accuracy=dict(geometry='OSM footprints; Andrea typical-floor outline traced from the architect-published drawing, with estimated scale and registration. Not surveyed.',
        heights='Except explicitly sourced floor counts, heights and facade details are estimated from official photographs.',
        landscape='Regional DEM; local grading, vegetation and paving are approximations.',
        completeness='Exterior reconstruction. Interiors and unseen facades are not verified.'))
# Garden contour traced from the current official campus plan. The illustrated
# plan is not a survey: its scale and registration remain approximate.
garden=next(p for p in dataset['landmarks'] if p['number']==12)
garden_pixels=[(654,567),(714,588),(739,619),(753,650),(764,676),(762,695),(750,700),(738,692),(726,676),(700,669),(689,686),(677,690),(662,682),(650,670),(632,672),(614,664),(606,648),(606,628),(613,604),(627,582)]
garden['ring']=[]
for x,y in garden_pixels:
    u,v=(y-635)/1.85,-(x-690)/1.85
    garden['ring'].append([round(garden['position'][0]+u*math.cos(ANGLE)+v*math.sin(ANGLE),3),round(garden['position'][1]-u*math.sin(ANGLE)+v*math.cos(ANGLE),3)])
(DATA/'campus.json').write_text(json.dumps(dataset,ensure_ascii=False,separators=(',',':')))
print('Prepared',len(buildings),'building groups,',len(roads),'roads,',len(context),'context buildings')
print('Terrain datum',datum,'range',min(values),max(values),'sources',len(tiles))
