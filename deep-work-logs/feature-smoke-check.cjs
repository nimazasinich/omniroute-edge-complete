const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, pass: Boolean(pass), detail });
}
const app = read('src/App.tsx');
const sidebar = read('src/components/Sidebar.tsx');
const settings = read('src/components/SettingsView.tsx');
const server = read('src/server/app.ts');
const topologyMap = read('src/components/TopologyMap.tsx');
const allFrontend = fs.readdirSync(path.join(root, 'src/components'))
  .filter((file) => file.endsWith('.tsx'))
  .map((file) => read(`src/components/${file}`))
  .join('\n');
check('traces-route', app.includes('path="/traces"') && fs.existsSync(path.join(root, 'src/components/TracesView.tsx')));
check('audit-route', app.includes('path="/audit"') && sidebar.includes("path: '/audit'") && fs.existsSync(path.join(root, 'src/components/AuditLogView.tsx')));
check('metrics-route', app.includes('path="/metrics"'));
check('readiness-endpoint', server.includes("app.get('/api/readiness'"));
check('alerts-endpoint', server.includes("app.get('/api/alerts'"));
check('bootstrap-ui', settings.includes('BootstrapAdminCard') && fs.existsSync(path.join(root, 'src/components/BootstrapAdminCard.tsx')));
check('admin-auth-helper', fs.existsSync(path.join(root, 'src/auth/adminAuth.ts')));
check('no-frontend-hardcoded-admin-secret', !allFrontend.includes('admin_secret'));
for (const forbidden of ['2,847', '6.8 GB', '99.98', '1.24M', '$1,420', 'Dynamic optimal score']) {
  check(`no-fake-${forbidden}`, !allFrontend.includes(forbidden));
}
check('no-silent-topology-provider-cap-8', !topologyMap.includes('slice(0, 8)'));
check('no-silent-topology-source-cap-10', !topologyMap.includes('slice(0, 10)'));
const failed = checks.filter((item) => !item.pass);
for (const item of checks) {
  console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` ${item.detail}` : ''}`);
}
console.log(`summary pass=${checks.length - failed.length} fail=${failed.length}`);
process.exit(failed.length ? 1 : 0);
