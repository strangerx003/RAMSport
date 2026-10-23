import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pages = ["login", "dashboard", "data-register", "rbd", "fta"];
for (const page of pages) {
  test(`${page} page exists`, async () => {
    const source = await readFile(new URL(`../app/${page}/page.tsx`, import.meta.url), "utf8");
    assert.match(source, /export default/);
  });
}

test("temporary login requires non-empty credentials", async () => {
  const source = await readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8");
  assert.match(source, /!username\.trim\(\) \|\| !password/);
  assert.match(source, /ramsport-register/);
  assert.match(source, /ramsport-rbd-diagram/);
  assert.match(source, /ramsport-fta-diagram/);
});

test("professional export center supports PDF, Excel, PowerPoint and Word", async () => {
  const source = await readFile(new URL("../components/ExportDialog.tsx", import.meta.url), "utf8");
  assert.match(source, /exportPdf/);
  assert.match(source, /exportExcel/);
  assert.match(source, /exportPowerPoint/);
  assert.match(source, /exportWord/);
  assert.match(source, /captureWorkspace/);
});

test("RBD and FTA share the reference workbench layout and controls", async () => {
  const source = await readFile(new URL("../components/DiagramEditor.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/workbench.css", import.meta.url), "utf8");
  for (const control of ["Straight", "Elbow", "Calculate", "Clear", "Reset", "Properties"]) {
    assert.match(source, new RegExp(control));
  }
  assert.match(source, /mode === "rbd"/);
  assert.match(source, /mode === "fta"/);
  assert.match(styles, /grid-template-columns:220px minmax\(520px,1fr\) 246px/);
  assert.match(styles, /background-image:linear-gradient/);
  assert.match(styles, /width:180px;min-height:92px/);
});

test("data register imports CSV and diagrams reference shared assets", async () => {
  const register = await readFile(new URL("../app/data-register/page.tsx", import.meta.url), "utf8");
  const diagram = await readFile(new URL("../components/DiagramEditor.tsx", import.meta.url), "utf8");
  assert.match(register, /importCsv/);
  assert.match(register, /accept="\.csv,text\/csv"/);
  assert.match(diagram, /assetId/);
  assert.match(diagram, /assets\.find/);
  assert.doesNotMatch(diagram, /failureRate: asset\.lambda/);
});

test("FTA supports vertical port drag, inserted gates and executable logic", async () => {
  const diagram = await readFile(new URL("../components/DiagramEditor.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/workbench.css", import.meta.url), "utf8");
  assert.match(diagram, /startPortDrag/);
  assert.match(diagram, /pendingGate/);
  assert.match(diagram, /confirmGate/);
  assert.match(diagram, /gate and/);
  assert.match(diagram, /gate or/);
  assert.match(diagram, /gate xor/);
  assert.match(diagram, /evaluateFtaNode/);
  assert.match(styles, /\.fta-workbench \.port\.top/);
  assert.match(styles, /\.fta-workbench \.port\.bottom/);
  assert.match(styles, /cursor:crosshair/);
});
