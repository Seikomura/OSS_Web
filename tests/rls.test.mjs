import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("database isolates clients, denies client writes, and revokes inactive accounts", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261006160840_oss_portal.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const ids = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ];
    for (const id of ids)
      await db.query("insert into auth.users values ($1)", [id]);
    for (let i = 0; i < ids.length; i++)
      await db.query(
        "insert into oss_profiles(id,role,username,company) values($1,$2,$3,$4)",
        [
          ids[i],
          i === 0 ? "admin" : "customer",
          i === 0 ? "admin" : `client${i}`,
          `Company ${i}`,
        ],
      );
    const login = async (id) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    };
    await login(ids[0]);
    for (let i = 1; i < ids.length; i++)
      await db.query(
        "insert into oss_jobs(customer_id,name,permit,standard) values($1,$2,'มอ.1','123')",
        [ids[i], `Job ${i}`],
      );
    assert.equal(
      (await db.query("select * from oss_job_steps")).rows.length,
      30,
    );
    const jobs = (await db.query("select * from oss_jobs order by name")).rows;
    await db.query(
      "update oss_job_steps set status='done' where job_id=$1 and step_id='S1'",
      [jobs[0].id],
    );
    await login(ids[1]);
    assert.equal(
      (await db.query("select username from oss_profiles")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select name from oss_jobs")).rows[0].name,
      "Job 1",
    );
    assert.equal(
      (await db.query("select * from oss_job_steps")).rows.length,
      15,
    );
    assert.equal(
      (
        await db.query("select * from oss_job_steps where job_id=$1", [
          jobs[1].id,
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update oss_job_steps set status='done' where job_id=$1 returning *",
          [jobs[1].id],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update oss_job_steps set status='done' where job_id=$1 returning *",
          [jobs[0].id],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query(
        "insert into oss_jobs(customer_id,name,permit,standard) values($1,'Injected','มอ.1','1')",
        [ids[1]],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query("update oss_profiles set role='admin' where id=$1", [ids[1]]),
      /permission denied/,
    );
    await login(ids[2]);
    assert.equal(
      (await db.query("select name from oss_jobs")).rows[0].name,
      "Job 2",
    );
    await db.exec("reset role");
    await db.query("update oss_profiles set active=false where id=$1", [
      ids[1],
    ]);
    await login(ids[1]);
    assert.equal((await db.query("select * from oss_jobs")).rows.length, 0);
    assert.equal(
      (await db.query("select * from oss_job_steps")).rows.length,
      0,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(
      db.query("select * from oss_jobs"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
