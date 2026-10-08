export class PortalError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const STEP_IDS = [
  "S1",
  "S2",
  "S3",
  "S4",
  "A1",
  "A2",
  "A3",
  "B1",
  "B2",
  "B3",
  "B4",
  "F1",
  "F2",
  "F3",
  "F4",
];
export const PROFILE_FIELDS =
  "id,role,username,company,contact,email,phone,active,archived_at";
export function text(value, max, required = false) {
  if (typeof value !== "string" || value.length > max)
    throw new PortalError("กรุณาตรวจสอบข้อมูลที่กรอก");
  const result = value.trim();
  if (required && !result) throw new PortalError("กรุณากรอกข้อมูลที่จำเป็น");
  return result;
}
export function username(value) {
  const name = text(value, 80, true).toLowerCase();
  if (!/^[a-z0-9_.-]+$/.test(name))
    throw new PortalError(
      "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง",
    );
  return name;
}
export function loginEmail(value) {
  return `${username(value)}@oss-portal.invalid`;
}
export function uuid(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new PortalError("ไม่พบรายการที่ต้องการ");
  return value;
}
export function newPassword(value, required = false) {
  if (value === "" && !required) return "";
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    throw new PortalError("รหัสผ่านใหม่ต้องมี 12–128 ตัวอักษร");
  return value;
}
export function accountInput(input) {
  const name = username(input.username);
  if (name === "admin")
    throw new PortalError("ชื่อผู้ใช้นี้สงวนไว้สำหรับ Admin");
  const email = text(input.email || "", 180);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new PortalError("กรุณากรอกอีเมลให้ถูกต้อง");
  return {
    username: name,
    company: text(input.company, 160, true),
    contact: text(input.contact || "", 100),
    email,
    phone: text(input.phone || "", 40),
    active: input.active === true,
  };
}
export function jobInput(input) {
  const permit = text(input.permit, 10, true);
  if (!["มอ.1", "มอ.3", "มอ.5"].includes(permit))
    throw new PortalError("ประเภทคำขอไม่ถูกต้อง");
  return {
    customer_id: uuid(input.customerId),
    name: text(input.name, 180, true),
    standard: text(input.standard, 100, true),
    permit,
  };
}
export function stepInput(input) {
  if (
    !STEP_IDS.includes(input.step) ||
    !["pending", "waiting", "active", "done"].includes(input.status)
  )
    throw new PortalError("ขั้นตอนหรือสถานะไม่ถูกต้อง");
  const date = input.date || null;
  if (
    date &&
    (typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date)
  )
    throw new PortalError("วันที่ไม่ถูกต้อง");
  return { status: input.status, date, note: text(input.note || "", 2000) };
}
