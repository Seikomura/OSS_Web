import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import * as data from "../src/data.js";

const source = await readFile(
  new URL("../src/app.js", import.meta.url),
  "utf8",
);
async function until(check) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("UI did not settle");
}
const seed = {
  user: { id: "admin", role: "admin", name: "Admin" },
  customers: [
    {
      id: "client1",
      username: "client1",
      company: "Original company",
      active: true,
    },
  ],
  jobs: [],
};
function boot(request) {
  const dom = new JSDOM('<div id="app"></div><div id="toast"></div>', {
    url: "https://portal.test",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  Object.assign(dom.window, data, { request, structuredClone });
  dom.window.scrollTo = () => {};
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  Object.defineProperty(dom.window.HTMLFormElement.prototype, "id", {
    get() {
      return this.elements.namedItem("id") || this.getAttribute("id");
    },
    configurable: true,
  });
  dom.window.eval(source.replace(/^import[^\n]+\n/gm, ""));
  return dom;
}
function edit(dom, name, value) {
  dom.window.document.querySelector(`dialog [name="${name}"]`).value = value;
}
function submit(dom) {
  dom.window.document
    .querySelector("dialog form")
    .dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
}

test("account forms await server save despite id control collision and keep errors visible", async () => {
  const state = structuredClone(seed),
    calls = [];
  let fail = false;
  const dom = boot(async (op, input) => {
    if (op === "state") return structuredClone(state);
    if (fail)
      throw Object.assign(new Error("ชื่อผู้ใช้นี้ถูกใช้แล้ว"), {
        status: 409,
      });
    calls.push({ op, input });
    if (input.id)
      Object.assign(
        state.customers.find((c) => c.id === input.id),
        { ...input, password: undefined },
      );
    else state.customers.push({ ...input, id: "client2", password: undefined });
    return structuredClone(state);
  });
  try {
    const document = dom.window.document;
    await until(() => document.querySelector('[data-route="customers"]'));
    document.querySelector('[data-route="customers"]').click();
    document.querySelector('[data-action="edit-customer"]').click();
    assert.equal(document.querySelector("#customer-latest-password"), null);
    edit(dom, "password", "New password 123456");
    submit(dom);
    await until(() => !document.querySelector("dialog"));
    assert.equal(calls[0].op, "account-save");
    assert.equal(calls[0].input.password, "New password 123456");
    assert.equal(calls[0].input.id, "client1");
    document.querySelector('[data-action="new-customer"]').click();
    edit(dom, "username", "client2");
    edit(dom, "company", "Another client");
    edit(dom, "password", "Different password123");
    submit(dom);
    await until(() => !document.querySelector("dialog"));
    assert.equal(state.customers.length, 2);
    assert.equal(calls[1].input.active, true);
    document.querySelector('[data-action="new-customer"]').click();
    edit(dom, "username", "client2");
    edit(dom, "company", "Duplicate");
    edit(dom, "password", "Different password123");
    fail = true;
    submit(dom);
    await until(() =>
      document.querySelector("#form-error")?.textContent.includes("ถูกใช้แล้ว"),
    );
    assert.equal(
      document.querySelector('dialog button[type="submit"]').disabled,
      false,
    );
    assert.equal(state.customers.length, 2);
  } finally {
    dom.window.close();
  }
});
