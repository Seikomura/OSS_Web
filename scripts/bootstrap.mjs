import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { serviceClient } from "../server/supabase.js";
import { loginEmail } from "../server/validation.js";

const service = serviceClient();
const profiles = await service.from("oss_profiles").select("id").limit(1);
if (profiles.error)
  throw new Error("Schema unavailable: apply the migration before bootstrap.");
if (profiles.data.length)
  throw new Error(
    "Database already initialized; existing accounts are preserved.",
  );
const accounts = [];
const definitions = [
  { username: "admin", role: "admin", company: "OSS Admin" },
  {
    username: "demo_siam",
    role: "customer",
    company: "บริษัท สยามอิเล็กทริค จำกัด (ทดสอบ)",
  },
  {
    username: "demo_northstar",
    role: "customer",
    company: "บริษัท นอร์ทสตาร์ อินดัสทรี จำกัด (ทดสอบ)",
  },
];
for (const definition of definitions) {
  const password = `OSS-${randomBytes(15).toString("base64url")}`;
  const { data, error } = await service.auth.admin.createUser({
    email: loginEmail(definition.username),
    password,
    email_confirm: true,
  });
  if (error)
    throw new Error(
      `Could not create ${definition.username}: ${error.message}`,
    );
  const inserted = await service
    .from("oss_profiles")
    .insert({ id: data.user.id, ...definition });
  if (inserted.error) {
    await service.auth.admin.deleteUser(data.user.id);
    throw new Error(`Could not save ${definition.username}`);
  }
  accounts.push({ ...definition, id: data.user.id, password });
  // Save after each account so a later failure cannot lose initial credentials.
  await mkdir("outputs", { recursive: true });
  await writeFile(
    "outputs/initial-access.json",
    JSON.stringify(accounts, null, 2),
    { mode: 0o600 },
  );
  await writeFile(
    "outputs/initial-access.txt",
    accounts
      .map(
        (a) =>
          `${a.company}\nชื่อผู้ใช้: ${a.username}\nรหัสผ่านเริ่มต้น: ${a.password}\n`,
      )
      .join("\n") +
      "\nบัญชีนี้ใช้ฐานข้อมูล Supabase จริง กรุณาเก็บไฟล์นี้เป็นส่วนตัว\n",
    { mode: 0o600 },
  );
}
for (let i = 1; i < accounts.length; i++) {
  const { data, error } = await service
    .from("oss_jobs")
    .insert({
      customer_id: accounts[i].id,
      name:
        i === 1
          ? "สายไฟฟ้าหุ้มฉนวน PVC (งานตัวอย่าง)"
          : "อุปกรณ์ไฟฟ้านำเข้า (งานตัวอย่าง)",
      permit: i === 1 ? "มอ.1" : "มอ.5",
      standard: i === 1 ? "มอก.11 เล่ม 3" : "มอก.166-2549",
    })
    .select("id")
    .single();
  if (error) throw new Error("Sample job creation failed");
  for (const [step_id, status] of [
    ["S1", "done"],
    ["S2", "done"],
    ["S3", i === 1 ? "done" : "waiting"],
    ["S4", i === 1 ? "done" : "pending"],
    ["A1", i === 1 ? "done" : "pending"],
    ["A2", i === 1 ? "active" : "pending"],
    ["B1", i === 1 ? "done" : "pending"],
    ["B2", i === 1 ? "waiting" : "pending"],
  ]) {
    const updated = await service
      .from("oss_job_steps")
      .update({
        status,
        note:
          status === "waiting"
            ? "รอข้อมูลเพิ่มเติมจากลูกค้า (ตัวอย่าง)"
            : status === "active"
              ? "ทีมงานกำลังดำเนินการ (ตัวอย่าง)"
              : "",
        date: status === "done" ? "2026-10-06" : null,
      })
      .eq("job_id", data.id)
      .eq("step_id", step_id);
    if (updated.error) throw new Error("Sample status update failed");
  }
}
console.log(
  "Initialized Admin, two test customers, and two sample jobs. Credentials saved privately to outputs/initial-access.txt.",
);
