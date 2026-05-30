// ===== 報名系統 Apps Script（綁定在你的 Google 試算表）=====
// 貼到「擴充功能 → Apps Script」的程式碼.gs，把原本內容全部刪掉後貼上這整段。
// 改動後記得「部署 → 管理部署 → 編輯（鉛筆）→ 版本：新版本 → 部署」才會生效。

// ┌─────────── 修改這裡：開班 / 滿班人數 ───────────┐
var MAX_SEATS = 20;  // 滿班人數（上限）：達到就鎖住、不能再報名
var MIN_OPEN  = 10;  // 開班人數（下限）：達到才確定開課
// └──────────────────────────────────────────────┘
// ※ 結帳頁（結帳.html）最上方也有同樣兩個數字，兩邊要改成一致。

var SHEET_NAME   = "報名";
var SUMMARY_NAME = "統計";
var OWNER_EMAIL  = "infinit121717@gmail.com";  // 收報名通知的信箱
var SLOT_ORDER   = ["早上", "下午", "晚上"];    // 時段排序

// 打開試算表時自動加一個「報名工具」選單，可手動重算統計
function onOpen() {
  SpreadsheetApp.getUi().createMenu("報名工具")
    .addItem("重建統計分頁", "rebuildSummary")
    .addToUi();
}

function doGet(e) {
  var date = (e && e.parameter && e.parameter.date || "").trim();
  return json_(countsForDate_(date));
}

function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) {}
  var counts = countsForDate_(d.date);
  if ((counts[d.slot] || 0) + (Number(d.qty) || 1) > MAX_SEATS) {
    return json_({ ok: false, full: true, counts: counts });   // 滿班
  }
  sheet_().appendRow([
    new Date(), d.course_series, d.class_name, d.date, d.slot,
    Number(d.qty) || 1, d.price, d.name, d.phone, d.email
  ]);
  sendMail_(d);
  rebuildSummary_();                                            // 自動更新統計分頁
  return json_({ ok: true, counts: countsForDate_(d.date) });
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["時間戳記", "課程系列", "班別", "上課日期", "時段", "人數", "金額", "姓名", "手機", "Email"]);
  }
  return sh;
}

// 把儲存格的日期（可能是 Date 或字串）統一轉成 yyyy-MM-dd 字串
function dateKey_(v) {
  if (v instanceof Date) {
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return Utilities.formatDate(v, tz, "yyyy-MM-dd");
  }
  var s = String(v || "").trim();
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function countsForDate_(date) {
  var out = {};
  if (!date) return out;
  var key = dateKey_(date);
  var v = sheet_().getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (dateKey_(v[i][3]) === key) {
      var s = v[i][4];
      out[s] = (out[s] || 0) + (Number(v[i][5]) || 1);
    }
  }
  return out;
}

// 依人數判斷狀態文字
function statusText_(n) {
  if (n >= MAX_SEATS) return "已額滿";
  if (n >= MIN_OPEN)  return "可開班（剩 " + (MAX_SEATS - n) + " 位）";
  return "未達開班（尚差 " + (MIN_OPEN - n) + " 人）";
}

// 供「報名工具」選單呼叫（不可有底線結尾才能從選單執行）
function rebuildSummary() { rebuildSummary_(); }

// 重建「統計」分頁：依日期列出各時段人數、狀態、報名者、小計，最後加總計
function rebuildSummary_() {
  var data = sheet_().getDataRange().getValues();
  var byDate = {};   // 日期 -> 時段 -> { count, names[] }
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var ds = dateKey_(r[3]);
    if (!ds) continue;
    var slot = String(r[4] || "");
    var qty  = Number(r[5]) || 1;
    var name = String(r[7] || "");
    if (!byDate[ds]) byDate[ds] = {};
    if (!byDate[ds][slot]) byDate[ds][slot] = { count: 0, names: [] };
    byDate[ds][slot].count += qty;
    byDate[ds][slot].names.push(qty > 1 ? (name + "×" + qty) : name);
  }

  var dates = Object.keys(byDate).sort();
  var rows = [["上課日期", "時段", "報名人數", "狀態", "報名者"]];
  var grand = 0;
  dates.forEach(function (ds) {
    var slots = Object.keys(byDate[ds]).sort(function (a, b) {
      var ia = SLOT_ORDER.indexOf(a), ib = SLOT_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    var dayTotal = 0;
    slots.forEach(function (s) {
      var cell = byDate[ds][s];
      rows.push([ds, s, cell.count, statusText_(cell.count), cell.names.join("、")]);
      dayTotal += cell.count;
    });
    rows.push([ds, "小計", dayTotal, "", ""]);
    grand += dayTotal;
  });
  rows.push(["總計", "", grand, "", ""]);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SUMMARY_NAME) || ss.insertSheet(SUMMARY_NAME);
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 5).setValues(rows);
  sh.getRange(1, 1, 1, 5).setFontWeight("bold");              // 標題列
  sh.setColumnWidth(5, 360);                                  // 報名者欄加寬
}

function sendMail_(d) {
  var subject = "【報名】" + d.class_name + "・" + d.name;
  var body =
    "課程系列：" + d.course_series + "\n" +
    "報名班別：" + d.class_name + "\n" +
    "上課時間：" + d.when + "\n" +
    "報名人數：" + d.qty + "\n" +
    "金額：" + d.price + "\n" +
    "──────────\n" +
    "姓名：" + d.name + "\n" +
    "手機：" + d.phone + "\n" +
    "Email：" + d.email + "\n";
  MailApp.sendEmail({ to: OWNER_EMAIL, bcc: d.email, subject: subject, body: body });
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
