/*****************************************************************
 *  報名系統 Apps Script —「塗鴉 / 迷因 變 3D 模型」招生
 *  ---------------------------------------------------------------
 *  這一整份請貼到 Apps Script 編輯器，「完整取代」你目前的程式碼。
 *
 *  功能：
 *   1) 接收網站報名（doPost）→ 寫入「報名明細」工作表
 *   2) 時段查詢（doGet?date=YYYY-MM-DD）→ 回傳各時段各班報名人數＋鎖定狀態
 *   3) 每次報名後「自動重建」總覽表（依 系列 → 班別 → 日期時段 分組）
 *   4) 每筆報名寄通知信給負責人
 *
 *  ※ 防衝堂規則（只有一位老師）：
 *    - 同一個「日期＋時段」最終只會開一個班、上限 20 人。
 *    - 在尚未有任何班達到「開班人數」前，各班可同時於該時段累積報名（競爭中）。
 *    - 「先達到開班人數（MIN_OPEN）」的那一班，立即「鎖定」該日期時段，
 *      其他班之後就無法再報該時段（依報名時間先後判定）。
 *
 *  安裝：貼上後 →「部署 / 管理部署作業」更新；或重新「部署為網頁應用程式」，
 *       執行身分＝我、誰可以存取＝所有人，網址結尾 /exec 要和網站一致。
 *****************************************************************/

/*========= 可調整設定（要與網站 結帳.html 一致）=========*/
var MAX_SEATS   = 20;   // 每個「日期＋時段」滿班人數（上限）
var MIN_OPEN    = 10;   // 每個「日期＋時段」開班人數（達到即鎖定該時段）
var OWNER_EMAIL = "infinit121717@gmail.com";

var RAW_SHEET     = "報名明細";
var SUMMARY_SHEET = "總覽";

// 總覽固定排列順序；沒列到的班別/系列若有報名，會自動補在最後
var COURSE_ORDER = [
  { series: "塗鴉變 3D 模型？！",   classes: ["親子班", "成人班"] },
  { series: "迷因變成 3D 模型？！", classes: ["健康乖寶寶班", "酒鬼班"] }
];
var SLOT_ORDER = ["早上", "下午", "晚上"];
var SLOT_TIME  = { "早上":"09:00–12:00", "下午":"13:30–16:30", "晚上":"18:30–21:30" };

/*========= 成班自動付款通知設定 =========*/
// ★ 把下面換成你的收款頁網址（綠界／藍新／LINE Pay／街口…）。
//   在換成真實連結「之前」，系統不會寄出任何付款通知（避免寄到壞連結）。
var PAYMENT_URL       = "https://你的付款連結（請替換）";
var PAY_DEADLINE_DAYS = 3;      // 繳費期限：成班通知後 N 天內
var CC_OWNER          = true;   // 成班付款通知是否同時副本一份給老師

/*========= 試算表選單（可手動重建 / 補寄）=========*/
function onOpen(){
  SpreadsheetApp.getUi()
    .createMenu("報名系統")
    .addItem("重建總覽表", "rebuildSummary")
    .addItem("補寄所有已成班的付款通知", "sendAllPendingNotices")
    .addToUi();
}

/*========= Web 入口 =========*/
function doGet(e){
  var date = (e && e.parameter && e.parameter.date) || "";
  return json(slotData(date));   // { "早上":{owner:"親子班", byClass:{親子班:12,成人班:7}}, ... }
}

function doPost(e){
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    var b   = JSON.parse(e.postData.contents);
    var qty = Number(b.qty) || 1;

    var sd  = slotData(b.date);
    var s   = sd[b.slot] || { owner:"", byClass:{} };
    var myCount = (s.byClass && s.byClass[b.class_name]) || 0;

    // 1) 此時段已被其他班「先達開班人數」鎖定 → 拒絕
    if (s.owner && s.owner !== b.class_name){
      return json({ ok:false, conflict:true, owner:s.owner, slotData: sd });
    }
    // 2) 自己這班的容量檢查（上限 20）
    if (myCount + qty > MAX_SEATS){
      return json({ ok:false, full:true, slotData: sd });
    }

    appendRow(b, qty);
    rebuildSummary();
    notifyOwner(b, qty);
    maybeSendPaymentNotices(b);   // 若此筆讓該班成班（或已成班）→ 自動寄付款通知
    return json({ ok:true });
  }catch(err){
    return json({ ok:false, error:String(err) });
  }finally{
    lock.releaseLock();
  }
}

/*========= 原始資料：報名明細 =========*/
function rawSheet(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(RAW_SHEET);
  if(!sh){
    sh = ss.insertSheet(RAW_SHEET);
    sh.appendRow(["時間戳記","系列","班別","上課日期","時段","時段時間","報名人數","金額","姓名","電話","Email","付款通知"]);
    sh.setFrozenRows(1);
  } else {
    // 確保有「付款通知」欄（第 12 欄）——記錄成班付款通知的寄送時間，避免重複寄
    if(sh.getRange(1,12).getValue() !== "付款通知") sh.getRange(1,12).setValue("付款通知");
  }
  return sh;
}

function appendRow(b, qty){
  rawSheet().appendRow([
    new Date(),
    b.course_series || "",
    b.class_name    || "",
    b.date          || "",
    b.slot          || "",
    SLOT_TIME[b.slot] || "",
    qty,
    b.price         || "",
    b.name          || "",
    b.phone         || "",
    b.email         || ""
  ]);
}

/*========= 名額計算：指定日期，各時段各班人數＋鎖定者 =========*/
// 回傳 { "早上": { owner:"親子班"|"", byClass:{ "親子班":12, "成人班":7 } }, ... }
// owner = 依報名時間先後，第一個達到 MIN_OPEN 的班別（鎖定該時段）
function slotData(date){
  var out = {};
  if(!date) return out;
  var sh = rawSheet();
  var n  = sh.getLastRow();
  if(n < 2) return out;

  // 取「時間戳記、班別、上課日期、時段、報名人數」，依時間排序
  var rows = sh.getRange(2,1,n-1,7).getValues();
  var recs = [];
  rows.forEach(function(r){
    if(formatDate(r[3]) !== date) return;
    recs.push({
      ts:   (r[0] instanceof Date) ? r[0].getTime() : 0,
      slot: r[4],
      klass:r[2],
      qty:  Number(r[6]) || 0
    });
  });
  recs.sort(function(a,b){ return a.ts - b.ts; });

  recs.forEach(function(rec){
    var s = out[rec.slot] || (out[rec.slot] = { owner:"", byClass:{} });
    s.byClass[rec.klass] = (s.byClass[rec.klass] || 0) + rec.qty;
    // 第一個達到開班人數的班別 → 鎖定
    if(!s.owner && s.byClass[rec.klass] >= MIN_OPEN){
      s.owner = rec.klass;
    }
  });
  return out;
}

// 全部日期時段的鎖定者（給總覽標記衝突用）：key = "日期||時段" → 班別
function computeOwners(data){
  var recs = data.map(function(r){
    return {
      ts:   (r[0] instanceof Date) ? r[0].getTime() : 0,
      date: formatDate(r[3]),
      slot: r[4],
      klass:r[2],
      qty:  Number(r[6]) || 0
    };
  }).sort(function(a,b){ return a.ts - b.ts; });

  var run = {}, owner = {};
  recs.forEach(function(x){
    var key = x.date + "||" + x.slot;
    run[key] = run[key] || {};
    run[key][x.klass] = (run[key][x.klass] || 0) + x.qty;
    if(!owner[key] && run[key][x.klass] >= MIN_OPEN) owner[key] = x.klass;
  });
  return owner;
}

/*========= 總覽重建（依 系列 → 班別 → 日期時段 分組）=========*/
function rebuildSummary(){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SUMMARY_SHEET) || ss.insertSheet(SUMMARY_SHEET);

  sh.clear();
  try { sh.getRange(1,1,Math.max(1,sh.getMaxRows()),Math.max(8,sh.getMaxColumns())).breakApart(); } catch(e){}

  var raw  = rawSheet();
  var n    = raw.getLastRow();
  var data = n>=2 ? raw.getRange(2,1,n-1,11).getValues() : [];
  var owners = computeOwners(data);

  // 分組：key = 系列||班別||日期||時段
  var groups = {};
  data.forEach(function(r){
    var series=r[1], klass=r[2], date=formatDate(r[3]), slot=r[4];
    var key = [series,klass,date,slot].join("||");
    if(!groups[key]) groups[key] = { series:series, klass:klass, date:date, slot:slot, qty:0, people:[] };
    var g = groups[key];
    var q = Number(r[6])||0;
    g.qty += q;
    g.people.push((r[8]||"") + "（" + (r[9]||"") + "／" + (r[10]||"") + "）" + (q>1 ? " ×"+q : ""));
  });

  // 表頭：每一列都帶獨立的「系列」「班別」欄位（可直接篩選 / 排序）
  var out = [
    ["招生報名總覽（最後更新：" + formatDateTime(new Date()) + "）","","","","","","",""],
    ["系列","班別","上課日期","時段","報名人數","開班狀態","剩餘名額","報名名單（姓名／電話／Email）"]
  ];
  var meta = [];   // 對齊 out 第 3 列起的樣式資訊

  var seriesIndex = 0;
  orderedSeries(groups).forEach(function(series){
    var band = (seriesIndex % 2 === 0) ? "#ffffff" : "#faf6ec";   // 隔系列換底色，方便分辨
    seriesIndex++;
    orderedClasses(series, groups).forEach(function(klass){
      var sessions = Object.keys(groups).map(function(k){ return groups[k]; })
        .filter(function(g){ return g.series===series && g.klass===klass; })
        .sort(function(a,b){
          if(a.date!==b.date) return a.date < b.date ? -1 : 1;
          return SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);
        });
      if(sessions.length===0){
        out.push([series, klass, "（尚無報名）","","","","",""]);
        meta.push({ band:band, empty:true });
        return;
      }
      sessions.forEach(function(g){
        var owner = owners[g.date + "||" + g.slot] || "";
        var lost  = owner && owner !== g.klass;   // 此時段被別班搶先開班
        var open  = g.qty >= MIN_OPEN;
        var full  = g.qty >= MAX_SEATS;
        out.push([
          series, klass, g.date,
          g.slot + "　" + (SLOT_TIME[g.slot]||""),
          g.qty + " 人",
          lost ? ("⚠ 已由「"+owner+"」優先開班") : (open ? "已達開班" : ("尚差 " + (MIN_OPEN-g.qty) + " 人開班")),
          lost ? "需改期" : (full ? "已滿" : ("剩 " + Math.max(0, MAX_SEATS-g.qty) + " 位")),
          g.people.join("、")
        ]);
        meta.push({ band:band, conflict:lost, open:open, full:full });
      });
    });
  });

  sh.getRange(1,1,out.length,8).setValues(out);
  styleSummary(sh, meta);
}

/*========= 排序輔助 =========*/
function orderedSeries(groups){
  var out = COURSE_ORDER.map(function(c){ return c.series; });
  Object.keys(groups).forEach(function(k){
    var s = groups[k].series;
    if(out.indexOf(s) < 0) out.push(s);
  });
  return out;
}
function orderedClasses(series, groups){
  var def = null;
  COURSE_ORDER.forEach(function(c){ if(c.series===series) def=c.classes; });
  var out = def ? def.slice() : [];
  Object.keys(groups).forEach(function(k){
    var g = groups[k];
    if(g.series===series && out.indexOf(g.klass) < 0) out.push(g.klass);
  });
  return out;
}

/*========= 樣式 =========*/
function styleSummary(sh, meta){
  sh.setColumnWidth(1, 170);  // 系列
  sh.setColumnWidth(2, 120);  // 班別
  sh.setColumnWidth(3, 110);  // 上課日期
  sh.setColumnWidth(4, 150);  // 時段
  sh.setColumnWidth(5, 80);   // 報名人數
  sh.setColumnWidth(6, 165);  // 開班狀態
  sh.setColumnWidth(7, 90);   // 剩餘名額
  sh.setColumnWidth(8, 480);  // 報名名單

  // 標題列
  sh.getRange(1,1,1,8).setFontWeight("bold").setFontSize(13)
    .setBackground("#1c1c1c").setFontColor("#ffffff");
  // 表頭
  sh.getRange(2,1,1,8).setFontWeight("bold").setBackground("#f3dc3e").setFontColor("#1c1c1c");

  // 資料列（從第 3 列起）
  meta.forEach(function(m, i){
    var row   = i + 3;
    var range = sh.getRange(row,1,1,8);
    range.setBackground(m.band || "#ffffff").setVerticalAlignment("middle");
    sh.getRange(row,1,1,2).setFontWeight("bold").setFontColor("#3a3424");   // 系列、班別 粗體
    if(m.empty){
      sh.getRange(row,3).setFontColor("#9a9a9a").setFontStyle("italic");
      return;
    }
    if(m.conflict){
      range.setBackground("#fbeaea");
      sh.getRange(row,6,1,2).setFontColor("#c0392b").setFontWeight("bold");
    }else{
      sh.getRange(row,6).setFontColor(m.open ? "#1f8a5b" : "#b06a00").setFontWeight("bold");
      sh.getRange(row,7).setFontColor(m.full ? "#c0392b" : "#3a3424").setFontWeight(m.full ? "bold" : "normal");
    }
  });
  sh.setFrozenRows(2);
}

/*========= 通知信 =========*/
function notifyOwner(b, qty){
  try{
    var subj = "【新報名】" + (b.class_name||"") + "／" + (b.date||"") + " " + (b.slot||"");
    var body =
      "系列：" + (b.course_series||"") + "\n" +
      "班別：" + (b.class_name||"") + "\n" +
      "上課時間：" + (b.when||"") + "\n" +
      "報名人數：" + qty + "\n" +
      "金額：" + (b.price||"") + "\n" +
      "──────────────\n" +
      "姓名：" + (b.name||"") + "\n" +
      "電話：" + (b.phone||"") + "\n" +
      "Email：" + (b.email||"");
    MailApp.sendEmail(OWNER_EMAIL, subj, body);
  }catch(e){ /* 寄信失敗不影響報名寫入 */ }
}

/*========= 成班 → 自動付款通知 =========*/
// 付款連結是否已設定（尚未替換時不寄，避免寄出壞連結）
function paymentReady(){
  return PAYMENT_URL && PAYMENT_URL.indexOf("你的付款連結") < 0;
}

// 某筆報名進來後：若該班已是此時段的擁有者（＝已達開班人數成班），
// 就把該班、該時段所有「尚未通知」的報名者補寄付款通知。
function maybeSendPaymentNotices(b){
  if(!paymentReady()) return;
  var sd = slotData(b.date);
  var s  = sd[b.slot] || { owner:"" };
  if(s.owner === b.class_name){
    sendPaymentNotices(b.date, b.slot, b.class_name);
  }
}

// 寄送指定 班別＋日期＋時段 中，尚未通知過的報名者；寄完在第 12 欄標記時間。
function sendPaymentNotices(date, slot, klass){
  if(!paymentReady()) return;
  var sh = rawSheet();
  var n  = sh.getLastRow();
  if(n < 2) return;
  var rows = sh.getRange(2,1,n-1,12).getValues();
  for(var i=0; i<rows.length; i++){
    var r = rows[i];
    if(formatDate(r[3]) !== date || String(r[4]) !== slot || String(r[2]) !== klass) continue;
    if(r[11]) continue;                          // 已通知過 → 跳過
    if(!String(r[10]||"").trim()) continue;       // 無 Email → 跳過
    if(sendPaymentEmail(r)){
      sh.getRange(i+2, 12).setValue(new Date());  // 標記已通知（避免重複）
    }
  }
}

// 掃描全部資料，把所有「已成班」班別中尚未通知的報名者補寄（選單可手動觸發）
function sendAllPendingNotices(){
  if(!paymentReady()){
    SpreadsheetApp.getUi().alert("尚未設定付款連結 PAYMENT_URL，請先在程式碼最上方填入收款頁網址。");
    return;
  }
  var raw = rawSheet();
  var n   = raw.getLastRow();
  var data = n>=2 ? raw.getRange(2,1,n-1,12).getValues() : [];
  var owners = computeOwners(data);
  var done = {};
  data.forEach(function(r){
    var date=formatDate(r[3]), slot=r[4], klass=r[2];
    var key = date+"||"+slot+"||"+klass;
    if(done[key]) return;
    if(owners[date+"||"+slot] === klass){        // 此班為時段擁有者＝成班
      sendPaymentNotices(date, slot, klass);
      done[key] = true;
    }
  });
  SpreadsheetApp.getUi().alert("已補寄完成（只會寄給尚未通知過的報名者）。");
}

// 寄一封付款通知給報名者（r 為報名明細的一列陣列）
function sendPaymentEmail(r){
  try{
    var email = String(r[10]||"").trim();
    if(!email) return false;
    var name  = r[8] || "";
    var when  = formatDate(r[3]) + "　" + r[4] + "　" + (SLOT_TIME[r[4]]||"");
    var dl    = new Date(); dl.setDate(dl.getDate() + PAY_DEADLINE_DAYS);
    var deadline = Utilities.formatDate(dl, Session.getScriptTimeZone(), "yyyy/MM/dd");

    var subj = "【成班通知・請完成繳費】" + (r[2]||"") + "／" + formatDate(r[3]) + " " + (r[4]||"");
    var body =
      name + " 您好：\n\n" +
      "好消息！您報名的課程已達開班人數、確定開課 🎉\n" +
      "請於繳費期限內完成付款以保留名額。\n\n" +
      "──── 課程資訊 ────\n" +
      "系列：" + (r[1]||"") + "\n" +
      "班別：" + (r[2]||"") + "\n" +
      "上課時間：" + when + "\n" +
      "報名人數：" + (r[6]||"") + " 人\n" +
      "應繳金額：" + (r[7]||"") + "\n\n" +
      "──── 繳費方式 ────\n" +
      "請點擊以下連結完成付款：\n" +
      PAYMENT_URL + "\n\n" +
      "繳費期限：" + deadline + " 前（成班通知後 " + PAY_DEADLINE_DAYS + " 天內）\n" +
      "逾期未繳將釋出名額，敬請把握。\n\n" +
      "如有任何問題，歡迎直接回覆此信，或來信 " + OWNER_EMAIL + "。\n" +
      "期待課堂上與您相見！";

    var opts = {};
    if(CC_OWNER) opts.cc = OWNER_EMAIL;   // 同時寄一份給老師
    MailApp.sendEmail(email, subj, body, opts);
    return true;
  }catch(e){
    return false;
  }
}

/*========= 共用工具 =========*/
function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function formatDate(v){
  if(v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(v || "");
}
function formatDateTime(d){
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm");
}
