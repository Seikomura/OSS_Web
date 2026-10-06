import { userClient, serviceClient } from "./supabase.js";
import {
  PortalError,
  PROFILE_FIELDS,
  username,
  loginEmail,
  uuid,
  text,
  newPassword,
  accountInput,
  jobInput,
  stepInput,
} from "./validation.js";
function checked(result) {
  if (result.error) {
    if (result.error.code === "23505")
      throw new PortalError("ชื่อผู้ใช้นี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น", 409);
    throw new PortalError("บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่", 502);
  }
  return result.data;
}
export async function principal(client) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new PortalError("กรุณาเข้าสู่ระบบ", 401);
  const result = await client
    .from("oss_profiles")
    .select(PROFILE_FIELDS)
    .eq("id", data.user.id)
    .single();
  const profile = result.data;
  if (result.error || !profile || !profile.active || profile.archived_at)
    throw new PortalError("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล", 403);
  return profile;
}
export function requireAdmin(profile) {
  if (profile.role !== "admin")
    throw new PortalError("เฉพาะ Admin ที่ทำรายการนี้ได้", 403);
}
export async function stateFor(client, profile) {
  const profiles = checked(
    await client
      .from("oss_profiles")
      .select(PROFILE_FIELDS)
      .eq("role", "customer")
      .is("archived_at", null)
      .order("company"),
  );
  const jobs = checked(
    await client
      .from("oss_jobs")
      .select(
        "id,customer_id,name,permit,standard,created_at,updated_at,oss_job_steps(step_id,status,date,note)",
      )
      .is("archived_at", null)
      .order("created_at"),
  );
  const visibleCustomers = new Set(profiles.map((c) => c.id));
  return {
    user: {
      id: profile.id,
      role: profile.role,
      name: profile.role === "admin" ? "Admin" : profile.company,
    },
    customers: profiles,
    jobs: jobs
      .filter((j) => visibleCustomers.has(j.customer_id))
      .map((j) => ({
        id: j.id,
        customerId: j.customer_id,
        name: j.name,
        permit: j.permit,
        standard: j.standard,
        createdAt: j.created_at,
        updatedAt: j.updated_at,
        steps: Object.fromEntries(
          j.oss_job_steps.map((s) => [
            s.step_id,
            { status: s.status, date: s.date || "", note: s.note },
          ]),
        ),
      })),
  };
}
export async function saveAccount(service, input) {
  const fields = accountInput(input),
    password = newPassword(input.password || "", !input.id);
  const duplicate = checked(
    await service
      .from("oss_profiles")
      .select("id")
      .eq("username", fields.username)
      .maybeSingle(),
  );
  if (duplicate && duplicate.id !== input.id)
    throw new PortalError("ชื่อผู้ใช้นี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น", 409);
  if (!input.id) {
    const created = await service.auth.admin.createUser({
      email: loginEmail(fields.username),
      password,
      email_confirm: true,
    });
    if (created.error)
      throw new PortalError(
        "สร้างบัญชีไม่สำเร็จ กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน",
        400,
      );
    const id = created.data.user.id;
    const result = await service
      .from("oss_profiles")
      .insert({ id, role: "customer", ...fields });
    if (result.error) {
      await service.auth.admin.deleteUser(id);
      checked(result);
    }
    return;
  }
  const id = uuid(input.id),
    old = checked(
      await service
        .from("oss_profiles")
        .select(PROFILE_FIELDS)
        .eq("id", id)
        .eq("role", "customer")
        .is("archived_at", null)
        .single(),
    );
  if (!old) throw new PortalError("ไม่พบบัญชีลูกค้า", 404);
  checked(await service.from("oss_profiles").update(fields).eq("id", id));
  const authFields = {
    email: loginEmail(fields.username),
    email_confirm: true,
    ...(password ? { password } : {}),
  };
  const updated = await service.auth.admin.updateUserById(id, authFields);
  if (updated.error) {
    const { id: oldId, role: oldRole, ...restore } = old;
    const rollback = await service
      .from("oss_profiles")
      .update(restore)
      .eq("id", id);
    if (rollback.error)
      throw new PortalError(
        "บัญชีอัปเดตได้บางส่วน กรุณาติดต่อผู้ดูแลก่อนลองใหม่",
        502,
      );
    throw new PortalError("อัปเดตบัญชีไม่สำเร็จ ข้อมูลเดิมยังคงอยู่", 502);
  }
}
export async function execute(
  op,
  client,
  profile,
  input,
  serviceFactory = serviceClient,
) {
  requireAdmin(profile);
  if (op === "account-save") {
    await saveAccount(serviceFactory(), input);
    return;
  }
  if (op === "account-archive") {
    const service = serviceFactory(),
      id = uuid(input.id);
    const result = await service
      .from("oss_profiles")
      .update({ active: false, archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("role", "customer")
      .is("archived_at", null)
      .select("id");
    if (!checked(result).length) throw new PortalError("ไม่พบบัญชีลูกค้า", 404);
    return;
  }
  if (op === "job-save") {
    const fields = jobInput(input);
    const customer = checked(
      await client
        .from("oss_profiles")
        .select("id")
        .eq("id", fields.customer_id)
        .eq("role", "customer")
        .is("archived_at", null)
        .maybeSingle(),
    );
    if (!customer) throw new PortalError("ไม่พบบัญชีลูกค้า", 404);
    if (input.id) {
      const rows = checked(
        await client
          .from("oss_jobs")
          .update(fields)
          .eq("id", uuid(input.id))
          .is("archived_at", null)
          .select("id"),
      );
      if (!rows.length) throw new PortalError("ไม่พบงาน", 404);
    } else checked(await client.from("oss_jobs").insert(fields));
    return;
  }
  if (op === "job-archive") {
    const rows = checked(
      await client
        .from("oss_jobs")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", uuid(input.id))
        .is("archived_at", null)
        .select("id"),
    );
    if (!rows.length) throw new PortalError("ไม่พบงาน", 404);
    return;
  }
  if (op === "step-save") {
    const fields = stepInput(input),
      jobId = uuid(input.jobId);
    const job = checked(
      await client
        .from("oss_jobs")
        .select("id")
        .eq("id", jobId)
        .is("archived_at", null)
        .maybeSingle(),
    );
    if (!job) throw new PortalError("ไม่พบงาน", 404);
    const rows = checked(
      await client
        .from("oss_job_steps")
        .update(fields)
        .eq("job_id", jobId)
        .eq("step_id", input.step)
        .select("step_id"),
    );
    if (!rows.length) throw new PortalError("ไม่พบขั้นตอน", 404);
    return;
  }
  throw new PortalError("ไม่พบรายการที่ต้องการ", 404);
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const op = new URL(req.url, "https://portal.invalid").searchParams.get(
      "op",
    );
    if (!["GET", "POST"].includes(req.method))
      throw new PortalError("วิธีเรียกใช้งานไม่ถูกต้อง", 405);
    if (req.method === "GET" && op !== "state")
      throw new PortalError("วิธีเรียกใช้งานไม่ถูกต้อง", 405);
    if (req.method === "POST") {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      let origin;
      try {
        origin = new URL(req.headers.origin).host;
      } catch {
        throw new PortalError("คำขอไม่ถูกต้อง", 403);
      }
      if (origin !== host) throw new PortalError("คำขอไม่ถูกต้อง", 403);
      if (!(req.headers["content-type"] || "").startsWith("application/json"))
        throw new PortalError("รูปแบบข้อมูลไม่ถูกต้อง", 415);
    }
    const input = req.body || {};
    if (
      typeof input !== "object" ||
      Array.isArray(input) ||
      JSON.stringify(input).length > 16000
    )
      throw new PortalError("ข้อมูลมีขนาดใหญ่เกินไป", 413);
    const client = userClient(req, res);
    if (op === "login") {
      const name = username(input.username),
        password = input.password;
      if (typeof password !== "string" || !password || password.length > 128)
        throw new PortalError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      const result = await client.auth.signInWithPassword({
        email: loginEmail(name),
        password,
      });
      if (result.error)
        throw new PortalError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401);
      let profile;
      try {
        profile = await principal(client);
      } catch (error) {
        await client.auth.signOut();
        throw error;
      }
      res.statusCode = 200;
      res.end(JSON.stringify(await stateFor(client, profile)));
      return;
    }
    if (op === "logout") {
      const result = await client.auth.signOut();
      if (result.error)
        throw new PortalError("ออกจากระบบไม่สำเร็จ กรุณาลองใหม่", 502);
      res.statusCode = 200;
      res.end("{}");
      return;
    }
    const profile = await principal(client);
    if (op !== "state") await execute(op, client, profile, input);
    res.statusCode = 200;
    res.end(JSON.stringify(await stateFor(client, profile)));
  } catch (error) {
    res.statusCode = error instanceof PortalError ? error.status : 500;
    res.end(
      JSON.stringify({
        error:
          error instanceof PortalError
            ? error.message
            : "ระบบขัดข้อง กรุณาลองใหม่",
      }),
    );
  }
}
