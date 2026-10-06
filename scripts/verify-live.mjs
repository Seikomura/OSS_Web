import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { apiServer } from "./dev.mjs";
import { serviceClient } from "../server/supabase.js";

const service = serviceClient();
const accounts = JSON.parse(
  await readFile("outputs/initial-access.json", "utf8"),
);
const api = apiServer(0);
await once(api, "listening");
const base = process.argv[2] || `http://127.0.0.1:${api.address().port}`;
function session() {
  const cookies = new Map();
  return async (op, input) => {
    const response = await fetch(`${base}/api/portal?op=${op}`, {
      method: input ? "POST" : "GET",
      headers: {
        ...(input ? { "Content-Type": "application/json", Origin: base } : {}),
        Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body: input ? JSON.stringify(input) : undefined,
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";"),
        index = pair.indexOf("=");
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const result = await response.json();
    return { status: response.status, result };
  };
}
const admin = session(),
  a = session(),
  b = session();
let temporaryId;
const results = [];
function verify(value, label) {
  assert.ok(value, label);
  results.push(label);
  console.log(`PASS: ${label}`);
}
try {
  const anonymous = await session()("state");
  verify(anonymous.status === 401, "anonymous denied");
  const login = async (client, account) =>
    client("login", { username: account.username, password: account.password });
  const adminState = await login(admin, accounts[0]);
  if (adminState.status !== 200)
    console.log({ status: adminState.status, error: adminState.result.error });
  verify(
    adminState.status === 200 && adminState.result.user.role === "admin",
    "Admin cookie session",
  );
  verify(
    !/password|sb_secret/.test(JSON.stringify(adminState.result)),
    "response excludes passwords and secrets",
  );
  const first = await login(a, accounts[1]),
    second = await login(b, accounts[2]);
  verify(first.status === 200 && second.status === 200, "two customer logins");
  verify(
    first.result.customers.length === 1 &&
      first.result.jobs.every((j) => j.customerId === accounts[1].id),
    "customer A isolation",
  );
  verify(
    second.result.customers.length === 1 &&
      second.result.jobs.every((j) => j.customerId === accounts[2].id),
    "customer B isolation",
  );
  verify(
    first.result.jobs[0] &&
      Object.keys(first.result.jobs[0].steps).length === 15,
    "15 workflow steps persisted",
  );
  const blocked = await a("step-save", {
    jobId: second.result.jobs[0].id,
    step: "S1",
    status: "done",
    date: "",
    note: "unauthorized",
  });
  verify(blocked.status === 403, "customer cannot edit another job");
  const saved = await admin("step-save", {
    jobId: first.result.jobs[0].id,
    step: "S2",
    status: "done",
    date: "2026-10-06",
    note: "ตรวจสอบการบันทึกจากระบบจริง",
  });
  verify(saved.status === 200, "Admin updates step");
  const refreshed = await a("state");
  verify(
    refreshed.result.jobs[0].steps.S2.note === "ตรวจสอบการบันทึกจากระบบจริง",
    "customer sees server update",
  );
  const originalNote = first.result.jobs[0].steps.S2;
  await admin("step-save", {
    jobId: first.result.jobs[0].id,
    step: "S2",
    ...originalNote,
  });
  const username = `verify_${randomBytes(5).toString("hex")}`,
    password = `Original-${randomBytes(12).toString("hex")} `,
    newPassword = `Changed-${randomBytes(12).toString("hex")} `;
  const fields = {
    username,
    company: "Disposable account verification",
    contact: "",
    phone: "",
    email: "",
    active: true,
  };
  const created = await admin("account-save", { ...fields, password });
  verify(created.status === 200, "Admin creates customer");
  temporaryId = created.result.customers.find(
    (c) => c.username === username,
  )?.id;
  assert.ok(temporaryId);
  const temp = session();
  verify(
    (await temp("login", { username, password })).status === 200,
    "new customer logs in, password spaces preserved",
  );
  const duplicate = await admin("account-save", { ...fields, password });
  verify(duplicate.status === 409, "duplicate username rejected");
  const updated = await admin("account-save", {
    ...fields,
    id: temporaryId,
    username: `${username}_new`,
    company: "Updated customer",
    password: newPassword,
  });
  verify(updated.status === 200, "Admin edits customer and password");
  verify(
    (await session()("login", { username: `${username}_new`, password }))
      .status === 401,
    "old password rejected after reset",
  );
  verify(
    (
      await temp("login", {
        username: `${username}_new`,
        password: newPassword,
      })
    ).status === 200,
    "new password accepted",
  );
  await admin("account-save", {
    ...fields,
    id: temporaryId,
    username: `${username}_new`,
    password: "",
    active: false,
  });
  verify(
    (await temp("state")).status === 403,
    "disabled account loses existing session access",
  );
  verify(
    (
      await session()("login", {
        username: `${username}_new`,
        password: newPassword,
      })
    ).status === 403,
    "disabled account cannot log in",
  );
  const archived = await admin("account-archive", { id: temporaryId });
  verify(
    archived.status === 200 &&
      !archived.result.customers.some((c) => c.id === temporaryId),
    "Admin removes customer from active list",
  );
  await admin("logout", {});
  verify(
    (await admin("state")).status === 401,
    "logout invalidates cookie session",
  );
  await writeFile(
    "outputs/live-verification.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        base,
        passed: results.length,
        checks: results,
      },
      null,
      2,
    ),
  );
} finally {
  if (temporaryId) {
    const cleanup = await service.auth.admin.deleteUser(temporaryId);
    if (cleanup.error)
      console.error("Temporary verification account cleanup failed");
  }
  await new Promise((resolve) => api.close(resolve));
}
