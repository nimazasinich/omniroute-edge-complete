from pathlib import Path
from html import escape
import asyncio
from playwright.async_api import async_playwright

OUT = Path('env-work-logs/1368-layout-preview')
OUT.mkdir(parents=True, exist_ok=True)

NODE_H = 56
MIN_GAP = 8
MAX_PER_PAGE = 6
W, H = 1368, 753

def page_size(available):
    fit = int((max(0, available) + MIN_GAP) // (NODE_H + MIN_GAP))
    return max(1, min(MAX_PER_PAGE, fit or 1))

def positions(total, available, page=0):
    size = page_size(available)
    pages = max(1, (max(0,total) + size - 1) // size)
    page = min(max(0,page), pages-1)
    start = min(total, page*size)
    visible = min(size, max(0,total-start))
    if visible == 0:
        return [], (page, pages, start, start, size)
    if visible == 1:
        return [max(0, (available-NODE_H)/2)], (page, pages, start, start+visible, size)
    natural_gap = (available - visible*NODE_H) / (visible - 1)
    gap = max(MIN_GAP, natural_gap)
    used = visible*NODE_H + (visible-1)*gap
    y0 = max(0, (available-used)/2)
    return [y0 + i*(NODE_H+gap) for i in range(visible)], (page, pages, start, start+visible, size)

def provider_nodes(n):
    statuses = ['healthy','degraded','offline','healthy','disabled','unknown']
    nodes=[]
    for i in range(n):
        name = 'Very-Long-Enterprise-OpenAI-Compatible-Provider' if i == n-1 and n >= 20 else f'Provider {i+1}'
        observed = i < min(n, 10)
        req = (n-i)*3 if observed else 0
        nodes.append({
            'id': f'p{i}', 'label': name, 'health': statuses[i % len(statuses)],
            'requests': req, 'traffic': round(req/max(1, sum((n-j)*3 for j in range(min(n,10))))*100,1) if observed else 0,
            'state': 'observed' if observed else 'configured', 'lat': [3,682,12400][i%3]
        })
    return nodes

def source_nodes(provider_count):
    if provider_count == 0:
        return []
    if provider_count == 1:
        return [{'label':'Unknown','type':'Unclassified','requests':0,'traffic':0,'status':'unknown'}]
    return [
        {'label':'Internal EU App','type':'internal','requests':120,'traffic':68.3,'status':'classified'},
        {'label':'Unknown','type':'Unclassified','requests':32,'traffic':18.3,'status':'unknown'},
        {'label':'CLI Gateway','type':'automation','requests':23,'traffic':13.4,'status':'classified'},
    ]

def fmt_latency(ms):
    if not ms: return 'No data'
    return f'{ms/1000:.1f} s' if ms >= 1000 else f'{ms} ms'

def render_case(label, pcount):
    providers = provider_nodes(pcount)
    sources = source_nodes(pcount)
    panel_w, panel_h = 1010, 610
    rail_top, rail_footer = 38, 40
    rail_h = panel_h - rail_top - rail_footer
    rail_w = 220
    source_pos, smeta = positions(len(sources), rail_h)
    provider_pos, pmeta = positions(len(providers), rail_h)
    visible_sources = sources[smeta[2]:smeta[3]]
    visible_providers = providers[pmeta[2]:pmeta[3]]
    cx, cy, r = panel_w/2, panel_h/2, 62
    paths=[]
    for i,(s,y) in enumerate(zip(visible_sources, source_pos)):
        startx,endx=rail_w,cx-r
        sy=rail_top+y+NODE_H/2
        ey=cy + (0 if len(visible_sources)==1 else (i-(len(visible_sources)-1)/2)/max(1,(len(visible_sources)-1)/2)*r*.32)
        paths.append(f'<path d="M {startx} {sy} C {startx+95} {sy}, {endx-95} {ey}, {endx} {ey}" class="path source"/>')
    observed=[(p,y) for p,y in zip(visible_providers, provider_pos) if p['state']=='observed' and p['requests']>0]
    for i,(p,y) in enumerate(observed):
        startx,endx=cx+r,panel_w-rail_w
        sy=cy + (0 if len(observed)==1 else (i-(len(observed)-1)/2)/max(1,(len(observed)-1)/2)*r*.32)
        ey=rail_top+y+NODE_H/2
        cls='provider ok' if p['health']=='healthy' else 'provider dash'
        paths.append(f'<path d="M {startx} {sy} C {startx+95} {sy}, {endx-95} {ey}, {endx} {ey}" class="path {cls}"/>')
    def rail_header(title, count, meta):
        page,pages,start,end,size=meta
        span = f'{start+1}-{end}/{count}' if count else '0/0'
        return f'<div class="rail-header"><b>{title}</b><span>{span} · page {page+1}/{pages} · size {size}</span></div>'
    def source_card(s, y):
        return f'<div class="node left" style="top:{rail_top+y}px" title="{escape(s["label"])}"><b>{escape(s["label"])}</b><span>{escape(s["type"])} · {s["requests"]} req · {s["traffic"]}%</span></div>'
    def provider_card(p, y):
        state = 'Observed traffic' if p['state']=='observed' else 'Configured · no observed traffic'
        return f'<div class="node right {p["health"]}" style="top:{rail_top+y}px" title="{escape(p["label"])}"><b>{escape(p["label"])}</b><span>{p["health"]} · {fmt_latency(p["lat"])} · {p["traffic"]}%</span><em>{state}</em></div>'
    source_cards=''.join(source_card(s,y) for s,y in zip(visible_sources,source_pos)) or '<div class="empty left-empty">No observed sources<br/><small>Unknown / Unclassified / No data</small></div>'
    provider_cards=''.join(provider_card(p,y) for p,y in zip(visible_providers,provider_pos)) or '<div class="empty right-empty">No configured providers<br/><small>No fake routes rendered</small></div>'
    html=f'''<!doctype html><html><head><meta charset="utf-8"><title>{escape(label)}</title><style>
*{{box-sizing:border-box}} body{{margin:0;width:{W}px;height:{H}px;font-family:Inter,Arial,sans-serif;background:#eef6ff;color:#0f172a;overflow:hidden}} .app{{width:{W}px;height:{H}px;padding:18px;display:grid;grid-template-columns:260px 1fr;gap:14px}} .side{{border:1px solid #dcebfa;background:white;border-radius:18px;padding:14px;box-shadow:0 18px 45px #64748b22}} .side h1{{font-size:18px;margin:0 0 8px}} .side p{{font-size:12px;line-height:1.4;color:#64748b}} .top{{height:76px;border:1px solid #dcebfa;background:#ffffffcc;border-radius:18px;padding:14px;margin-bottom:12px}} .top h2{{font-size:17px;margin:0}} .top p{{font-size:12px;margin:4px 0 0;color:#64748b}} .panel{{position:relative;width:{panel_w}px;height:{panel_h}px;border:1px solid #dcebfa;background:linear-gradient(180deg,#fff,#f8fbff);border-radius:18px;overflow:hidden;box-shadow:0 18px 45px #64748b22}} .rail{{position:absolute;top:0;width:{rail_w}px;height:100%;padding:10px 8px}} .rail.left{{left:0}} .rail.right{{right:0}} .rail-header{{height:24px;font-size:11px;display:flex;justify-content:space-between;color:#64748b}} .rail-header b{{color:#0f172a}} .node{{position:absolute;width:204px;height:{NODE_H}px;border:1px solid #dcebfa;background:white;border-radius:14px;padding:8px 10px;overflow:hidden;box-shadow:0 8px 24px #0051c314}} .node b{{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}} .node span,.node em{{display:block;font-size:10px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:normal;font-variant-numeric:tabular-nums}} .node.healthy{{border-left:4px solid #10b981}} .node.degraded{{border-left:4px solid #f59e0b}} .node.offline{{border-left:4px solid #ef4444}} .node.disabled,.node.unknown{{border-left:4px solid #94a3b8}} .node.left{{left:8px;border-left:4px solid #0051c3}} .node.right{{right:8px}} svg{{position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none}} .path{{fill:none;stroke-width:2.2;opacity:.58}} .path.source{{stroke:#0051c3}} .path.provider.ok{{stroke:#10b981}} .path.provider.dash{{stroke:#f59e0b;stroke-dasharray:5 5}} .core{{position:absolute;left:calc(50% - 62px);top:calc(50% - 62px);width:124px;height:124px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#dbeafe,#0051c3 70%);box-shadow:0 0 0 12px #0051c318,0 22px 55px #0051c366;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;text-align:center;font-size:14px;z-index:3}} .empty{{position:absolute;top:50%;transform:translateY(-50%);width:204px;border:1px dashed #cbd5e1;background:#ffffffcc;border-radius:14px;padding:12px;font-size:12px;color:#64748b}} .left-empty{{left:8px}} .right-empty{{right:8px;text-align:right}} .badge{{display:inline-block;border-radius:999px;padding:4px 8px;background:#e0f2fe;color:#0051c3;font-size:11px;font-weight:700;margin-right:6px}}
</style></head><body><div class="app"><aside class="side"><h1>1368×753 CP02 preview</h1><p><b>{escape(label)}</b></p><p>This is a local layout harness generated from the topology data contract and rail algorithm, not a full Vite runtime screenshot.</p><p><span class="badge">providers {pcount}</span><span class="badge">visible {len(visible_providers)}</span><span class="badge">pages {pmeta[1]}</span></p><p>20+ providers stay reachable by rail pagination; configured-only providers do not draw fake routes.</p></aside><main><div class="top"><h2>Global AI Traffic Topology</h2><p>Backend-driven sources → Cloudflare Edge → AI Router → configured/observed providers. No silent node cap.</p></div><section class="panel"><svg viewBox="0 0 {panel_w} {panel_h}" preserveAspectRatio="none">{''.join(paths)}</svg><div class="core">AI<br/>Router</div><div class="rail left">{rail_header('Sources',len(sources),smeta)}{source_cards}</div><div class="rail right">{rail_header('Providers',len(providers),pmeta)}{provider_cards}</div></section></main></div></body></html>'''
    path=OUT/f'{pcount:02d}-providers.html'
    path.write_text(html, encoding='utf-8')
    return path

async def main():
    pages=[]
    for label,count in [('A no providers',0),('B one provider',1),('C six providers',6),('D twenty providers',20)]:
        pages.append((label,count,render_case(label,count)))
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page=await browser.new_page(viewport={'width':W,'height':H}, device_scale_factor=1)
        for label,count,path in pages:
            await page.goto(f'http://127.0.0.1:8765/{path.name}')
            await page.screenshot(path=str(OUT/f'{count:02d}-providers-1368x753.png'), full_page=False)
        await browser.close()
    print('created screenshots:')
    for png in sorted(OUT.glob('*.png')):
        print(png)

if __name__ == '__main__':
    asyncio.run(main())
