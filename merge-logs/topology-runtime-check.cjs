const ts = require('typescript');
const fs = require('fs');
const vm = require('vm');
function load(file, exports) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/^import type[^;]+;\n/gm, '').replace(/^import[^;]+;\n/gm, '');
  code = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports };
  vm.runInNewContext(code, { module, exports: module.exports, require, console }, { filename: file });
  return module.exports;
}
const layout = load('src/topology/layout.ts', {});
const payload = load('src/topology/payload.ts', {});
const counts = [0,1,3,6,10,20,30,37];
const heights = [230,300,480,720];
for (const count of counts) {
  for (const height of heights) {
    const nodes = Array.from({length: count}, (_, i) => `provider-${i}`);
    const first = layout.buildRailLayout(count, height, 0, {nodeHeight:56, minGap:8, maxPerPage:6});
    const seen=[];
    for (let page=0; page<first.pageCount; page++) {
      const pageLayout = layout.buildRailLayout(count, height, page, {nodeHeight:56, minGap:8, maxPerPage:6});
      if (!pageLayout.positions.every((y) => y >= 0 && y + 56 <= height)) throw new Error(`bounds failed count=${count} height=${height} page=${page}`);
      seen.push(...layout.pageItems(nodes, pageLayout));
    }
    if (seen.length !== count || new Set(seen).size !== count) throw new Error(`coverage failed count=${count} height=${height}`);
  }
}
const topo = payload.buildTopologyPayload({
  clientTraffic:[{clientId:'client-a', count:2, avgLatency:100}],
  providerTraffic:[{providerId:'p1', count:1, avgLatency:3}, {providerId:null, count:1, avgLatency:12400}],
  apiKeys:[{id:'client-a', name:'Internal EU Provider', role:'gateway'}],
  providers:[{id:'p1', name:'Very-Long-Enterprise-OpenAI-Compatible-Provider', status:'healthy', enabled:true, metadata:{baseLatency:682, costPer1k:1.4}}],
  models:[{providerId:'p1', enabled:true}, {providerId:'p1', enabled:false}]
});
if (topo.nodes.router.totalRequestsLast24h !== 2) throw new Error('router total failed');
if (topo.nodes.providers[0].trafficSharePct !== 50) throw new Error('traffic denominator failed');
if (topo.nodes.providers[0].enabledModelCount !== 1) throw new Error('enabled model count failed');
console.log('counts=' + counts.join(','));
console.log('heights=' + heights.join(','));
console.log('topology_runtime=PASS');
