// ===== 報名系統 Apps Script（綁定在你的 Google 試算表）=====
// 貼到「擴充功能 → Apps Script」，全部覆蓋後存檔。
// 之後做兩件事：
//   (A) 部署：右上「部署 → 管理部署 → 編輯(鉛筆) → 版本:新版本 → 部署」（給結帳頁寫入用）
//   (B) 設每日通知：左側「觸發器(時鐘) → 新增觸發器」→ 函式 checkAndNotify、
//       時間驅動 → 日計時器 → 選個時段（如早上 8–9 點）→ 儲存（首次會跳授權，全部允許）
//
// 流程：
//   1. 結帳頁付款成功 → 寫一筆進【Notion 資料庫】(你管理的地方) + Sheet(後台引擎) + Email 通知你
//   2. checkAndNotify 每天自動跑：
//        ・「日期×時段×班別」已付款達 MIN_OPEN → 寄「✅確定開課」給該場學員、Notion 狀態改「確定開課」
//        ・距上課日 <= DECISION_DAYS_BEFORE 仍未達標 → 寄「未達開班退款」、Notion 狀態改「已退款」、列入「待退款」
//   3. Notion 你用 表格/日曆(上課日期)/看板(狀態) 管理；Sheet 是引擎後台不用看

// ┌─────────── 可調參數 ───────────┐
var MAX_SEATS = 20;
var MIN_OPEN  = 10;
var DECISION_DAYS_BEFORE = 2;
// └──────────────────────────────┘
var OWNER_EMAIL  = "infinit121717@gmail.com";
var COURSE_TITLE = "塗鴉變 3D 模型";

// ── Notion ──（404table workspace 的報名資料庫）
// token 放在「指令碼屬性」不寫死在程式碼：Apps Script 左下 專案設定(齒輪) → 指令碼屬性 →
//   新增 NOTION_TOKEN = ntn_你的token（404table workspace 那個）
var NOTION_TOKEN = PropertiesService.getScriptProperties().getProperty("NOTION_TOKEN") || "";
var NOTION_DB    = "372c53bf-b1c2-816d-8f73-dbba4e4e270c";
var NOTION_VER   = "2022-06-28";

var SHEET_NAME = "報名", SUMMARY_NAME = "統計", REFUND_NAME = "待退款";
var SLOT_ORDER = ["早上","下午","晚上","深夜"];
var HEADERS = ["時間戳記","課程系列","班別","上課日期","時段","人數","金額","姓名","手機","Email","訂單編號","狀態","開課通知","退款通知","Notion頁"];
var C_TS=0,C_SERIES=1,C_CLASS=2,C_DATE=3,C_SLOT=4,C_QTY=5,C_PRICE=6,C_NAME=7,C_PHONE=8,C_EMAIL=9,C_ORDER=10,C_STATUS=11,C_NOPEN=12,C_NREFUND=13,C_NOTION=14;

function onOpen() {
  SpreadsheetApp.getUi().createMenu("報名工具")
    .addItem("重建統計分頁","rebuildSummary").addItem("立即檢查並寄通知","checkAndNotify").addToUi();
}

function doGet(e){ return json_(countsForDate_((e&&e.parameter&&e.parameter.date||"").trim())); }

function doPost(e){
  var d = {}; try { d = JSON.parse(e.postData.contents); } catch(err){}
  var status = d.paid ? "已付款" : (d.status_check === "verify_failed" ? "待確認" : "已付款");
  var pageId = notionCreate_(d, status);            // 寫進 Notion
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  sheet_().appendRow([ new Date(), d.course_series||"", d.class_name||"", d.date||"", d.slot||"",
    Number(d.qty)||1, d.price||"", d.name||"", d.phone||"", d.email||"", d.order_id||"", status, "", "", pageId||"" ]);
  if (status === "已付款") sendOwnerPaid_(d);
  rebuildSummary_();
  return json_({ ok:true, counts: countsForDate_(d.date) });
}

// ===== Notion =====
function notionCreate_(d, status){
  try {
    var props = {
      "姓名":   { title: [{ text: { content: String(d.name||"(未填)") } }] },
      "Email":  { email: d.email || null },
      "手機":   { phone_number: d.phone || null },
      "上課日期": { date: { start: d.date || null } },
      "金額":   { number: Number(d.amount)||0 },
      "訂單編號": { rich_text: [{ text: { content: String(d.order_id||"") } }] },
      "狀態":   { select: { name: status } },
      "報名時間": { date: { start: Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd") } }
    };
    if (d.class_name) props["班別"] = { select: { name: d.class_name } };
    if (d.slot)       props["時段"] = { select: { name: d.slot } };
    var res = UrlFetchApp.fetch("https://api.notion.com/v1/pages", {
      method:"post", contentType:"application/json", muteHttpExceptions:true,
      headers:{ "Authorization":"Bearer "+NOTION_TOKEN, "Notion-Version":NOTION_VER },
      payload: JSON.stringify({ parent:{ database_id: NOTION_DB }, properties: props })
    });
    var o = JSON.parse(res.getContentText());
    return o && o.id ? o.id : "";
  } catch(err){ return ""; }
}
function notionPatchStatus_(pageId, statusName){
  if (!pageId) return;
  try {
    UrlFetchApp.fetch("https://api.notion.com/v1/pages/"+pageId, {
      method:"patch", contentType:"application/json", muteHttpExceptions:true,
      headers:{ "Authorization":"Bearer "+NOTION_TOKEN, "Notion-Version":NOTION_VER },
      payload: JSON.stringify({ properties:{ "狀態":{ select:{ name: statusName } } } })
    });
  } catch(err){}
}

// ===== 每日通知（時間驅動觸發器）=====
function checkAndNotify(){
  var sh = sheet_(), v = sh.getDataRange().getValues();
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var todayKey = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  var groups = {};
  for (var i=1;i<v.length;i++){
    if (!isPaid_(v[i][C_STATUS])) continue;
    var ds = dateKey_(v[i][C_DATE]); if(!ds) continue;
    var k = ds+"|"+v[i][C_SLOT]+"|"+v[i][C_CLASS];
    (groups[k] = groups[k] || {rows:[],count:0,date:ds,slot:v[i][C_SLOT],klass:v[i][C_CLASS]});
    groups[k].rows.push(i); groups[k].count += (Number(v[i][C_QTY])||1);
  }
  var refundAdds=[], so=0, sr=0;
  Object.keys(groups).forEach(function(k){
    var g=groups[k], when=g.date.replace(/-/g,"/")+"・"+g.slot;
    if (g.count >= MIN_OPEN){
      g.rows.forEach(function(r){
        if (String(v[r][C_NOPEN]||"").trim()) return;
        mailOpen_(v[r][C_EMAIL], v[r][C_NAME], v[r][C_CLASS], when);
        notionPatchStatus_(v[r][C_NOTION], "確定開課");
        sh.getRange(r+1, C_NOPEN+1).setValue(todayKey); so++;
      });
    } else if (daysBetween_(todayKey, g.date) <= DECISION_DAYS_BEFORE){
      g.rows.forEach(function(r){
        if (String(v[r][C_NREFUND]||"").trim()) return;
        mailRefund_(v[r][C_EMAIL], v[r][C_NAME], v[r][C_CLASS], when);
        notionPatchStatus_(v[r][C_NOTION], "已退款");
        sh.getRange(r+1, C_NREFUND+1).setValue(todayKey);
        refundAdds.push([todayKey, v[r][C_CLASS], when, v[r][C_NAME], v[r][C_EMAIL], v[r][C_PRICE], v[r][C_ORDER], "待退款"]); sr++;
      });
    }
  });
  if (refundAdds.length) appendRefunds_(refundAdds);
  if (so||sr) MailApp.sendEmail({ to:OWNER_EMAIL, subject:"【報名系統】自動通知已寄出",
    body:"確定開課："+so+" 封\n未達開班(退款)："+sr+" 封\n"+(refundAdds.length?"\n⚠️ "+refundAdds.length+" 筆待退款，請見「待退款」分頁，依訂單編號到 Recur 後台 app.recur.tw 退款。":"") });
}

function daysBetween_(a,b){ return Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/86400000); }
function sheet_(){ var ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(SHEET_NAME);
  if(!sh){sh=ss.insertSheet(SHEET_NAME);sh.appendRow(HEADERS);} else if(sh.getLastColumn()<HEADERS.length) sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]); return sh; }
function dateKey_(x){ if(x instanceof Date) return Utilities.formatDate(x, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(),"yyyy-MM-dd"); var s=String(x||"").trim(); return s.length>=10?s.slice(0,10):s; }
function isPaid_(s){ return String(s||"").trim()==="已付款"; }
function countsForDate_(date){ var out={}; if(!date) return out; var key=dateKey_(date),v=sheet_().getDataRange().getValues();
  for(var i=1;i<v.length;i++){ if(dateKey_(v[i][C_DATE])===key && isPaid_(v[i][C_STATUS])){ var s=v[i][C_SLOT]; out[s]=(out[s]||0)+(Number(v[i][C_QTY])||1); } } return out; }

function mailOpen_(email,name,klass,when){ if(!email) return;
  MailApp.sendEmail({ to:email, bcc:OWNER_EMAIL, subject:"【"+COURSE_TITLE+"】✅ 您報名的「"+klass+"」確定開課！",
    body:name+" 您好：\n\n好消息！您報名的「"+klass+"」（"+when+"）已達開班人數，確定開課 🎉\n上課地點與細節我們會再以 Email 寄給您。\n\n如有問題請回信或來信 "+OWNER_EMAIL+"。\n\n"+COURSE_TITLE+" 敬上" }); }
function mailRefund_(email,name,klass,when){ if(!email) return;
  MailApp.sendEmail({ to:email, bcc:OWNER_EMAIL, subject:"【"+COURSE_TITLE+"】關於您報名的「"+klass+"」（將全額退款）",
    body:name+" 您好：\n\n很抱歉，您報名的「"+klass+"」（"+when+"）因未達開班人數，這梯無法開課。\n款項將【全額退回原付款卡片】，約需數個工作天入帳。\n若想改報其他梯次歡迎回信，我們很樂意安排。\n\n如有問題請來信 "+OWNER_EMAIL+"。\n\n"+COURSE_TITLE+" 敬上" }); }
function sendOwnerPaid_(d){ MailApp.sendEmail({ to:OWNER_EMAIL, bcc:d.email||"",
  subject:"【已付款】"+(d.class_name||"")+"・"+(d.name||"")+(d.order_id?"（單號 "+d.order_id+"）":""),
  body:"課程："+(d.course_series||"")+" "+(d.class_name||"")+"\n上課時間："+(d.when||"")+"\n人數："+(d.qty||"")+"\n金額："+(d.price||"")+"\n訂單："+(d.order_id||"(無)")+"\n姓名："+(d.name||"")+"\n手機："+(d.phone||"")+"\nEmail："+(d.email||"") }); }
function appendRefunds_(rows){ var ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(REFUND_NAME);
  if(!sh){sh=ss.insertSheet(REFUND_NAME);sh.appendRow(["通知日","班別","場次","姓名","Email","金額","訂單編號","退款狀態"]);}
  sh.getRange(sh.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows); }

function statusText_(n){ if(n>=MAX_SEATS) return "已額滿"; if(n>=MIN_OPEN) return "確定開課（剩 "+(MAX_SEATS-n)+" 位）"; return "未達開班（尚差 "+(MIN_OPEN-n)+" 人）"; }
function rebuildSummary(){ rebuildSummary_(); }
function rebuildSummary_(){ var data=sheet_().getDataRange().getValues(),byKey={};
  for(var i=1;i<data.length;i++){ var r=data[i],ds=dateKey_(r[C_DATE]); if(!ds) continue;
    var key=ds+"|"+r[C_SLOT]+"|"+r[C_CLASS], c=byKey[key]||(byKey[key]={date:ds,slot:String(r[C_SLOT]||""),klass:String(r[C_CLASS]||""),paid:0,pending:0,names:[]});
    var q=Number(r[C_QTY])||1; if(isPaid_(r[C_STATUS])){c.paid+=q;c.names.push(q>1?(r[C_NAME]+"×"+q):r[C_NAME]);} else c.pending+=q; }
  var keys=Object.keys(byKey).sort(),rows=[["上課日期","時段","班別","已付款","待確認","狀態","已付款學員"]];
  keys.forEach(function(k){ var c=byKey[k]; rows.push([c.date,c.slot,c.klass,c.paid,c.pending,statusText_(c.paid),c.names.join("、")]); });
  var ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.getSheetByName(SUMMARY_NAME)||ss.insertSheet(SUMMARY_NAME);
  sh.clearContents(); sh.getRange(1,1,rows.length,7).setValues(rows); sh.getRange(1,1,1,7).setFontWeight("bold"); sh.setColumnWidth(7,360); }

function json_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
