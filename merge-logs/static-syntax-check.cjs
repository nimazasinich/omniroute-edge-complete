const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const roots = ['src', 'server.ts', 'vite.config.ts', 'drizzle.config.ts'];
function walk(p, out=[]) {
  if (!fs.existsSync(p)) return out;
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(p)) walk(path.join(p, name), out);
  } else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  return out;
}
const files = roots.flatMap((r) => walk(r));
let failures = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
  });
  const diagnostics = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (diagnostics.length) {
    failures += diagnostics.length;
    console.log(`FAIL ${file}`);
    for (const d of diagnostics) console.log(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  }
}
console.log(`checked=${files.length}`);
console.log(`syntax_errors=${failures}`);
process.exit(failures ? 1 : 0);
