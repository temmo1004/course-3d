const { useState, useEffect, useRef, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "squeeze": 15,
  "dimOther": true,
  "paperShadow": "soft",
  "tooltipText": "點擊可以瞭解詳情",
  "showSubtitle": true,
  "autoDemo": true,
  "demoHold": 1.15,
  "enterOn": "single",
  "stickyCTA": true,
  "menuPos": "top"
}/*EDITMODE-END*/;

const A = "assets/";

// 各班別開幕特惠價（用於底部固定報名列顯示）
const PRICE = {
  family: { now: "1,500", was: "3,000" },
  adult:  { now: "1,600", was: "3,500" },
  good:   { now: "1,500", was: "3,000" },
  drunk:  { now: "2,500", was: "3,500" },
};

// ===================================================================
// 系列課程設定 — 每個主題課程有自己的封面 hero（撕紙分流結構相同），
// 左右兩側＝該課程的細分班別。封面層／hero 由 DoodleLayers / MemeLayers
// 提供（見 doodle-hero.jsx / meme-hero.jsx），這裡只描述班別與揭露封面。
// ===================================================================
const COURSES = [
  { id:"doodle", name:"塗鴉變 3D 模型？！", short:"塗鴉變 3D 模型", hero:"doodle",
    left:  { key:"family", label:"親子班" },
    right: { key:"adult",  label:"成人班" },
    cover: { family: A+"cover-family.webp", adult: A+"cover-adult.webp" } },
  { id:"meme", name:"迷因變成 3D 模型？！", short:"迷因變 3D 模型", hero:"meme",
    left:  { key:"good",  label:"健康乖寶寶班" },
    right: { key:"drunk", label:"酒鬼班" },
    cover: { good: A+"meme-cover-good.webp", drunk: A+"meme-cover-drunk.webp" } },
  { id:"tbd", name:"敬請期待", short:"敬請期待", hero:"doodle", comingSoon:true,
    left:  { key:"family", label:"親子班" },
    right: { key:"adult",  label:"成人班" },
    cover: { family: A+"cover-family.webp", adult: A+"cover-adult.webp" } },
];

// 所有 hero 用到的素材一次預載（兩套 hero 的清單由各自檔案匯出）
const ALL_IMG = [...(window.DOODLE_IMG || []), ...(window.MEME_IMG || [])];

// ===================================================================
// 底部說明區內容
//  · 預設（未選班別）＝系列課程說明
//  · 選了班別＝細分課程說明：主要說明與系列相同，僅在底下「多一段」
//    該班別專屬的文字＋圖片（依草圖）。報名鈕帶上班別跳結帳頁。
// 文字為示意，後續可替換。
// ===================================================================
const SERIES_MAIN = {
  midTitle: <>零基礎用 AI，製作出屬於自己的 3D 列印物件</>,
  q: <>想親手做出專屬公仔或道具，卻卡在第一步？<br/>買了 3D 列印機，卻只能印現成的檔案？</>,
  lead: <>看到網路上的 3D 列印公仔、物件好羨慕，但一想到要學複雜的建模軟體，就讓您打退堂鼓嗎？其實，您需要的不是高超的 3D 技巧，而是<strong>更聰明的工具</strong>！這系列課程將帶您跳過最繁瑣的建模過程，直接用 AI 輔助您實現腦中的創意！</>,
  steps: [
    { t: "發揮創意", img: "assets/feature-doodle.webp", d: "從一個天馬行空的想法開始，帶您創意思考，並以 AI 輔助迭代。不必會畫畫，敢想就是起點！" },
    { t: "AI 建模",  img: "assets/feature-ai.webp",     d: "用 AI 把平面的想法轉為立體的模型，快速產出您的模型草模。" },
    { t: "列印公仔", img: "assets/feature-print.webp",  d: "把您的創意從螢幕中拿出來，3D 列印出可以握在手上的實體。" },
  ],
  learn: [
    { h: "AI 效率創作", d: "用 Vizcom AI 解放您的想像力。" },
    { h: "判斷與取捨",   d: "AI 給的不照單全收；學會看懂設計怎麼長出來，再做出自己的選擇。" },
    { h: "實體化成就感", d: "體驗數位製造流程，擁有個人專屬的公仔或物件。" },
  ],
  prepare: [
    "一臺可以連上網路的筆電",
    "一個可使用的 Gmail 帳號",
    "一顆愉快的心",
  ],
  prepareNote: "（依照不同課程可能需要額外準備，請詳閱細分課程介紹）",
  footer: "其餘資訊，請至上方所有課程選單挑選，並於封面點擊選擇您感興趣的班別查看。",
  signupCap: "報名主視覺／課程資訊圖（靜態圖片，待補）",
};

// 迷因課兩班共用的「發揮創意／AI 建模／列印公仔」三圖（刀盾犬迷因 → 上色模型 → 列印公仔）
const MEME_FEATS = [
  { t: "網路迷因檢討會", img: "assets/meme-feat-create.webp?v=2", d: "蒐集以及與同班同學們交流、分享，組成您的超級迷因大軍，並挑到對味的梗圖。" },
  { t: "AI 3D 小廢物煉成",  img: "assets/meme-feat-ai.webp?v=2",     d: <>把您對味的梗圖迷因，透過煉成術調整細節或二創，再由平面轉為立體模型，<span style={{color:'#d6342c',fontWeight:800,textDecoration:'line-through'}}>嚴禁大葛葛！</span></> },
  { t: "列印公仔", img: "assets/meme-feat-print.webp?v=2",  d: <>我：我需要那個酷東西 TT<br/>列印姬：欸，這個可以，這個骨力！</> },
];

// 各主題課程的「公版課程介紹」內容（細分頁共用該課程的大標題/中標題/三步驟）
const COURSE_INTRO = {
  doodle: {
    bigTitle: "以隨手塗鴉創作出屬於自己的 3D 列印公仔",
    q: <>想要以更特別的方式紀念孩子的傑作嗎？<br/>想刺激孩子的想像力嗎？<br/>想與孩子創造特別的回憶嗎？</>,
    lead: <>看到網路上好多可愛的公仔，有沒有想過也能將您孩子的作品或想像力，轉變為值得收藏的公仔？來吧！讓您與您的孩子一起來當一段時間的小孩，一起留下特別的記憶吧！</>,
    steps: [
      { t: "發揮創意", img: "assets/feature-doodle.webp", d: "與孩子一起在紙上揮灑腦內的想像，並導入電腦中，使用 AI 快速延伸紙上塗鴉的更多可能性～" },
      { t: "AI 建模",  img: "assets/feature-ai.webp",     d: "用 AI 把平面的塗鴉發展轉為立體的模型，快速生成您孩子作品的 3D 模型。" },
      { t: "列印公仔", img: "assets/feature-print.webp",  d: "將您孩子的創意從螢幕中拿出來，3D 列印出可以握在手上的寶貴回憶。" },
    ],
  },
  meme: {
    bigTitle: "用網路迷因＋AI 創作出您的 3D 列印公仔",
    q: SERIES_MAIN.q,
    lead: SERIES_MAIN.lead,
    steps: MEME_FEATS,
  },
};

// 各班別只定義「額外多出的一段」說明文字＋圖片；主要說明沿用 SERIES_MAIN
const DETAIL_EXTRA = {
  family: {
    eyebrow: "親子班・課程介紹",
    course: "family",
    outline: [
      { time: "0:00–0:20", t: "報到・暖身", d: "認識今天的工具與流程，親子一起破冰，準備好一起當小孩。" },
      { time: "0:20–1:00", t: "塗鴉發想", d: "和孩子在紙上自由揮灑想像，挑出最喜歡的塗鴉並掃描導入電腦。" },
      { time: "1:00–2:00", t: "AI 建模", d: "用 Vizcom 把平面塗鴉變立體，一起迭代出孩子作品的 3D 造型。" },
      { time: "2:00–2:40", t: "細節調整・匯出", d: "修整模型、加上底座，匯出可列印的 STL 檔。" },
      { time: "2:40–3:00", t: "送印・收尾", d: "講解 FDM 列印與拆支撐，登記取件方式（自取或寄送超商）。" },
    ],
    bigTitle: "與小孩一同創作並轉化為 3D 列印公仔",
    q: <>想要以更特別的方式紀念孩子的傑作嗎？<br/>想刺激孩子的想像力嗎？<br/>想與孩子創造特別的回憶嗎？</>,
    lead: <>看到網路上好多可愛的公仔，有沒有想過也能將您孩子的作品或想像力，轉變為值得收藏的公仔？來吧！讓您與您的孩子一起來當一段時間的小孩，一起留下特別的記憶吧！</>,
    heading: "親子班・專屬安排",
    body: <>親子班以孩子主導、家長協助的步調進行，課堂節奏緩慢。<br/><br/>簡化了工具介紹，讓 6 歲以上的小朋友也可以自己動手。保留充分的共創時間，將腦中的發想從電腦中延伸，並最後列印成模型，變成一段珍貴的親子回憶。<br/><br/>我們不讓 AI 直接「幫孩子做完」，而是引導孩子在一次次嘗試中說出自己想要的樣子、做出選擇。AI 只是把孩子的想像加速展開的工具——最後的決定，始終在孩子手上。</>,
    images: [
      { src: "assets/family-inner-1.webp?v=2", wide: true },
      { src: "assets/family-inner-3.webp", wide: true },
      { src: "assets/family-inner-2.webp", wide: true },
    ],
    prepare: {
      required: [
        "筆電",
        "一個可使用的 Gmail 帳號",
        "熟悉的創作媒材（例如色鉛筆、彩色筆等）",
        "教室會提供基礎的鉛筆與 A4 白紙",
      ],
      recommended: [
        "滑鼠（沒有滑鼠會較難操作）",
        "電繪板（如果您習慣電繪的話）",
      ],
    },
    take: [
      "數張您與小孩一起創作的塗鴉",
      "一份您原創的 STL 模型檔案",
      "一個練習拆支撐的 FDM 小模型（贈品）",
      "上課作品的單色 FDM 列印模型（短課以課後寄送至您指定 7-11、全家門市或自取之方式取件）",
    ],
    info: [
      { label: "上課時間", value: "3–3.5 小時" },
      { label: "課程金額", value: <><del>原價 3,000 元</del><strong>限時開幕特惠價 1,500 元</strong>（含材料費）</> },
      { label: "開班人數", value: "10 人開班（達標會以 email 通知）" },
      { label: "課程日期", value: "請至結帳頁面查看與選擇" },
      { label: "課程地址", value: "台北市中山區長安東路二段 31 號 4 樓之 5 — 404Table 教室" },
      { label: "電腦硬體要求", value: "Windows 10+ 或 macOS 11+" },
    ],
    signupArt: {
      base:    "assets/family-signup-base.webp",
      cloudq:  "assets/family-signup-cloud-q.webp",
      monster: "assets/family-signup-monster-cut.webp",
      button:  "assets/family-signup-button-cut.webp",
      course:  "family",
      hotspot: { left: 63.5, top: 10, width: 30, height: 18 },
    },
    signupCap: "親子班報名資訊圖（靜態圖片，待補）",
  },
  adult: {
    eyebrow: "成人班・課程介紹",
    course: "adult",
    outline: [
      { time: "0:00–0:15", t: "開場・工作流概覽", d: "介紹由設計師視角出發的 AI 創作工作流與工具安裝。" },
      { time: "0:15–0:50", t: "草圖發想", d: "把腦中的想法或既有作品畫成草圖，導入電腦並用 AI 延伸探索。" },
      { time: "0:50–2:00", t: "AI 建模", d: "用 Vizcom 將平面草圖轉為立體，迭代出您專屬的造型。" },
      { time: "2:00–2:45", t: "模型細修・匯出", d: "調整比例與細節、加底座，匯出可列印的 STL 檔。" },
      { time: "2:45–3:30", t: "送印・收尾", d: "講解 FDM 列印與拆支撐，登記取件方式。" },
    ],
    bigTitle: "以塗鴉創作出只屬於您的 3D 列印公仔",
    q: <>腦中或筆記本有很多想法卻苦於軟體太難，無法變成 3D 嗎？<br/>有自己的角色或作品，卻一直停留在平面圖像嗎？<br/>買了 3D 列印機，卻還只下載別人的檔案？</>,
    lead: <>這堂課不要求您先成為建模高手，而是帶您用 AI 工作流，把塗鴉、草圖或既有作品轉化成 3D 模型，最後完成一件屬於您的列印公仔。</>,
    steps: [
      { t: "發揮創意", img: "assets/feature-doodle.webp", d: "將腦中的想法揮洒在畫布上並導入電腦中，使用 AI 快速延伸疊代，探索出更多可能性。" },
      { t: "AI 建模",  img: "assets/feature-ai.webp",     d: "用 AI 把平面的塗鴉發展轉為立體的模型，快速生成您作品的 3D 模型。" },
      { t: "列印公仔", img: "assets/feature-print.webp",  d: "將您的作品從螢幕中拿出來，3D 列印出可以握在手中的實體。" },
    ],
    heading: "成人班・專屬內容",
    body: "更多的流程展示，較快的課程節奏，體驗由設計師視角出發的 AI 創作工作流；體驗能清楚掌握發展脈絡，卻又令人驚喜的 AI 工具 VIZCOM。",
    images: [
      { src: "assets/adult-inner-1.webp", wide: true },
      { src: "assets/adult-inner-2.webp", wide: true },
      { src: "assets/adult-inner-3.webp", wide: true },
    ],
    prepare: {
      required: [
        "筆電",
        "一個可使用的 Gmail 帳號",
        "您慣用的創作媒材（例如色鉛筆、彩色筆等）",
        "教室會提供基礎的鉛筆與 A4 白紙",
      ],
      recommended: [
        "滑鼠（沒有滑鼠會較難操作）",
        "電繪板（如果您習慣電繪的話）",
      ],
    },
    info: [
      { label: "上課時間", value: "3–3.5 小時" },
      { label: "課程金額", value: <><del>原價 3,500 元</del><strong>限時開幕特惠價 1,600 元</strong>（含材料費）</> },
      { label: "開班人數", value: "10 人開班（達標會以 email 通知）" },
      { label: "課程日期", value: "請至結帳頁面查看與選擇" },
      { label: "課程地址", value: "台北市中山區長安東路二段 31 號 4 樓之 5 — 404Table 教室" },
      { label: "電腦硬體要求", value: "Windows 10+ 或 macOS 11+" },
    ],
    signupArt: {
      base:    "assets/adult-signup-base.webp",
      cloudq:  "assets/family-signup-cloud-q.webp",
      monster: "assets/family-signup-monster-cut.webp",
      button:  "assets/family-signup-button-cut.webp",
      course:  "adult",
      hotspot: { left: 63.5, top: 10, width: 30, height: 18 },
    },
    signupCap: "成人班報名資訊圖（靜態圖片，待補）",
  },

  // —— 迷因變 3D：健康乖寶寶班 / 酒鬼班（沿用系列主要說明，文字之後再換）——
  good: {
    eyebrow: "健康乖寶寶班・課程介紹",
    course: "good",
    outline: [
      { time: "0:00–0:20", t: "報到・迷因檢討會開張", d: "介紹流程，暖身分享各自珍藏的梗圖。" },
      { time: "0:20–1:00", t: "迷因蒐集・交流", d: "和同班同學交流梗圖，組成迷因大軍並挑出最對味的那張。" },
      { time: "1:00–2:00", t: "AI 3D 小廢物煉成", d: "用 AI 把梗圖二創、調整細節，由平面轉為立體模型。" },
      { time: "2:00–2:40", t: "模型調整・匯出", d: "修整細節、加底座，匯出可列印的 STL 檔。" },
      { time: "2:40–3:00", t: "送印・收尾", d: "講解 FDM 列印與拆支撐，登記取件方式（隨班附贈牛奶一瓶 🥛）。" },
    ],
    info: [
      { label: "上課時間", value: "3–3.5 小時" },
      { label: "課程金額", value: <><del>原價 3,000 元</del><strong>限時開幕特惠價 1,500 元</strong>（含材料費）</> },
      { label: "開班人數", value: "10 人開班（達標會以 email 通知）" },
      { label: "課程日期", value: "請至結帳頁面查看與選擇" },
      { label: "課程地址", value: "台北市中山區長安東路二段 31 號 4 樓之 5 — 404Table 教室" },
      { label: "電腦硬體要求", value: "Windows 10+ 或 macOS 11+" },
    ],
    bigTitle: "不喝酒也能創作出夠ㄎㄧㄤ的迷因公仔",
    q: <>桌上缺一隻獨特的小廢物嗎？<br/>找不到您想要的迷因周邊嗎？<br/>阿巴阿巴阿巴哇？</>,
    lead: <>每天都看到一堆網路迷因，卻很少看到有市售的迷因公仔。想讓您每天看的網路迷因走進現實嗎？來吧！我們一起製造一堆可愛小廢物！</>,
    features: MEME_FEATS,
    heading: "健康乖寶寶班・專屬安排",
    body: <>節奏輕鬆有趣，與同班同學們交流各自珍藏的梗圖。喝酒不能解決問題，但喝牛奶也不行，因此，隨班附贈一人一瓶牛奶！<span className="sign-placard">快來</span></>,
    images: [
      { src: "assets/good-inner-1.webp", wide: true },
      { src: "assets/good-inner-2.webp", wide: true },
    ],
    signupArt: { kind: "meme", course: "good" },
    prepare: {
      required: [ "筆電", "一個可使用的 Gmail 帳號" ],
      recommended: [ "滑鼠（沒有滑鼠會較難操作）", "電繪板（如果您習慣電繪的話）", "自己的迷因庫（這樣比較不用花那麼多時間現場找梗圖）" ],
    },
    take: [
      "數張您的創作或是交流的梗圖",
      "一份您原創的 STL 模型檔案",
      "一個練習拆支撐的 FDM 小模型（贈品）",
      "上課作品的單色 FDM 列印模型（短課以課後寄送至您指定 7-11、全家門市或自取之方式取件）",
    ],
    signupCap: "健康乖寶寶班報名資訊圖（靜態圖片，待補）",
  },
  drunk: {
    eyebrow: "酒鬼班・課程介紹",
    course: "drunk",
    outline: [
      { time: "0:00–0:20", t: "報到・開瓶", d: "核對年齡、領取酒水，迷因檢討會正式開張。" },
      { time: "0:20–1:10", t: "微醺迷因檢討會", d: "邊喝邊和同學交流珍藏梗圖，挑出最對味的那張。" },
      { time: "1:10–2:20", t: "AI 3D 小廢物煉成", d: "把梗圖二創、讓角色也一起喝醉，由平面轉為立體模型。" },
      { time: "2:20–3:00", t: "模型調整・匯出", d: "修整細節、加底座，匯出可列印的 STL 檔。" },
      { time: "3:00–3:30", t: "送印・收尾", d: "講解 FDM 列印與拆支撐，登記取件方式。" },
    ],
    bigTitle: "酒精 × 迷因 × AI × 3D 的究極課程",
    q: <>想邊喝邊上課？<br/>想找能喝酒又有趣的活動？<br/>愛喝酒又愛迷因還愛公仔？</>,
    lead: <>這堂課就是專門為各位酒鬼設計的，生活中身心俱疲了嗎？來一場下班後的桌面小廢物煉成之旅！！！</>,
    steps: [
      { t: "網路迷因檢討會＋酒精", img: "assets/meme-feat-create.webp?v=2", d: "蒐集以及與同學們交流、分享，組成您的超級迷因大軍，並挑到對味的梗圖。搭配精選酒款碰出新體驗。" },
      { t: "AI 3D 小廢物煉成",  img: "assets/meme-feat-ai.webp?v=2",     d: <>把您對味的梗圖迷因，透過煉成術調整細節或二創，讓您的角色也一起喝醉，再由平面轉為立體模型，<span style={{color:'#d6342c',fontWeight:800,textDecoration:'line-through'}}>嚴禁大葛葛！</span></> },
      { t: "列印公仔", img: "assets/meme-feat-print.webp?v=2",  d: "我：我需要那個酷東西 TT　列印姬：欸，這個可以，這個骨力！" },
    ],
    heading: "酒鬼班・專屬內容",
    body: "課程以「千杯千杯再千杯」為主要課程基調，與特色酒吧合作，提供優質酒精支援。讓我們在微醺的狀態一同把您的迷因角色也灌醉吧！",
    images: [
      { src: "assets/drunk-inner-1.webp", wide: true },
      { src: "assets/drunk-inner-2.webp", wide: true },
      { src: "assets/drunk-inner-3.webp", wide: true },
    ],
    signupArt: { kind: "meme", course: "drunk" },
    prepare: {
      required: [ "筆電", "一個可使用的 Gmail 帳號", "身分證（年齡證明）" ],
      recommended: [ "滑鼠（沒有滑鼠會較難操作）", "電繪板（如果您習慣電繪的話）", "自己的迷因庫（這樣比較不用花那麼多時間現場找梗圖）" ],
    },
    info: [
      { label: "上課時間", value: "3.5 小時" },
      { label: "課程金額", value: <><del>原價 3,500 元</del><strong>開幕特惠價 2,500 元</strong>（含酒錢、材料費）</> },
      { label: "開班人數", value: "10 人開班（達標會以 email 通知）" },
      { label: "課程日期", value: "請至結帳頁面查看與選擇" },
      { label: "課程地址", value: "台北市中山區長安東路二段 31 號 4 樓之 5 — 404Table 教室" },
      { label: "電腦硬體要求", value: "Windows 10+ 或 macOS 11+" },
    ],
    signupCap: "酒鬼班報名資訊圖（靜態圖片，待補）",
  },
};

// 細分班別頁面共用的預設「您要準備什麼／您能帶走什麼／課程說明」（個別班別可自行覆寫）
const COMMON_DETAIL = {
  prepare: {
    required: [
      "筆電",
      "一個可使用的 Gmail 帳號",
      "您慣用的創作媒材（例如色鉛筆、彩色筆等）",
      "教室會提供基礎的鉛筆與 A4 白紙",
    ],
    recommended: [
      "滑鼠（沒有滑鼠會較難操作）",
      "電繪板（如果您習慣電繪的話）",
    ],
  },
  take: [
    "數張您的創作草稿或參考圖",
    "一份您原創的 STL 模型檔案",
    "一個練習拆支撐的 FDM 小模型（贈品）",
    "上課作品的單色 FDM 列印模型（短課以課後寄送至您指定 7-11、全家門市或自取之方式取件）",
  ],
  info: [
    { label: "上課時間", value: "3–3.5 小時" },
    { label: "課程金額", value: <><del>原價 3,000 元</del><strong>限時開幕特惠價 1,500 元</strong>（含材料費）</> },
    { label: "開班人數", value: "10 人開班（達標會以 email 通知）" },
    { label: "課程日期", value: "請至結帳頁面查看與選擇" },
    { label: "課程地址", value: "台北市中山區長安東路二段 31 號 4 樓之 5 — 404Table 教室" },
    { label: "電腦硬體要求", value: "Windows 10+ 或 macOS 11+" },
  ],
};

// 親子班互動報名圖：基底常駐、紅鈕可點，按下後 3D 怪獸「變身」彈出再跳轉結帳
function SignupArt({ cfg }) {
  const [go, setGo] = React.useState(false);
  const click = () => {
    if (go) return;
    setGo(true);
    setTimeout(() => { window.location.href = "結帳.html?course=" + cfg.course; }, 1500);
  };
  const hs = cfg.hotspot;
  return (
    <div className={"signup-art" + (go ? " go" : "")}>
      <img className="sa-base" src={cfg.base} alt="親子班・按下報名鍵變身" />
      <img className="sa-monster" src={cfg.monster} alt="" />
      <img className="sa-cloudq" src={cfg.cloudq} alt="" />
      <img className="sa-btn" src={cfg.button} alt="" />
      <button className="sa-hotspot" onClick={click}
        style={{ left: hs.left + "%", top: hs.top + "%", width: hs.width + "%", height: hs.height + "%" }}
        aria-label="按下報名鍵變身，前往報名">報名</button>
    </div>
  );
}

// 迷因課互動報名圖：狗狗敲擊紅鈕 → BONK → 黑問號肌肉狗轉為立體並旋轉 → 跳轉結帳
function MemeSignupArt({ cfg }) {
  const [go, setGo] = React.useState(false);
  const click = () => {
    if (go) return;
    setGo(true);
    setTimeout(() => { window.location.href = "結帳.html?course=" + cfg.course; }, 2200);
  };
  return (
    <div className={"msa" + (go ? " go" : "")}>
      <img className="msa-label-r" src={A + "meme-signup-label-r.webp"} alt="上完課" />
      <img className="msa-label-l" src={A + "meme-signup-label-l.webp"} alt="敲打以報名" />
      <img className="msa-black" src={A + "meme-signup-muscle-black.webp"} alt="上完課前" />
      <img className="msa-color" src={A + "meme-signup-muscle-color.webp"} alt="上完課後的肌肉狗" />
      <img className="msa-btn" src={A + "meme-signup-button.webp"} alt="不按嗎" />
      <div className="msa-dog-grp">
        <img className="msa-sit" src={A + "meme-signup-dog-sit.webp"} alt="" />
        <img className="msa-bat" src={A + "meme-signup-bat.webp"} alt="" />
      </div>
      <img className="msa-bonk" src={A + "meme-signup-bonk.webp"} alt="BONK" />
      <button className="msa-hotspot" onClick={click}
        aria-label="敲打紅色按鈕，前往報名">報名</button>
    </div>
  );
}

// 首頁系列說明 + 細分班別說明共用的版型，確保排版風格一致。
// extra 有值時＝細分說明（多一段專屬文字＋圖片）；course 用於報名連結帶參數。
function CourseIntro({ extra, courseName }) {
  const isSeries = !extra;
  const course  = extra ? extra.course  : "";
  const isMeme = course === "good" || course === "drunk";
  const courseId = isMeme ? "meme" : "doodle";
  const intro = COURSE_INTRO[courseId] || COURSE_INTRO.doodle;
  const cleanName = (courseName || "").replace(/[？！?!]+$/, "");
  const eyebrow = isSeries ? "系列課程介紹" : extra.eyebrow;
  const signupCap = extra ? extra.signupCap : SERIES_MAIN.signupCap;
  const signupHref = "結帳.html" + (course ? "?course=" + course : "");
  const feats = isSeries ? SERIES_MAIN.steps : (extra.steps || intro.steps);
  const dPrepareRaw = extra && (extra.prepare || COMMON_DETAIL.prepare);
  const dPrepare = Array.isArray(dPrepareRaw) ? { required: dPrepareRaw } : dPrepareRaw;
  const dRecommend = dPrepare && dPrepare.recommended;
  const dTake    = extra && (extra.take    || COMMON_DETAIL.take);
  const dOutline = extra && extra.outline;
  const dInfo    = extra && (extra.info    || COMMON_DETAIL.info);
  return (
    <section className="section-wrap series-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="intro-bigtitle">{isSeries ? "XX 變 3D 模型系列課程" : (extra.bigTitle || intro.bigTitle)}</h2>
      {isSeries && <p className="intro-midtitle">{SERIES_MAIN.midTitle}</p>}
      <div className="intro-body">
        <p className="intro-q">{isSeries ? SERIES_MAIN.q : (extra.q || intro.q)}</p>
        <p className="intro-lead">{isSeries ? SERIES_MAIN.lead : (extra.lead || intro.lead)}</p>
      </div>

      <h3 className="block-head">三步驟流程</h3>
      <div className={"feature-grid" + (isMeme ? " feats-meme" : "")}>
        {feats.map((f, i) => (
          <div className="feature" key={i}>
            {f.img
              ? <div className="feat-art"><img src={f.img} alt={f.t} loading="lazy" decoding="async" /></div>
              : <div className="ph">課程示意圖</div>}
            <h4>{f.t}</h4>
            <p>{f.d}</p>
          </div>
        ))}
      </div>

      {isSeries && (
        <React.Fragment>
          <h3 className="block-head">這系列課您會學到什麼？</h3>
          <p className="learn-lead">
            <strong>這堂課的重點，從來不只是「會用 AI」。</strong>更重要的是在一次次快速迭代中，學會思考、判斷與取捨——知道自己要什麼，並慢慢長出屬於您自己的設計品味。
          </p>
          <ul className="learn-list">
            {SERIES_MAIN.learn.map((x, i) => (
              <li key={i}><strong>{x.h}</strong><span>{x.d}</span></li>
            ))}
          </ul>

          <h3 className="block-head">您要準備什麼？</h3>
          <ul className="prepare-list">
            {SERIES_MAIN.prepare.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
          <p className="prepare-note">{SERIES_MAIN.prepareNote}</p>

          <div className="series-bottom">
            <div className="series-btn-row">
              <button type="button" className="btn-top"
                      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑ 回到上方</button>
              <a className="btn-buy" href="結帳.html">不想多看，直接下單 →</a>
            </div>
            <p className="series-note">{SERIES_MAIN.footer}</p>
          </div>
        </React.Fragment>
      )}

      {extra && (
        <div className="detail-extra">
          <span className="eyebrow">{extra.heading}</span>
          <p className="intro-lead">{extra.body}</p>
          <div className="extra-imgs">
            {extra.images.map((im, i) =>
              typeof im === "string"
                ? <div className="ph extra-ph" key={i}>{im}</div>
                : <figure className={"extra-shot" + (im.wide ? " wide" : "")} key={i}>
                    <img src={im.src} alt={im.cap || ""} loading="lazy" decoding="async" />
                    {im.cap && <figcaption>{im.cap}</figcaption>}
                  </figure>
            )}
          </div>

          {dPrepare && (
            <React.Fragment>
              <h3 className="block-head">您要準備什麼？{dRecommend ? "（必要）" : ""}</h3>
              <ul className="prepare-list">
                {dPrepare.required.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
              {dRecommend && (
                <React.Fragment>
                  <p className="prepare-subhead">建議但非必要</p>
                  <ul className="prepare-list">
                    {dRecommend.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </React.Fragment>
              )}
            </React.Fragment>
          )}

          {dTake && (
            <React.Fragment>
              <h3 className="block-head">您能帶走什麼？</h3>
              <ul className="take-list">
                {dTake.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </React.Fragment>
          )}

          {dOutline && (
            <React.Fragment>
              <h3 className="block-head">課程大綱</h3>
              <ol className="outline-list">
                {dOutline.map((r, i) => (
                  <li key={i}>
                    <span className="ol-time">{r.time}</span>
                    <div className="ol-body"><strong>{r.t}</strong><span>{r.d}</span></div>
                  </li>
                ))}
              </ol>
              <p className="prepare-note">＊大綱為示意，實際進度依當天班級狀況彈性調整。</p>
            </React.Fragment>
          )}

          {dInfo && (
            <React.Fragment>
              <h3 className="block-head">課程說明</h3>
              <dl className="info-list">
                {dInfo.map((r, i) => (
                  <div className="info-row" key={i}>
                    <dt>{r.label}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
              </dl>
            </React.Fragment>
          )}
        </div>
      )}

      {extra && (
        <div className="signup-band">
          <span className="eyebrow">立即加入</span>
          {extra.signupArt
            ? (extra.signupArt.kind === "meme"
                ? <MemeSignupArt cfg={extra.signupArt} />
                : <SignupArt cfg={extra.signupArt} />)
            : <div className="ph signup-ph">
                <span className="cap">{signupCap}</span>
                <a className="btn-signup" href={signupHref}>立即報名 →</a>
              </div>}
        </div>
      )}
    </section>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [active, setActive] = useState(null);   // 'left' | 'right' | null
  const [phase, setPhase] = useState("home");    // 'home' | 'tearing' | 'revealed'
  const [entered, setEntered] = useState(null);  // 'family' | 'adult'
  const [tip, setTip] = useState({ show: false, x: 0, y: 0, side: null });
  const [touch, setTouch] = useState(false);
  const [sp, setSp] = useState(0);               // scroll progress 0..1
  const [activeCourse, setActiveCourse] = useState(0);  // centred course in the carousel
  const [drawerOpen, setDrawerOpen] = useState(false);    // 手機：右上角綜合選單抽屜
  const [dropdownOpen, setDropdownOpen] = useState(false);// 手機：所有課程選單下拉
  const menuRef = useRef(null);
  const cellRefs = useRef([]);
  const menuRaf = useRef(0);
  const settleTimer = useRef(0);
  const pressing = useRef(false);   // finger held on a hero half — pauses the auto-demo
  const pressStart = useRef(0);
  const artRef = useRef(null);      // hero artboard, for mapping touch-x → side
  const touchInfo = useRef({ x0: 0, t0: 0, moved: false });

  // —— mobile: auto-demo the desktop squeeze so the dynamic is visible
  //    without interaction; pauses itself while a finger is pressing a side ——
  useEffect(() => {
    if (!touch || phase !== "home" || !t.autoDemo) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hold = Math.max(0.5, t.demoHold) * 1000, gap = 460;
    const seq = [
      { side: "left",  d: hold },
      { side: null,    d: gap  },
      { side: "right", d: hold },
      { side: null,    d: gap  },
    ];
    let i = 0, timer = 0, stopped = false;
    const step = () => {
      if (stopped) return;
      if (pressing.current) { timer = setTimeout(step, 240); return; }
      setActive(seq[i].side);
      const d = seq[i].d;
      i = (i + 1) % seq.length;
      timer = setTimeout(step, d);
    };
    timer = setTimeout(step, 650);
    return () => { stopped = true; clearTimeout(timer); if (!pressing.current) setActive(null); };
  }, [touch, phase, t.autoDemo, t.demoHold]);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const upd = () => setTouch(mq.matches || location.hash.indexOf("mobpv") >= 0);
    upd();
    mq.addEventListener ? mq.addEventListener("change", upd) : mq.addListener(upd);
    window.addEventListener("hashchange", upd);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", upd) : mq.removeListener(upd); window.removeEventListener("hashchange", upd); };
  }, []);

  // scroll progress for the right-side rail
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setSp(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  // 抽屜開啟時鎖住背景捲動
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  useEffect(() => {
    let done = 0; const total = ALL_IMG.length;
    const el = document.getElementById("loading");
    const finish = () => { if (el) { el.classList.add("hide"); setTimeout(()=>el.remove(), 500); } };
    ALL_IMG.forEach(src => { const im = new Image(); im.onload = im.onerror = () => { if (++done >= total) finish(); }; im.src = src; });
    setTimeout(finish, 2500);
  }, []);

  const split = phase === "home" && active
    ? (active === "left" ? 50 + t.squeeze : 50 - t.squeeze)
    : 50;
  const dx = (split - 49.5).toFixed(2);

  const dim = t.dimOther;
  const winScale = 1.06, loseScale = 0.9, winBright = 1.05, loseBright = 0.8;
  const famTx    = active === "right" ? -(50 - split) : 0;
  const famScale = active === "left" ? winScale : active === "right" ? loseScale : 1;
  const famBright= active === "left" ? winBright : (active === "right" && dim) ? loseBright : 1;
  const aduScale = active === "right" ? winScale : active === "left" ? loseScale : 1;
  const aduBright= active === "right" ? winBright : (active === "left" && dim) ? loseBright : 1;

  const motionVars = {
    "--split": split + "%",
    "--kraft-dx": dx + "%",
    "--fam-tx": famTx + "%",
    "--fam-scale": famScale,
    "--fam-bright": famBright,
    "--adu-scale": aduScale,
    "--adu-bright": aduBright,
  };

  const enter = useCallback((side) => {
    const c = COURSES[activeCourse];
    setEntered(side === "left" ? c.left.key : c.right.key);
    setActive(null);
    setTip(p => ({ ...p, show: false }));
    setPhase("tearing");
    setTimeout(() => setPhase("revealed"), 780);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeCourse]);

  const back = useCallback(() => {
    setPhase("home");
    setTimeout(() => setEntered(null), 780);
  }, []);

  // —— centre-anchored course carousel (JS snapping for exact centering) ——
  const nearestToCenter = (c) => {
    const center = c.scrollLeft + c.clientWidth / 2;
    let best = 0, bestD = Infinity;
    cellRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };
  const centerCourse = useCallback((i, behavior = "smooth") => {
    const c = menuRef.current, el = cellRefs.current[i];
    if (c && el) c.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - c.clientWidth / 2, behavior });
  }, []);
  const selectCourse = (i) => {
    setActiveCourse(i);
    centerCourse(i);
    // switching the theme course resets the hero back to its split state
    setActive(null);
    setPhase("home");
    setEntered(null);
  };
  // 手機：從綜合選單直接跳到某課程的某個班別（封面已撕開、直接看細分說明）
  const goToClass = (ci, side) => {
    const c = COURSES[ci];
    setActiveCourse(ci);
    centerCourse(ci, "auto");
    setDrawerOpen(false);
    setDropdownOpen(false);
    if (c.comingSoon) { setActive(null); setPhase("home"); setEntered(null); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setEntered(side === "left" ? c.left.key : c.right.key);
    setActive(null);
    setTip(p => ({ ...p, show: false }));
    setPhase("tearing");
    setTimeout(() => setPhase("revealed"), 780);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const onMenuScroll = () => {
    cancelAnimationFrame(menuRaf.current);
    menuRaf.current = requestAnimationFrame(() => {
      const c = menuRef.current; if (!c) return;
      setActiveCourse(nearestToCenter(c));
    });
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const c = menuRef.current; if (!c) return;
      const i = nearestToCenter(c), el = cellRefs.current[i];
      if (!el) return;
      const target = el.offsetLeft + el.offsetWidth / 2 - c.clientWidth / 2;
      if (Math.abs(c.scrollLeft - target) > 3) centerCourse(i);
    }, 130);
  };

  const onMove = (e, side) => {
    if (touch || phase !== "home") return;
    setTip({ show: true, x: e.clientX, y: e.clientY, side });
  };

  const tapRef = useRef({ side: null, t: 0 });
  const onClick = (side) => {
    if (phase !== "home") return;
    if (touch && t.enterOn === "double") {
      const now = Date.now();
      if (tapRef.current.side === side && now - tapRef.current.t < 600) { enter(side); return; }
      tapRef.current = { side, t: now };
      setActive(side);
      setTimeout(() => setActive(a => a === side ? null : a), 1500);
      return;
    }
    enter(side);
  };

  // —— mobile: the squeeze auto-plays, but the moment a finger lands it FREEZES
  //    on the frame under that finger and tracks it left/right as the finger
  //    slides; lifting resumes the auto-demo. A quick still tap = enter. ——
  const sideFromX = (clientX) => {
    const el = artRef.current; if (!el) return "left";
    const r = el.getBoundingClientRect();
    return (clientX - r.left) < r.width / 2 ? "left" : "right";
  };
  const onArtTouchStart = (e) => {
    if (phase !== "home") return;
    const tch = e.touches[0]; if (!tch) return;
    touchInfo.current = { x0: tch.clientX, t0: Date.now(), moved: false };
    pressing.current = true;               // freezes the auto-demo (it polls this flag)
    setActive(sideFromX(tch.clientX));
  };
  const onArtTouchMove = (e) => {
    if (phase !== "home" || !pressing.current) return;
    const tch = e.touches[0]; if (!tch) return;
    if (Math.abs(tch.clientX - touchInfo.current.x0) > 8) touchInfo.current.moved = true;
    setActive(sideFromX(tch.clientX));     // follow the finger, stay frozen on that frame
  };
  const onArtTouchEnd = (e) => {
    if (phase !== "home") return;
    if (e && e.cancelable) e.preventDefault();   // suppress the synthetic click
    const held = Date.now() - touchInfo.current.t0;
    const moved = touchInfo.current.moved;
    pressing.current = false;
    const tch = (e.changedTouches && e.changedTouches[0]) || null;
    if (!moved && held < 320) {
      onClick(sideFromX(tch ? tch.clientX : touchInfo.current.x0));  // still tap → enter
    } else {
      setActive(null);                     // released after holding/sliding → resume auto-demo
    }
  };

  const course = COURSES[activeCourse];
  const coverBg = (entered && course.cover[entered]) || course.cover[course.left.key];
  const isHome = phase === "home";
  const enteredLabel = entered === course.right.key ? course.right.label : course.left.label;

  const stageCls = [
    "stage", "hero-frame",
    active ? "active-" + active : "",
    t.dimOther ? "dim" : "",
    "shadow-" + t.paperShadow,
    touch ? "touch" : "",
    phase === "tearing" ? "tearing" : "",
    phase === "revealed" ? "revealed" : "",
  ].filter(Boolean).join(" ");

  const tipText = (tip.side === "left" ? course.left.label : course.right.label) + "・" + t.tooltipText;

  // 手機版三區塊課程選擇列（可放封面上方或下方）
  const courseBar = (
    <header className="mobile-coursebar">
      <div className="mcb-head">
        <button type="button" className={"mcb-title" + (dropdownOpen ? " open" : "")}
                aria-expanded={dropdownOpen}
                onClick={() => setDropdownOpen(o => !o)}>
          本系列所有課程選單 <span className="caret">▾</span>
        </button>
      </div>
      <div className="mcb-segs">
        {COURSES.map((c, i) => (
          <button type="button" key={i}
                  className={"mcb-seg" + (i === activeCourse ? " active" : "")}
                  onClick={() => { selectCourse(i); setDropdownOpen(false); }}>
            {c.short || c.name}
          </button>
        ))}
      </div>
      {dropdownOpen && (
        <div className="mcb-dropdown" role="menu">
          {COURSES.map((c, i) => (
            <button type="button" key={i} role="menuitem"
                    className={i === activeCourse ? "active" : ""}
                    onClick={() => { selectCourse(i); setDropdownOpen(false); }}>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </header>
  );

  // 底部固定報名列：已選班別→帶班別與特惠價直達結帳；未選→系列報名
  const ctaActive = phase === "revealed" && !!entered;
  const ctaPrice = ctaActive ? PRICE[entered] : null;
  const ctaHref = "結帳.html" + (ctaActive ? "?course=" + entered : "");
  const showCTA = t.stickyCTA && !(course.comingSoon && !ctaActive);

  return (
    <div className="page">

      {/* ============ 手機版：三區塊課程選擇列（位置可由 Tweaks 調整）============ */}
      {t.menuPos !== "below" && courseBar}

      {/* ============ HERO FRAME (16:9 torn-paper split) ============ */}
      <section className={stageCls}
               onMouseLeave={() => { setActive(null); setTip(p=>({...p, show:false})); }}>
        <div className="artboard" style={motionVars} ref={artRef}
             onTouchStart={onArtTouchStart}
             onTouchMove={onArtTouchMove}
             onTouchEnd={onArtTouchEnd}>

          {course.comingSoon
            ? <div className="coming-soon" aria-label="敬請期待"><span>敬請期待</span></div>
            : <>
                {course.hero === "meme"
                  ? <MemeLayers coverBg={coverBg} />
                  : <DoodleLayers coverBg={coverBg} showSubtitle={t.showSubtitle} />}

                <div className="hit left"
                     onMouseEnter={() => !touch && phase==="home" && setActive("left")}
                     onMouseMove={(e)=>onMove(e,"left")}
                     onClick={()=>{ if(!touch) onClick("left"); }} />
                <div className="hit right"
                     onMouseEnter={() => !touch && phase==="home" && setActive("right")}
                     onMouseMove={(e)=>onMove(e,"right")}
                     onClick={()=>{ if(!touch) onClick("right"); }} />
              </>}
        </div>
      </section>

      {/* ============ HERO CUES (click + scroll) ============ */}
      {isHome && !course.comingSoon && (
        <div className="hero-cues">
          <p className="click-hint">
            <span className="up"></span>
            {touch
              ? <>點上方封面選擇：<span className="ch-name">{course.left.label}</span> 或 <span className="ch-name">{course.right.label}</span>，<span className="hint-tail">以瞭解該班課程介紹</span></>
              : "請點擊上方封面選擇想參加的班別"}
          </p>
          <div className="scroll-cue" aria-hidden="true">
            <span>向下捲動，瞭解此系列課程</span>
            <span className="chev"></span>
          </div>
        </div>
      )}

      {/* 課程選單放「封面下方」時，於此處渲染 */}
      {t.menuPos === "below" && courseBar}

      {/* 手機版：班別直接選擇（選中才亮，邏輯與課程選單一致；home 與 revealed 皆顯示）*/}
      {!course.comingSoon && (
        <div className="class-pick">
          <button type="button"
                  className={entered === course.left.key ? "active" : ""}
                  onClick={() => (phase === "revealed" && entered === course.left.key) ? back() : enter("left")}>
            {course.left.label}
          </button>
          <button type="button"
                  className={entered === course.right.key ? "active" : ""}
                  onClick={() => (phase === "revealed" && entered === course.right.key) ? back() : enter("right")}>
            {course.right.label}
          </button>
        </div>
      )}

      {/* ============ 主題課程選單 (色塊＋文字) ============ */}
      {isHome && (
        <div className="section-wrap menu-block">
          <div className="menu-head">
            <span className="eyebrow">本系列・所有課程選單</span>
            <span className="menu-hint">滑動查看更多 →</span>
          </div>
          <nav className="theme-menu" ref={menuRef} onScroll={onMenuScroll}>
            <div className="menu-spacer" aria-hidden="true"></div>
            {COURSES.map((c, i) => (
              <a className={"theme-cell" + (i === activeCourse ? " active" : "")} href="#" key={i}
                 ref={el => cellRefs.current[i] = el}
                 onClick={(e)=>{ e.preventDefault(); selectCourse(i); }}>
                {c.name}<span className="arrow">›</span>
              </a>
            ))}
            <div className="menu-spacer" aria-hidden="true"></div>
          </nav>
        </div>
      )}

      {/* ============ 課程說明（首頁＝系列說明；選班別＝細分說明）============ */}
      {isHome && !course.comingSoon && <CourseIntro extra={null} courseName={course.name} />}
      {phase === "revealed" && entered && (
        <CourseIntro extra={DETAIL_EXTRA[entered]} courseName={course.name} />
      )}

      {/* ============ overlays ============ */}

      {/* 電腦版：右側半透明側邊欄（觸發頁籤 + 滑出面板）*/}
      <button type="button" className="side-tab" aria-label="開啟課程選單"
              onClick={() => setDrawerOpen(true)}>
        <span className="st-bars"><span></span><span></span><span></span></span>
        課程・報名
      </button>
      <div className={"side-scrim" + (drawerOpen ? " open" : "")}
           onClick={() => setDrawerOpen(false)}></div>
      <aside className={"side-panel" + (drawerOpen ? " open" : "")} aria-hidden={!drawerOpen}>
        <div className="sp-head">
          <h3>所有課程</h3>
          <button type="button" className="sp-close" aria-label="關閉選單"
                  onClick={() => setDrawerOpen(false)}>✕</button>
        </div>
        <div className="sp-body">
          {COURSES.map((c, i) => (
            <div className={"sp-course" + (i === activeCourse ? " cur" : "")} key={i}>
              <button type="button" className="sp-name"
                      onClick={() => { selectCourse(i); setDrawerOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                {c.short || c.name}
              </button>
              {c.comingSoon
                ? <p className="sp-soon">敬請期待，更多課程籌備中</p>
                : <div className="sp-classes">
                    <button type="button" className="sp-class" onClick={() => goToClass(i, "left")}>
                      {c.left.label}<span className="go">→</span>
                    </button>
                    <button type="button" className="sp-class" onClick={() => goToClass(i, "right")}>
                      {c.right.label}<span className="go">→</span>
                    </button>
                  </div>}
            </div>
          ))}
        </div>
        <div className="sp-foot">
          <a className="sp-pay" href="結帳.html">前往報名・結帳 →</a>
        </div>
      </aside>

      <div className={"tooltip" + (tip.show ? " show" : "")} style={{ left: tip.x, top: tip.y }}>
        {tipText}<span className="arrow">→</span>
      </div>

      <button className={"backbtn" + (phase === "revealed" ? " show" : "")} onClick={back}>‹ 返回選擇</button>

      <div className="scroll-rail" style={{ "--sp": sp }}>
        <div className="track"><div className="thumb" /></div>
        <div className={"rail-hint" + (sp > 0.02 ? " gone" : "")}>向下捲動</div>
      </div>

      {/* 底部固定報名列（手機版）— 最直覺、最短的付款路徑 */}
      {showCTA && (
        <a className={"mobile-cta" + (ctaActive ? " is-class" : "")} href={ctaHref}>
          <div className="cta-info">
            {ctaActive
              ? <React.Fragment>
                  <span className="cta-label">{enteredLabel}・限時開幕特惠</span>
                  <span className="cta-price"><del>原價 {ctaPrice.was}</del><span className="amt">NT$&nbsp;{ctaPrice.now}</span></span>
                </React.Fragment>
              : <React.Fragment>
                  <span className="cta-label">{course.short}・限時開幕特惠</span>
                  <span className="cta-price">名額有限，立即卡位 →</span>
                </React.Fragment>}
          </div>
          <span className="cta-btn">{ctaActive ? "報名 " + enteredLabel : "立即報名"}</span>
        </a>
      )}

      <TweaksPanel>
        <TweakSection label="撕紙分流視覺" />
        <TweakSlider label="排擠強度" value={t.squeeze} min={6} max={26} unit="%"
                     onChange={(v)=>setTweak("squeeze", v)} />
        <TweakRadio label="紙張立體陰影" value={t.paperShadow}
                    options={[{value:"none",label:"無"},{value:"soft",label:"淺"},{value:"deep",label:"深"}]}
                    onChange={(v)=>setTweak("paperShadow", v)} />
        <TweakToggle label="壓暗另一側" value={t.dimOther} onChange={(v)=>setTweak("dimOther", v)} />
        <TweakText label="提示文字" value={t.tooltipText} onChange={(v)=>setTweak("tooltipText", v)} />
        <TweakToggle label="顯示底部標語條" value={t.showSubtitle} onChange={(v)=>setTweak("showSubtitle", v)} />

        <TweakSection label="手機互動" />
        <TweakToggle label="底部固定報名列" value={t.stickyCTA} onChange={(v)=>setTweak("stickyCTA", v)} />
        <TweakRadio label="課程選單位置" value={t.menuPos}
                    options={[{value:"top",label:"封面上方"},{value:"below",label:"封面下方"}]}
                    onChange={(v)=>setTweak("menuPos", v)} />
        <TweakToggle label="自動展示排擠動態" value={t.autoDemo} onChange={(v)=>setTweak("autoDemo", v)} />
        <TweakSlider label="展示停留" value={t.demoHold} min={0.6} max={2.2} step={0.05} unit="s"
                     onChange={(v)=>setTweak("demoHold", v)} />
        <TweakRadio label="進入方式" value={t.enterOn}
                    options={[{value:"single",label:"點一下"},{value:"double",label:"點兩下"}]}
                    onChange={(v)=>setTweak("enterOn", v)} />
        <div style={{fontSize:11, color:"#8a8275", padding:"4px 2px 0", lineHeight:1.5}}>
          手機：封面會自動左右輪流排擠示範；長按任一側可預覽該側排擠，點一下即撕開看封面。
        </div>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
