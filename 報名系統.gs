// ===== 報名系統 Apps Script（綁定在你的 Google 試算表）=====
// 貼到「擴充功能 → Apps Script」的程式碼.gs，把原本內容全部刪掉後貼上這整段。
// 改動後記得「部署 → 管理部署 → 編輯（鉛筆）→ 版本：新版本 → 部署」才會生效。
//
// 2026-05-31 更新：區分「點選付款（待付款）」與「付款完成（已付款）」兩個事件
//   ① 點付款按鈕 → 寫一筆「待付款」（抓 lead，知道誰來過但沒付完）
//   ② 付款完成   → 把同一筆更新成「已付款」+ 訂單編號（不另開新列）
//   ③ 名額只計「已付款」（待付款不佔位）

// ┌─────────── 修改這裡：開班 / 滿班人數 ───────────┐
var MAX_SEATS = 20;  // 滿班人數（上限）：達到就鎖住、不能再報名
var MIN_OPEN  = 10;  // 開班人數（下限）：達到才確定開課
// └──────────────────────────────────────────────┘
// ※ 結帳頁（結帳.html）最上方也有同樣兩個數字，兩邊要改成一致。

var SHEET_NAME   = "報名";
var SUMMARY_NAME = "統計";
var OWNER_EMAIL  = "infinit121717@gmail.com";  // 收報名通知的信箱
var SLOT_ORDER   = ["早上", "下午", "晚上"];    // 時段排序

// 欄位：時間戳記, 課程系列, 班別, 上課日期, 時段, 人數, 金額, 姓名, 手機, Email, 狀態, 訂單編號, 識別碼
var HEADERS = ["時間戳記","課程系列","班別","上課日期","時段","人數","金額","姓名","手機","Email","狀態","訂單編號","識別碼"];
var COL_DATE = 3, COL_SLOT = 4, COL_QTY = 5, COL_STATUS = 10, COL_ORDER = 11, COL_BID = 12; // 0-based

function onOpen() {
  SpreadsheetApp.getUi().createMenu("報名工具")
    .addItem("重建統計分頁", "rebuildSummary")
    .addToUi();
}

function doGet(e) {
  var date = (e && e.parameter && e.parameter.date || "").trim();
  return json_(countsForDate_(date));   // 只回「已付款」名額
}

function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) {}
  var event = d.event || (d.paid ? "paid" : "initiate");

  if (event === "paid") {
    // 付款完成 → 把對應「待付款」列更新成「已付款」；找不到就補一列
    var ok = markPaid_(d);
    if (!ok) appendRow_(d, "已付款", d.order_id || "");
    sendMail_(d);              // 付款完成才寄通知信（不在點按鈕時就寄）
    rebuildSummary_();
    return json_({ ok: true, paid: true, counts: countsForDate_(d.date) });
  }

  // 點選付款（initiate）→ 記一筆「待付款」。先用「已付款」名額判斷是否已滿。
  var counts = countsForDate_(d.date);
  if ((counts[d.slot] || 0) + (Number(d.qty) || 1) > MAX_SEATS) {
    return json_({ ok: false, full: true, counts: counts });   // 已額滿
  }
  appendRow_(d, "待付款", "");
  return json_({ ok: true, pending: true, counts: counts });
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
  } else if (sh.getLastColumn() < HEADERS.length) {
    // 舊表自動補上新欄位的標題
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sh;
}

function appendRow_(d, status, orderId) {
  sheet_().appendRow([
    new Date(), d.course_series, d.class_name, d.date, d.slot,
    Number(d.qty) || 1, d.price, d.name, d.phone, d.email,
    status, orderId || "", d.booking_id || ""
  ]);
}

// 依識別碼找最近一筆「待付款」更新成「已付款」+ 訂單編號
function markPaid_(d) {
  if (!d.booking_id) return false;
  var sh = sheet_();
  var v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) {
    if (String(v[i][COL_BID]) === String(d.booking_id)) {
      sh.getRange(i + 1, COL_STATUS + 1).setValue("已付款");
      sh.getRange(i + 1, COL_ORDER + 1).setValue(d.order_id || "");
      return true;
    }
  }
  return false;
}

function dateKey_(v) {
  if (v instanceof Date) {
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return Utilities.formatDate(v, tz, "yyyy-MM-dd");
  }
  var s = String(v || "").trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

// 名額計算：只算「已付款」（含舊表沒有狀態欄的列，視為已付款；明確「待付款」不計）
function isPaidRow_(statusCell) {
  var s = String(statusCell || "").trim();
  return s !== "待付款";
}

function countsForDate_(date) {
  var out = {};
  if (!date) return out;
  var key = dateKey_(date);
  var v = sheet_().getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (dateKey_(v[i][COL_DATE]) === key && isPaidRow_(v[i][COL_STATUS])) {
      var s = v[i][COL_SLOT];
      out[s] = (out[s] || 0) + (Number(v[i][COL_QTY]) || 1);
    }
  }
  return out;
}

function statusText_(n) {
  if (n >= MAX_SEATS) return "已額滿";
  if (n >= MIN_OPEN)  return "可開班（剩 " + (MAX_SEATS - n) + " 位）";
  return "未達開班（尚差 " + (MIN_OPEN - n) + " 人）";
}

function rebuildSummary() { rebuildSummary_(); }

// 重建「統計」分頁：只統計「已付款」；另列出「待付款」數方便追單
function rebuildSummary_() {
  var data = sheet_().getDataRange().getValues();
  var byDate = {};   // 日期 -> 時段 -> { count, names[], pending }
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var ds = dateKey_(r[COL_DATE]);
    if (!ds) continue;
    var slot = String(r[COL_SLOT] || "");
    var qty  = Number(r[COL_QTY]) || 1;
    var name = String(r[7] || "");
    var paid = isPaidRow_(r[COL_STATUS]);
    if (!byDate[ds]) byDate[ds] = {};
    if (!byDate[ds][slot]) byDate[ds][slot] = { count: 0, names: [], pending: 0 };
    if (paid) {
      byDate[ds][slot].count += qty;
      byDate[ds][slot].names.push(qty > 1 ? (name + "×" + qty) : name);
    } else {
      byDate[ds][slot].pending += qty;   // 待付款
    }
  }

  var dates = Object.keys(byDate).sort();
  var rows = [["上課日期", "時段", "已付款人數", "待付款", "狀態", "已付款報名者"]];
  var grand = 0;
  dates.forEach(function (ds) {
    var slots = Object.keys(byDate[ds]).sort(function (a, b) {
      var ia = SLOT_ORDER.indexOf(a), ib = SLOT_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    var dayTotal = 0;
    slots.forEach(function (s) {
      var cell = byDate[ds][s];
      rows.push([ds, s, cell.count, cell.pending, statusText_(cell.count), cell.names.join("、")]);
      dayTotal += cell.count;
    });
    rows.push([ds, "小計", dayTotal, "", "", ""]);
    grand += dayTotal;
  });
  rows.push(["總計", "", grand, "", "", ""]);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SUMMARY_NAME) || ss.insertSheet(SUMMARY_NAME);
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 6).setValues(rows);
  sh.getRange(1, 1, 1, 6).setFontWeight("bold");
  sh.setColumnWidth(6, 360);
}

function sendMail_(d) {
  var subject = "【已付款】" + d.class_name + "・" + d.name + (d.order_id ? "（單號 " + d.order_id + "）" : "");
  var body =
    "課程系列：" + d.course_series + "\n" +
    "報名班別：" + d.class_name + "\n" +
    "上課時間：" + d.when + "\n" +
    "報名人數：" + d.qty + "\n" +
    "金額：" + d.price + "\n" +
    "訂單編號：" + (d.order_id || "(無)") + "\n" +
    "──────────\n" +
    "姓名：" + d.name + "\n" +
    "手機：" + d.phone + "\n" +
    "Email：" + d.email + "\n";
  MailApp.sendEmail({ to: OWNER_EMAIL, bcc: d.email, subject: subject, body: body });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
