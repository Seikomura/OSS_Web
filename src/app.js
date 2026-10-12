import {
  STATUS,
  STEPS,
  LINES,
  stepTitle,
  progress,
  blankSteps,
  visibleJobs,
} from "./data.js";
import { request, ApiError } from "./api.js";

const root = document.getElementById("app");
let previewAdmin = null;
let state,
  user = null,
  adminPreview = false,
  route = "overview",
  jobId = null,
  stepId = null,
  customerFilter = "",
  query = "",
  storageError = false,
  toastTimer;
const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  route:
    '<circle cx="6" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="M6 8v5h12v3"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  building:
    '<path d="M4 21V5l8-3 8 3v16M8 8h1m6 0h1M8 12h1m6 0h1M10 21v-5h4v5M2 21h20"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6zM14 5l5 5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6"/>',
};
const icon = (name) =>
  `<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.route}</svg></span>`;
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const date = (v) =>
  v
    ? new Date(v.length === 10 ? v + "T12:00:00+07:00" : v).toLocaleDateString(
        "th-TH",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Bangkok",
        },
      )
    : "ยังไม่ระบุวันที่";
const badge = (status) =>
  `<span class="status ${status}">${esc(STATUS[status]?.icon)} ${esc(STATUS[status]?.label)}</span>`;
const brand = () =>
  `<div class="brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M7 5v13h18v9" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="7" cy="5" r="3" fill="currentColor"/><circle cx="25" cy="27" r="3" fill="currentColor"/></svg></span><span>OSS<span style="font-weight:400;color:#92adbe"> / </span>Client Portal</span></div>`;
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}
function currentJobs() {
  return visibleJobs(state, user);
}
function currentJob() {
  return currentJobs().find((j) => j.id === jobId);
}
function customerFor(job) {
  return state.customers.find((c) => c.id === job.customerId);
}
function setSession() {}
function clearSession() {}
function jobStatus(job) {
  if (progress(job).done === STEPS.length) return "done";
  if (STEPS.some((s) => job.steps[s.id].status === "active")) return "active";
  if (STEPS.some((s) => job.steps[s.id].status === "waiting")) return "waiting";
  return "pending";
}
function activeNames(job) {
  const names = STEPS.filter((s) => job.steps[s.id].status === "active").map(
    (s) => stepTitle(s, job),
  );
  return names.length
    ? names.join(" · ")
    : jobStatus(job) === "done"
      ? "รับใบอนุญาตแล้ว"
      : "รอ Admin อัปเดตสถานะ";
}
function progressInline(job) {
  const p = progress(job);
  return `<div class="progress-inline"><div><span>${p.done}/${p.total} ขั้นตอน</span><b>${p.percent}%</b></div><div class="progress-bar"><i style="width:${p.percent}%"></i></div></div>`;
}
function pageHead(title, description, action = "") {
  return `<div class="page-head"><div><div class="eyebrow">${user.role === "admin" ? "ADMIN WORKSPACE" : "YOUR WORKSPACE"}</div><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}

function login(message = "") {
  root.innerHTML = `<main class="login"><section class="login-brand">${brand()}<div><div class="eyebrow" style="color:#72cdbc">CUSTOMER WORK TRACKING</div><h1>ทุกขั้นตอนของงาน<br>อยู่ในเส้นทางเดียวกัน</h1><p>ติดตามงานขออนุญาต มอก. ดูความคืบหน้าของโรงงานและการทดสอบ พร้อมรายละเอียดจากทีมดูแลของคุณ</p><div class="login-visual"><div class="mini-station">เตรียมคำขอ <span>เอกสารครบถ้วน</span></div><div class="mini-station">โรงงาน & Lab <span>ดำเนินการคู่ขนาน</span></div><div class="mini-station">รับใบอนุญาต <span>ปลายทางของงาน</span></div></div></div><footer class="small" style="color:#7290a3">OSS Client Portal · ติดตามงานขออนุญาต</footer></section><section class="login-form-side"><div class="login-box"><span class="pill">OSS CLIENT PORTAL</span><h2>เข้าสู่ระบบ</h2><p class="muted small">ใช้ชื่อผู้ใช้และรหัสผ่านที่ผู้ดูแลกำหนดให้</p><form id="login-form"><label class="form-field">ชื่อผู้ใช้<input name="username" autocomplete="username" required placeholder="กรอกชื่อผู้ใช้" maxlength="80"></label><label class="form-field">รหัสผ่าน<div class="password-wrap"><input id="login-password" type="password" name="password" autocomplete="current-password" required placeholder="กรอกรหัสผ่าน"><button type="button" data-action="toggle-password" aria-label="แสดงรหัสผ่าน">แสดง</button></div></label><div id="login-error" role="alert">${message ? `<p class="error">${esc(message)}</p>` : ""}</div><button class="btn primary full" type="submit">เข้าสู่ระบบ</button></form><p class="login-foot">หากไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลบัญชีของคุณ</p></div></section></main>`;
}
function render() {
  if (!user) {
    login();
    return;
  }
  if (user.role !== "admin") {
    const c = state.customers.find((c) => c.id === user.id);
    if (!c || !c.active) {
      logout("บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแล");
      return;
    }
    user = { id: c.id, role: "customer", name: c.company };
  }
  const isAdmin = user.role === "admin";
  const routes = isAdmin
    ? [
        ["overview", "ภาพรวม", "grid"],
        ["jobs", "งานทั้งหมด", "route"],
        ["customers", "บัญชีลูกค้า", "users"],
        ["admins", "ผู้ดูแลระบบ", "users"],
      ]
    : [["tracking", "ติดตามงาน", "route"]];
  const routeName =
    route === "tracking"
      ? "ติดตามงาน"
      : routes.find((r) => r[0] === route)?.[1] || "ภาพรวม";
  root.innerHTML = `<div class="shell"><aside class="sidebar">${brand()}<div class="side-label">${isAdmin ? "การจัดการ" : "พื้นที่ลูกค้า"}</div><nav class="side-nav" aria-label="เมนูหลัก">${routes.map(([id, name, ic]) => `<button class="nav-item ${route === id ? "selected" : ""}" data-action="navigate" data-route="${id}" ${route === id ? 'aria-current="page"' : ""}>${icon(ic)}${name}</button>`).join("")}</nav><div class="side-bottom"><span class="pill">OSS CLIENT PORTAL</span><p>ข้อมูลอัปเดตโดยทีมดูแล<br>สำหรับงานของบริษัทคุณ</p></div></aside><div class="main"><header class="topbar"><div class="breadcrumb">${isAdmin ? "ผู้ดูแลระบบ" : "พื้นที่ลูกค้า"}<span>/</span><strong>${routeName}</strong></div><div class="user-controls"><span class="avatar">${isAdmin ? "A" : esc(user.name.slice(0, 1))}</span><div class="user-meta">${esc(user.name)}<small>${isAdmin ? "ผู้ดูแลระบบ" : "บัญชีลูกค้า"}</small></div><button class="logout" data-action="logout">ออกจากระบบ</button></div></header><div class="demo-strip">ติดตามงานขออนุญาต มอก. · ข้อมูลล่าสุดจากทีมดูแล</div>${adminPreview ? `<div class="preview-banner"><span>${icon("eye")} กำลังดูในมุมมองลูกค้า — ${esc(user.name)}</span><button class="btn compact" data-action="return-admin">กลับหน้า Admin</button></div>` : ""}<main class="content ${route === "tracking" ? "tracking-page" : ""}">${storageError ? '<p class="error">เบราว์เซอร์ไม่อนุญาตให้บันทึกข้อมูล การเปลี่ยนแปลงจะไม่ถูกจัดเก็บ</p>' : ""}${route === "tracking" ? tracking() : route === "admins" ? adminsPage() : route === "customers" ? customers() : route === "jobs" ? jobsPage() : overview()}</main></div></div>`;
  if (!isAdmin) root.querySelector('[data-action="reset-demo"]')?.remove();
  if (route === "tracking") {
    root
      .querySelector(".detail-panel .panel-head")
      ?.insertAdjacentHTML(
        "beforeend",
        '<button class="btn compact back-map" data-action="back-map">กลับแผนที่</button>',
      );
    requestAnimationFrame(drawTracks);
  }
}
function overview() {
  const jobs = state.jobs,
    done = jobs.filter((j) => jobStatus(j) === "done").length,
    active = jobs.filter((j) => jobStatus(j) === "active").length;
  return `${pageHead("ภาพรวมงานลูกค้า", "ติดตามความคืบหน้าและจัดการงานทั้งหมดในที่เดียว", `<button class="btn primary" data-action="new-job">${icon("plus")}เพิ่มงานใหม่</button>`)}<section class="stats" aria-label="สรุปงาน">${[
    ["บัญชีลูกค้า", state.customers.length, "บริษัทในระบบ", "users"],
    ["งานทั้งหมด", jobs.length, "งานขออนุญาต", "file"],
    ["กำลังดำเนินการ", active, "งานที่มีขั้นตอนกำลังดำเนินการ", "clock"],
    ["เสร็จสมบูรณ์", done, "ได้รับใบอนุญาตแล้ว", "check"],
  ]
    .map(
      ([label, num, note, ic]) =>
        `<div class="panel stat"><div class="stat-label">${icon(ic)}${label}</div><div class="stat-number">${num}</div><div class="stat-note">${note}</div></div>`,
    )
    .join(
      "",
    )}</section><div class="panel intro-card"><div><h2>อัปเดตขั้นตอน แล้วลูกค้าเห็นความคืบหน้า</h2><p>เปิดงานเพื่อเปลี่ยนสถานะ วันที่ และหมายเหตุของแต่ละขั้นตอน</p></div><button class="btn" data-action="navigate" data-route="customers">${icon("users")}จัดการบัญชีลูกค้า</button></div><section class="panel"><div class="panel-head"><h2>งานที่อยู่ระหว่างดำเนินการ</h2><button class="btn text" data-action="navigate" data-route="jobs">ดูงานทั้งหมด</button></div>${jobsTable(jobs.filter((j) => jobStatus(j) !== "done"))}</section><p class="page-note">โรงงานและ Lab ดำเนินการคู่ขนานกันได้ เปอร์เซ็นต์แสดงสัดส่วนขั้นตอนที่เสร็จแล้วจากทั้งหมด 15 ขั้นตอน</p>`;
}
function jobsTable(jobs) {
  if (!jobs.length)
    return '<div class="empty"><h3>ยังไม่มีงานในรายการนี้</h3><p>เพิ่มงานใหม่ หรือเลือกบริษัทอื่นเพื่อดูงาน</p></div>';
  return `<div class="table-scroll"><table><thead><tr><th>งาน / บริษัทลูกค้า</th><th>การขออนุญาต</th><th>สถานะ</th><th>ความคืบหน้า</th><th>จัดการ</th></tr></thead><tbody>${jobs.map((j) => `<tr><td><button class="row-link" data-action="open-job" data-id="${esc(j.id)}"><strong>${esc(j.name)}</strong></button><small>${esc(customerFor(j)?.company || "ไม่พบบัญชีลูกค้า")}</small></td><td>${esc(j.permit)}<small>${esc(j.standard)}</small></td><td>${badge(jobStatus(j))}</td><td>${progressInline(j)}</td><td><div class="table-actions"><button class="btn compact" data-action="open-job" data-id="${esc(j.id)}">อัปเดตสถานะ</button><button class="btn compact" data-action="edit-job" data-id="${esc(j.id)}" aria-label="แก้ไขข้อมูล ${esc(j.name)}">${icon("edit")}</button></div></td></tr>`).join("")}</tbody></table></div>`;
}
function jobsPage() {
  const jobs = state.jobs.filter(
    (j) =>
      (!customerFilter || j.customerId === customerFilter) &&
      (!query ||
        [j.name, j.standard, customerFor(j)?.company]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  return `${pageHead("งานทั้งหมด", "จัดการงานขออนุญาตและอัปเดตความคืบหน้า", `<button class="btn primary" data-action="new-job">${icon("plus")}เพิ่มงานใหม่</button>`)}<div class="filter-bar"><label><span class="sr-only">กรองบริษัทลูกค้า</span><select id="customer-filter"><option value="">ทุกบริษัท (${state.jobs.length} งาน)</option>${state.customers.map((c) => `<option value="${esc(c.id)}" ${customerFilter === c.id ? "selected" : ""}>${esc(c.company)}</option>`).join("")}</select></label><div class="search-wrap"><label class="sr-only" for="job-search">ค้นหางาน</label><input id="job-search" placeholder="ค้นหางานหรือมาตรฐาน" value="${esc(query)}"></div></div><section class="panel"><div class="panel-head"><h2>รายการงาน</h2><span class="account-count">${jobs.length} งาน</span></div>${jobsTable(jobs)}</section>`;
}
function adminsPage() {
  const admins = state.admins || [];
  return `${pageHead("ผู้ดูแลระบบ", "จัดการทีมที่ดูแลบัญชีลูกค้าและความคืบหน้างาน", `<button class="btn primary" data-action="new-admin">${icon("plus")}เพิ่มผู้ดูแล</button>`)}<div class="admin-summary"><div><span class="eyebrow">TEAM ACCESS</span><h2>ทีมดูแลของคุณ</h2><p>ผู้ดูแลที่เปิดใช้งานสามารถจัดการลูกค้า งาน และผู้ดูแลระบบได้</p></div><div class="team-count"><b>${admins.filter((a) => a.active).length}</b><span>ผู้ดูแลที่ใช้งาน</span></div></div><section class="admin-grid">${admins.map((a) => `<article class="panel admin-card"><div class="admin-card-top"><span class="admin-avatar">${esc(a.company.slice(0, 1))}</span><span class="status ${a.active ? "done" : "waiting"}">${a.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span></div><h2>${esc(a.company)}</h2><p class="admin-username">@${esc(a.username)} ${a.id === user.id ? '<span class="pill">บัญชีของคุณ</span>' : ""}</p><div class="admin-permissions">${icon("check")} จัดการลูกค้าและงานทั้งหมด</div><div class="admin-card-actions"><button class="btn" data-action="edit-admin" data-id="${esc(a.id)}">แก้ไข / รหัสผ่าน</button><button class="btn ${a.active ? "danger" : ""}" data-action="toggle-admin" data-id="${esc(a.id)}" ${a.id === user.id ? "disabled" : ""}>${a.active ? "ปิดบัญชี" : "เปิดบัญชี"}</button></div></article>`).join("")}</section><p class="page-note">ป้องกันการปิดบัญชีที่คุณใช้อยู่และผู้ดูแลคนสุดท้าย · การปิดบัญชีเก็บข้อมูลไว้และเปิดใหม่ได้</p>`;
}
function adminModal(id) {
  const a = (state.admins || []).find((a) => a.id === id) || {};
  modal(
    id ? "แก้ไขผู้ดูแลระบบ" : "เพิ่มผู้ดูแลระบบ",
    `<input type="hidden" name="id" value="${esc(id || "")}"><label class="form-field">ชื่อผู้ดูแล<input name="company" required maxlength="160" value="${esc(a.company || "")}" placeholder="ชื่อผู้ดูแลหรือทีม"></label><label class="form-field">ชื่อผู้ใช้<input name="username" required maxlength="80" pattern="(?:[A-Za-z0-9_.]|-)+" value="${esc(a.username || "")}" ${id ? "readonly" : ""} autocomplete="off"></label><label class="form-field">${id ? "รหัสผ่านใหม่ (เว้นว่างเพื่อใช้เดิม)" : "รหัสผ่าน"}<input name="password" type="password" ${id ? "" : "required"} minlength="12" maxlength="128" autocomplete="new-password" placeholder="อย่างน้อย 12 ตัวอักษร"></label><p class="notice">บัญชีนี้มีสิทธิ์จัดการลูกค้า งาน และผู้ดูแลระบบทั้งหมด รหัสผ่านเดิมจะไม่แสดงในระบบ</p>`,
    `${cancelButton}<button class="btn primary" type="submit">บันทึกผู้ดูแล</button>`,
    "admin-form",
  );
}
function customers() {
  return `${pageHead("บัญชีลูกค้า", "จัดการข้อมูลบริษัท บัญชีเข้าใช้ และรหัสผ่าน", `<button class="btn primary" data-action="new-customer">${icon("plus")}เพิ่มลูกค้า</button>`)}<section class="panel"><div class="panel-head"><h2>บริษัทลูกค้า</h2><span class="account-count">${state.customers.length} บัญชี</span></div>${!state.customers.length ? '<div class="empty"><h3>ยังไม่มีบัญชีลูกค้า</h3><p>เพิ่มลูกค้าเพื่อเริ่มสร้างงานขออนุญาต</p></div>' : `<div class="table-scroll"><table><thead><tr><th>บริษัท / ผู้ติดต่อ</th><th>ชื่อผู้ใช้</th><th>งาน</th><th>บัญชี</th><th>จัดการ</th></tr></thead><tbody>${state.customers.map((c) => `<tr><td><strong>${esc(c.company)}</strong><small>${esc(c.contact)} · ${esc(c.email)}</small></td><td>${esc(c.username)}</td><td>${state.jobs.filter((j) => j.customerId === c.id).length} งาน</td><td><span class="status ${c.active ? "done" : "waiting"}">${c.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span></td><td><div class="table-actions"><button class="btn compact" data-action="edit-customer" data-id="${esc(c.id)}">แก้ไข / รหัสผ่าน</button><button class="btn compact" data-action="preview-customer" data-id="${esc(c.id)}" ${!c.active ? "disabled" : ""} aria-label="ดูมุมมองลูกค้า ${esc(c.company)}">${icon("eye")}</button><button class="btn compact danger" data-action="delete-customer" data-id="${esc(c.id)}">ลบ</button></div></td></tr>`).join("")}</tbody></table></div>`}</section><p class="page-note">ตั้งรหัสผ่านใหม่ได้จาก “แก้ไข / รหัสผ่าน” · การปิดใช้งานเก็บข้อมูลและงานเดิมไว้</p>`;
}

function station(s, job) {
  const data = job.steps[s.id];
  return `<button class="station ${data.status} ${s.id === stepId ? "chosen" : ""}" data-action="select-step" data-step="${s.id}" style="--line:${LINES[s.line].color}" aria-pressed="${s.id === stepId}" aria-label="${esc(s.id + " " + stepTitle(s, job) + " " + STATUS[data.status].label)}"><span class="node" data-node="${s.id}">${data.status === "done" ? "✓" : data.status === "waiting" ? "◷" : ""}</span><span class="station-info"><span class="station-name"><span class="station-id">${s.id}</span>${esc(stepTitle(s, job))}</span><span class="station-state" style="display:block">${STATUS[data.status].label}</span>${data.date ? `<span class="station-date" style="display:block">${date(data.date)}</span>` : ""}</span></button>`;
}
function routeGroup(line, job, letter, column = false) {
  return `<section class="route-group ${column ? "branch" : ""}" style="--line:${LINES[line].color}" aria-label="${LINES[line].label}"><h3 class="route-title"><b>${letter}</b>${LINES[line].label}</h3><div class="${column ? "station-column" : "station-row"}">${STEPS.filter(
    (s) => s.line === line,
  )
    .map((s) => station(s, job))
    .join("")}</div></section>`;
}
function tracking() {
  const jobs = currentJobs();
  if (!jobs.length)
    return `${pageHead("ติดตามงาน", "รายละเอียดงานขออนุญาตของคุณ")}<div class="panel empty"><h3>ยังไม่มีงานขออนุญาต</h3><p>เมื่อผู้ดูแลเพิ่มงานแล้ว ความคืบหน้าจะแสดงที่นี่</p>${user.role === "admin" ? '<button class="btn primary" data-action="new-job" style="margin-top:18px">เพิ่มงานใหม่</button>' : ""}</div>`;
  if (!jobs.some((j) => j.id === jobId)) jobId = jobs[0].id;
  const job = currentJob(),
    customer = customerFor(job);
  if (!STEPS.some((s) => s.id === stepId))
    stepId = STEPS.find((s) => job.steps[s.id].status === "active")?.id || "S1";
  const p = progress(job);
  return `${pageHead(user.role === "admin" ? "อัปเดตสถานะงาน" : "ติดตามงานของคุณ", user.role === "admin" ? "เลือกขั้นตอนเพื่อแก้ไขสถานะ วันที่ และหมายเหตุ" : "ดูเส้นทางความคืบหน้าของงานขออนุญาต", user.role === "admin" ? `<button class="btn" data-action="edit-job" data-id="${job.id}">${icon("edit")}แก้ไขข้อมูลงาน</button>` : "")}<div class="job-switch"><label for="job-select">เลือกงาน</label><select id="job-select">${jobs.map((j) => `<option value="${esc(j.id)}" ${j.id === jobId ? "selected" : ""}>${esc(j.name)}${user.role === "admin" ? " · " + esc(customerFor(j)?.company) : ""}</option>`).join("")}</select><span class="small muted">${jobs.length} งาน${user.role === "admin" ? "ในระบบ" : "ของคุณ"}</span></div><div class="tracking-summary"><section class="panel customer-card"><div class="tracking-job-name"><span class="eyebrow">งานขออนุญาต</span><h2>${esc(job.name)}</h2></div><div class="company-title"><div class="avatar">${icon("building")}</div><div><h2>${esc(customer.company)}</h2><p>ผู้ติดต่อ ${esc(customer.contact || "ยังไม่ระบุ")}</p></div></div><div><div class="detail-label">การขออนุญาต</div><div class="detail-value">${esc(job.permit)}</div></div><div><div class="detail-label">มาตรฐานอุตสาหกรรม</div><div class="detail-value">${esc(job.standard)}</div></div></section><section class="panel progress-banner"><div class="progress-ring" style="--progress:${p.percent}%" role="img" aria-label="ความคืบหน้า ${p.percent} เปอร์เซ็นต์"><div class="big-progress">${p.percent}<small>%</small></div></div><div class="progress-text"><p><strong>เสร็จแล้ว ${p.done} จาก ${p.total} ขั้นตอน</strong> · ${esc(STATUS[jobStatus(job)].label)}</p><div class="progress-bar"><i style="width:${p.percent}%"></i></div></div><div class="progress-meta">อัปเดตล่าสุด ${date(job.updatedAt)}</div></section></div><div class="tracking-layout"><section class="panel map-panel"><div class="panel-head"><div><h2>แผนที่ความคืบหน้า</h2><p>กดขั้นตอนเพื่อดูรายละเอียด</p></div><span class="pill">${esc(job.permit)}</span></div><div class="legend" aria-label="คำอธิบายสถานะ"><span><i class="legend-circle done"></i>เสร็จแล้ว</span><span><i class="legend-circle active"></i>กำลังดำเนินการ</span><span><i class="legend-circle waiting"></i>รอ</span><span><i class="legend-circle"></i>ยังไม่เริ่ม</span></div><div class="metro" id="metro"><svg class="track-svg" aria-hidden="true"></svg>${routeGroup("prepare", job, "S")}<div class="branches">${routeGroup("factory", job, "A", true)}${routeGroup("lab", job, "B", true)}</div><p class="transfer-caption">สองเส้นทางรวมที่ขั้นตอนยื่นคำขอ</p>${routeGroup("permit", job, "F")}</div></section><aside class="panel detail-panel" id="step-details">${stepDetails(job)}</aside></div><p class="page-note">สีเทาแสดงขั้นตอนที่รอหรือยังไม่เริ่ม · เปอร์เซ็นต์คำนวณจากจำนวนขั้นตอนที่เสร็จแล้ว โรงงานและ Lab สามารถดำเนินการคู่ขนานกันได้</p>`;
}
function stepDetails(job) {
  const s = STEPS.find((s) => s.id === stepId) || STEPS[0],
    d = job.steps[s.id],
    isAdmin = user.role === "admin";
  return `<div class="panel-head"><h2>${isAdmin ? "อัปเดตขั้นตอน" : "รายละเอียดขั้นตอน"}</h2>${icon(isAdmin ? "edit" : "file")}</div><div class="panel-body"><div><span class="step-code" style="color:${LINES[s.line].color}">${s.id} · ${esc(LINES[s.line].label)}</span><h3 class="step-detail-title">${esc(stepTitle(s, job))}</h3>${badge(d.status)}${!isAdmin ? `<div class="step-detail-meta"><div class="detail-label">วันที่ดำเนินการ</div><p>${date(d.date)}</p></div><div class="step-detail-meta"><div class="detail-label">หมายเหตุจากผู้ดูแล</div><p>${esc(d.note || "ยังไม่มีหมายเหตุสำหรับขั้นตอนนี้")}</p></div><p class="tip">ทีมดูแลจะอัปเดตความคืบหน้าให้คุณเมื่อมีการเปลี่ยนแปลง</p>` : '<p class="tip">ข้อมูลที่บันทึกจะแสดงในมุมมองลูกค้าของงานนี้</p>'}</div>${
    isAdmin
      ? `<form id="step-form"><input type="hidden" name="step" value="${s.id}"><label class="form-field">สถานะ<select name="status">${Object.entries(
          STATUS,
        )
          .map(
            ([key, v]) =>
              `<option value="${key}" ${d.status === key ? "selected" : ""}>${v.label}</option>`,
          )
          .join(
            "",
          )}</select></label><label class="form-field">วันที่ดำเนินการ<input type="date" name="date" value="${esc(d.date)}"></label><label class="form-field">หมายเหตุสำหรับลูกค้า<textarea name="note" maxlength="2000" placeholder="เช่น นัดตรวจโรงงาน หรือรอผลทดสอบ">${esc(d.note)}</textarea></label><button class="btn primary full" type="submit">บันทึกสถานะ</button></form>`
      : ""
  }</div>`;
}
function drawTracks() {
  const map = document.getElementById("metro");
  if (!map || !user) return;
  const job = currentJob();
  if (!job) return;
  const svg = map.querySelector("svg.track-svg"),
    rect = map.getBoundingClientRect();
  const point = (id) => {
    const n = map.querySelector(`[data-node="${id}"]`);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - rect.left,
      y: r.top + r.height / 2 - rect.top,
    };
  };
  const paths = [];
  function edge(from, to, line, kind = "straight") {
    const a = point(from),
      b = point(to);
    if (!a || !b) return;
    let d;
    if (kind === "split") {
      const y = Math.min(point("A1").y, point("B1").y) - 33;
      d = `M${a.x},${a.y} H${rect.width - 8} V${y} H${b.x} V${b.y}`;
    } else if (kind === "merge") {
      const y = Math.max(point("A3").y, point("B4").y) + 52;
      d = `M${a.x},${a.y} V${y} H8 V${b.y} H${b.x}`;
    } else d = `M${a.x},${a.y} L${b.x},${b.y}`;
    const st = job.steps[to].status;
    const colored =
      ["done", "active"].includes(st) && job.steps[from].status === "done";
    paths.push(
      `<path d="${d}" fill="none" stroke="${colored ? LINES[line].color : "#dce3e9"}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" ${st === "waiting" ? 'stroke-dasharray="5 7"' : ""}/>`,
    );
  }
  [
    ["S1", "S2"],
    ["S2", "S3"],
    ["S3", "S4"],
  ].forEach(([a, b]) => edge(a, b, "prepare"));
  edge("S4", "A1", "factory", "split");
  edge("S4", "B1", "lab", "split");
  [
    ["A1", "A2"],
    ["A2", "A3"],
  ].forEach(([a, b]) => edge(a, b, "factory"));
  [
    ["B1", "B2"],
    ["B2", "B3"],
    ["B3", "B4"],
  ].forEach(([a, b]) => edge(a, b, "lab"));
  edge("A3", "F1", "factory", "merge");
  edge("B4", "F1", "lab", "merge");
  [
    ["F1", "F2"],
    ["F2", "F3"],
    ["F3", "F4"],
  ].forEach(([a, b]) => edge(a, b, "permit"));
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  svg.innerHTML = paths.join("");
}

function modal(title, body, footer, formId = "") {
  document.querySelector("dialog")?.remove();
  const el = document.createElement("dialog");
  el.className = "dialog";
  el.setAttribute("aria-labelledby", "dialog-title");
  el.innerHTML = `${formId ? `<form id="${formId}">` : ""}<header class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="close" type="button" data-action="close-modal" aria-label="ปิดหน้าต่าง">×</button></header><div class="dialog-body">${body}<div id="form-error" role="alert"></div></div><footer class="dialog-footer">${footer}</footer>${formId ? "</form>" : ""}`;
  document.body.append(el);
  el.showModal();
}
const cancelButton =
  '<button class="btn" type="button" data-action="close-modal">ยกเลิก</button>';
function customerModal(id) {
  if (user.role !== "admin") return;
  const c = state.customers.find((c) => c.id === id) || {};
  modal(
    id ? "แก้ไขบัญชีลูกค้า" : "เพิ่มบัญชีลูกค้า",
    `<input type="hidden" name="id" value="${esc(id || "")}"><div class="form-grid"><label class="form-field wide">ชื่อบริษัท<input name="company" required maxlength="160" value="${esc(c.company || "")}" placeholder="บริษัท ... จำกัด"></label><label class="form-field">ผู้ติดต่อ<input name="contact" maxlength="100" value="${esc(c.contact || "")}"></label><label class="form-field">เบอร์โทร<input name="phone" type="tel" maxlength="40" value="${esc(c.phone || "")}"></label><label class="form-field wide">อีเมล<input name="email" type="email" maxlength="180" value="${esc(c.email || "")}"></label><label class="form-field">ชื่อผู้ใช้<input name="username" required pattern="(?:[A-Za-z0-9_.]|-)+" title="ใช้ตัวอักษรภาษาอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง" maxlength="80" value="${esc(c.username || "")}" autocomplete="off"></label><div class="form-field wide"><label for="customer-new-password">${id ? "รหัสผ่านใหม่ (เว้นว่างเพื่อใช้เดิม)" : "รหัสผ่าน"}</label><div class="password-wrap"><input id="customer-new-password" name="password" type="password" ${id ? "" : "required"} minlength="12" maxlength="128" autocomplete="new-password" placeholder="อย่างน้อย 12 ตัวอักษร"><button type="button" data-action="customer-password" data-target="customer-new-password" aria-label="แสดงรหัสผ่านใหม่" aria-pressed="false">แสดง</button></div></div></div><label class="checkbox"><input type="checkbox" name="active" ${c.active !== false ? "checked" : ""}>เปิดใช้งานบัญชี</label><div class="notice">รหัสผ่านเก็บผ่านระบบ Login ตั้งรหัสผ่านใหม่ได้โดยไม่แสดงรหัสผ่านเดิม</div>`,
    `${cancelButton}<button class="btn primary" type="submit">บันทึกบัญชี</button>`,
    "customer-form",
  );
}
function jobModal(id) {
  if (user.role !== "admin") return;
  if (!state.customers.length) {
    toast("เพิ่มบัญชีลูกค้าก่อนสร้างงาน");
    customerModal();
    return;
  }
  const j = state.jobs.find((j) => j.id === id) || {};
  modal(
    id ? "แก้ไขข้อมูลงาน" : "เพิ่มงานขออนุญาต",
    `<input type="hidden" name="id" value="${esc(id || "")}"><label class="form-field">บริษัทลูกค้า<select name="customerId" required>${state.customers.map((c) => `<option value="${esc(c.id)}" ${j.customerId === c.id ? "selected" : ""}>${esc(c.company)}</option>`).join("")}</select></label><label class="form-field">ชื่องาน / ผลิตภัณฑ์<input name="name" required maxlength="180" value="${esc(j.name || "")}" placeholder="เช่น สายไฟฟ้าหุ้มฉนวน PVC"></label><div class="form-grid"><label class="form-field">การขออนุญาต<select name="permit">${["มอ.1", "มอ.3", "มอ.5"].map((p) => `<option ${j.permit === p ? "selected" : ""}>${p}</option>`).join("")}</select></label><label class="form-field">มาตรฐานอุตสาหกรรม<input name="standard" required maxlength="100" value="${esc(j.standard || "")}" placeholder="เช่น มอก.11 เล่ม 3"></label></div><div class="notice">${id ? "เปลี่ยนข้อมูลได้โดยสถานะทั้ง 15 ขั้นตอนยังคงเดิม" : "งานใหม่จะเริ่มจากสถานะ “ยังไม่เริ่ม” ทั้ง 15 ขั้นตอน"}<p>มอ.5 จะแสดงขั้นตอน B2 ว่า “อยู่ระหว่างนำเข้า”</p></div>`,
    `${id ? `<button class="btn danger" type="button" data-action="delete-job" data-id="${esc(id)}">ลบงาน</button>` : ""}${cancelButton}<button class="btn primary" type="submit">บันทึกงาน</button>`,
    "job-form",
  );
}
function confirmDelete(type, id) {
  if (user.role !== "admin") return;
  const isCustomer = type === "customer",
    item = isCustomer
      ? state.customers.find((c) => c.id === id)
      : state.jobs.find((j) => j.id === id);
  if (!item) return;
  const count = isCustomer
    ? state.jobs.filter((j) => j.customerId === id).length
    : 0;
  modal(
    isCustomer ? "ลบบัญชีลูกค้า" : "ลบงาน",
    `<p style="line-height:1.9">ต้องการลบ <strong>${esc(item.company || item.name)}</strong> ${isCustomer ? `พร้อมงาน ${count} รายการของลูกค้ารายนี้` : ""}?</p><p class="tip">การนำออกจะปิดบัญชีหรือซ่อนงานจากรายการ ข้อมูลยังเก็บไว้เพื่อให้ผู้ดูแลกู้คืนได้</p>`,
    `${cancelButton}<button class="btn danger" data-action="confirm-delete" data-type="${type}" data-id="${esc(id)}">ยืนยันการลบ</button>`,
  );
}
function closeModal() {
  const el = document.querySelector("dialog");
  el?.close();
  el?.remove();
}
async function logout(message = "") {
  try {
    await request("logout", {});
  } catch (error) {
    toast(error.message);
    return;
  }
  user = null;
  adminPreview = false;
  route = "overview";
  jobId = null;
  stepId = null;
  state = { customers: [], jobs: [] };
  login(message);
}

document.addEventListener("click", async (e) => {
  const button = e.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "toggle-password") {
    const input = document.getElementById("login-password");
    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "แสดง" : "ซ่อน";
    button.setAttribute(
      "aria-label",
      input.type === "password" ? "แสดงรหัสผ่าน" : "ซ่อนรหัสผ่าน",
    );
    return;
  }
  if (action === "customer-password") {
    if (user?.role !== "admin") return;
    const input = document.getElementById(button.dataset.target);
    if (!input || !input.closest("#customer-form")) return;
    const showing = input.type === "password";
    input.type = showing ? "text" : "password";
    button.textContent = showing ? "ซ่อน" : "แสดง";
    button.setAttribute("aria-pressed", String(showing));
    button.setAttribute(
      "aria-label",
      `${showing ? "ซ่อน" : "แสดง"}${input.id === "customer-latest-password" ? "รหัสผ่านล่าสุด" : "รหัสผ่านใหม่"}`,
    );
    return;
  }
  if (action === "close-modal") {
    closeModal();
    return;
  }
  if (action === "logout") {
    logout();
    return;
  }
  if (!user) return;
  if (action === "return-admin" && adminPreview) {
    user = previewAdmin;
    previewAdmin = null;
    adminPreview = false;
    route = "customers";
    jobId = null;
    stepId = null;
    setSession();
    render();
    return;
  }
  if (action === "navigate") {
    route = button.dataset.route;
    query = "";
    customerFilter = "";
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (action === "select-step") {
    stepId = button.dataset.step;
    render();
    if (window.innerWidth <= 1200)
      document
        .getElementById("step-details")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "back-map") {
    document
      .querySelector(".map-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (action === "open-job") {
    jobId = id;
    stepId = null;
    route = "tracking";
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (user.role !== "admin") return;
  if (action === "new-admin") {
    adminModal();
    return;
  }
  if (action === "edit-admin") {
    adminModal(id);
    return;
  }
  if (action === "toggle-admin") {
    const a = state.admins.find((a) => a.id === id);
    if (!a) return;
    modal(
      a.active ? "ปิดบัญชีผู้ดูแล" : "เปิดบัญชีผู้ดูแล",
      `<p>ยืนยัน${a.active ? "ปิด" : "เปิด"}บัญชี <strong>${esc(a.company)}</strong>?</p><p class="tip">${a.active ? "บัญชีนี้จะเข้าสู่ระบบและจัดการข้อมูลไม่ได้จนกว่าจะเปิดใหม่" : "บัญชีนี้จะกลับมาจัดการระบบได้"}</p>`,
      `${cancelButton}<button class="btn primary" data-action="confirm-admin-active" data-id="${esc(id)}" data-active="${!a.active}">ยืนยัน</button>`,
    );
    return;
  }
  if (action === "confirm-admin-active") {
    button.disabled = true;
    try {
      await mutate("admin-active", {
        id,
        active: button.dataset.active === "true",
      });
      closeModal();
      toast("อัปเดตบัญชีผู้ดูแลแล้ว");
    } catch (error) {
      document.querySelector("#form-error").innerHTML =
        '<p class="error">' + esc(error.message) + "</p>";
      button.disabled = false;
    }
    return;
  }
  if (action === "new-customer") {
    customerModal();
    return;
  }
  if (action === "edit-customer") {
    customerModal(id);
    return;
  }
  if (action === "new-job") {
    jobModal();
    return;
  }
  if (action === "edit-job") {
    jobModal(id);
    return;
  }
  if (action === "delete-customer") {
    confirmDelete("customer", id);
    return;
  }
  if (action === "delete-job") {
    confirmDelete("job", id);
    return;
  }
  if (action === "confirm-delete") {
    button.disabled = true;
    try {
      await mutate(
        button.dataset.type === "customer" ? "account-archive" : "job-archive",
        { id },
      );
      closeModal();
      toast("นำรายการออกแล้ว");
    } catch (error) {
      toast(error.message);
      button.disabled = false;
    }
    return;
  }
  if (action === "preview-customer") {
    const c = state.customers.find((c) => c.id === id);
    if (!c?.active) return;
    previewAdmin = { ...user };
    user = { id: c.id, role: "customer", name: c.company };
    adminPreview = true;
    route = "tracking";
    jobId = null;
    stepId = null;
    setSession();
    render();
    return;
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "job-select") {
    jobId = e.target.value;
    stepId = null;
    render();
  }
  if (e.target.id === "customer-filter") {
    customerFilter = e.target.value;
    render();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "job-search") {
    const pos = e.target.selectionStart;
    query = e.target.value;
    render();
    const input = document.getElementById("job-search");
    input.focus();
    input.setSelectionRange(pos, pos);
  }
});
document.addEventListener(
  "invalid",
  (e) => {
    const field = e.target,
      form = field.closest("form");
    const error =
      form?.querySelector("#form-error") || form?.querySelector("#login-error");
    if (!error) return;
    const names = {
      company: "ชื่อบริษัท",
      username: "ชื่อผู้ใช้",
      password: "รหัสผ่าน",
      name: "ชื่องาน",
      standard: "มาตรฐานอุตสาหกรรม",
    };
    let message = "กรุณาตรวจสอบข้อมูลก่อนบันทึก";
    if (field.validity.valueMissing)
      message = `กรุณาระบุ${names[field.name] || "ข้อมูลที่จำเป็น"}`;
    else if (field.validity.tooShort)
      message = `รหัสผ่านต้องมีอย่างน้อย ${field.minLength} ตัวอักษร`;
    else if (field.validity.patternMismatch)
      message =
        "ชื่อผู้ใช้ต้องเป็นตัวอักษรภาษาอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง";
    else if (field.validity.typeMismatch) message = "กรุณากรอกอีเมลให้ถูกต้อง";
    error.innerHTML = `<p class="error">${message}</p>`;
  },
  true,
);
function accept(result) {
  state = {
    customers: result.customers,
    jobs: result.jobs,
    admins: result.admins || [],
  };
  if (!adminPreview) user = result.user;
}
async function mutate(op, body) {
  const result = await request(op, body);
  accept(result);
  render();
}
document.addEventListener("submit", async (e) => {
  const form = e.target;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form)),
    button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    if (form.getAttribute("id") === "login-form") {
      accept(
        await request("login", {
          username: data.username,
          password: data.password,
        }),
      );
      adminPreview = false;
      route = user.role === "admin" ? "overview" : "tracking";
      jobId = null;
      stepId = null;
      render();
      return;
    }
    if (!user || user.role !== "admin") return;
    if (form.getAttribute("id") === "admin-form") {
      await mutate("admin-save", data);
      closeModal();
      toast(data.id ? "บันทึกผู้ดูแลแล้ว" : "เพิ่มผู้ดูแลแล้ว");
      return;
    }
    if (form.getAttribute("id") === "customer-form") {
      await mutate("account-save", { ...data, active: data.active === "on" });
      closeModal();
      toast(data.id ? "บันทึกบัญชีลูกค้าแล้ว" : "เพิ่มบัญชีลูกค้าแล้ว");
      return;
    }
    if (form.getAttribute("id") === "job-form") {
      await mutate("job-save", data);
      closeModal();
      toast(data.id ? "บันทึกข้อมูลงานแล้ว" : "เพิ่มงานใหม่แล้ว");
      return;
    }
    if (form.getAttribute("id") === "step-form") {
      await mutate("step-save", { ...data, jobId });
      toast("บันทึกสถานะแล้ว");
    }
  } catch (error) {
    const target =
      form.querySelector("#form-error") || form.querySelector("#login-error");
    if (target)
      target.innerHTML = '<p class="error">' + esc(error.message) + "</p>";
    else toast(error.message);
    if (error.status === 401 || error.status === 403) {
      user = null;
      adminPreview = false;
      login(error.message);
    }
  } finally {
    if (button) button.disabled = false;
  }
});
window.addEventListener("resize", () => requestAnimationFrame(drawTracks));
async function init() {
  root.innerHTML =
    '<main class="empty" style="padding-top:25vh"><h1>OSS Client Portal</h1><p>กำลังเชื่อมต่อระบบ…</p></main>';
  try {
    accept(await request("state"));
    route = user.role === "admin" ? "overview" : "tracking";
    render();
  } catch (error) {
    state = { customers: [], jobs: [] };
    user = null;
    login(error.status === 401 ? "" : error.message);
  }
  document.fonts?.ready.then(() => drawTracks());
}
let refreshing = false;
async function refresh() {
  if (
    !user ||
    refreshing ||
    document.hidden ||
    document.querySelector("dialog") ||
    document.activeElement?.closest("form")
  )
    return;
  refreshing = true;
  try {
    const result = await request("state");
    accept(result);
    render();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      user = null;
      adminPreview = false;
      login(error.message);
    }
  } finally {
    refreshing = false;
  }
}
setInterval(refresh, 30000);
window.addEventListener("focus", refresh);
init();
