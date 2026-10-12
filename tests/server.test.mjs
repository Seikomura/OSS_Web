import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { principal, execute } from "../server/portal.js";
import {
  PortalError,
  stepInput,
  newPassword,
  accountInput,
} from "../server/validation.js";

test("authorization uses verified Auth identity and database role", async () => {
  const unauthenticated = {
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: new Error("invalid JWT"),
      }),
    },
  };
  await assert.rejects(principal(unauthenticated), (e) => e.status === 401);
  const customer = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "client", user_metadata: { role: "admin" } } },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: "client", role: "customer", active: true },
          }),
        }),
      }),
    }),
  };
  const profile = await principal(customer);
  assert.equal(profile.role, "customer");
  let privilegedCalls = 0;
  await assert.rejects(
    execute("account-save", customer, profile, {}, () => {
      privilegedCalls++;
    }),
    (e) => e.status === 403,
  );
  assert.equal(privilegedCalls, 0);
});

test("disabled or archived accounts cannot establish an application session", async () => {
  for (const profile of [
    { active: false },
    { active: true, archived_at: "2026-10-06" },
  ]) {
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: "customer" } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({ single: async () => ({ data: profile }) }),
        }),
      }),
    };
    await assert.rejects(principal(client), (e) => e.status === 403);
  }
});

test("cross-origin writes, non-JSON posts, and oversized input are rejected before auth", async () => {
  const invoke = async (req) => {
    let body;
    const res = {
      setHeader() {},
      end(value) {
        body = JSON.parse(value);
      },
    };
    await handler(
      {
        url: "/api/portal?op=account-save",
        method: "POST",
        headers: {
          host: "portal.test",
          origin: "https://portal.test",
          "content-type": "application/json",
        },
        ...req,
      },
      res,
    );
    return { status: res.statusCode, body };
  };
  assert.equal(
    (
      await invoke({
        headers: {
          host: "portal.test",
          origin: "https://attacker.test",
          "content-type": "application/json",
        },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await invoke({
        headers: {
          host: "portal.test",
          origin: "https://portal.test",
          "content-type": "text/plain",
        },
      })
    ).status,
    415,
  );
  assert.equal(
    (await invoke({ body: { note: "x".repeat(16001) } })).status,
    413,
  );
  assert.equal((await invoke({ method: "GET", body: {} })).status, 405);
});

test("invalid dates and password values return actionable errors", () => {
  for (const date of ["2026-02-30", "2026-99-01", []])
    assert.throws(
      () => stepInput({ step: "S1", status: "done", date }),
      PortalError,
    );
  assert.throws(() => newPassword("Admin1234", true), PortalError);
  assert.equal(newPassword("  valid-password  ", true), "  valid-password  ");
  assert.throws(
    () => accountInput({ username: "admin", company: "Example" }),
    PortalError,
  );
});

test("admin management operations reject customers before privileged calls", async () => {
  for (const op of ["admin-save", "admin-active"]) {
    let calls = 0;
    await assert.rejects(
      execute(op, {}, { id: "client", role: "customer" }, {}, () => {
        calls++;
      }),
      (e) => e.status === 403,
    );
    assert.equal(calls, 0);
  }
});
