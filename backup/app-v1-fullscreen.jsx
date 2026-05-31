const { useState, useEffect, useRef, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "squeeze": 15,
  "dimOther": true,
  "paperShadow": "soft",
  "tooltipText": "點擊可以瞭解詳情",
  "showSubtitle": true,
  "mobileHint": "wobble",
  "hintSpeed": 2.6,
  "enterOn": "single"
}/*EDITMODE-END*/;

const A = "assets/";

// sprite layout (% of 16:9 artboard) — taken from each PNG's exact position in 首頁
const FAMILY = [
  { src: A + "char-family-doodle.webp",  left: 15.8, top: 47.1, w: 16.5, cls: "hero" },
  { src: A + "char-family-3d.webp",      left: 37.4, top: 48.1, w: 16.0, cls: "hero" },
];
const ADULT = [
  { src: A + "char-adult-doodle.webp",   left: 66.4, top: 46.3, w: 14.8, cls: "hero" },
  { src: A + "char-adult-3d.webp",       left: 85.7, top: 45.9, w: 14.1, cls: "hero" },
];
// tapes live in their own layer above both sheets; 親子 tape sits ON TOP of 成人班
// tape so it never covers the 「親子」 text (adult drawn first = underneath).
const TAPE_ADULT  = { src: A + "tape-adult.webp",  left: 38.58, top: 5.99, w: 39.60 };
const TAPE_FAMILY = { src: A + "tape-family.webp", left: 25.11, top: 6.12, w: 24.89 };

const ALL_IMG = [
  A+"paper-white.webp", A+"kraft-wide.webp", A+"title.webp", A+"subtitle-clean-y56.webp",
  TAPE_ADULT.src, TAPE_FAMILY.src,
  ...FAMILY.map(s=>s.src), ...ADULT.map(s=>s.src),
  A+"cover-family.webp", A+"cover-adult.webp",
];

function Sprite({ s }) {
  return (
    <img className={"sprite " + s.cls} src={s.src} alt=""
         style={{ left: s.left + "%", top: s.top + "%", width: s.w + "%" }} />
  );
}
// NOTE: .sprite scale comes from the --spr-scale var set on its parent group,
// so the squeeze emphasis stays glued to each character (no detaching / 破圖).

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [active, setActive] = useState(null);   // 'left' | 'right' | null
  const [phase, setPhase] = useState("home");    // 'home' | 'tearing' | 'revealed'
  const [entered, setEntered] = useState(null);  // 'family' | 'adult'
  const [tip, setTip] = useState({ show: false, x: 0, y: 0, side: null });
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const upd = () => setTouch(mq.matches);
    upd();
    mq.addEventListener ? mq.addEventListener("change", upd) : mq.addListener(upd);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", upd) : mq.removeListener(upd); };
  }, []);

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
  // the whole kraft unit (paper at 141% w, torn edge resting at 49.5%) slides by
  // dx so the torn seam lands exactly on `split`. doodles + tape ride along.
  const dx = (split - 49.5).toFixed(2);

  // ---- squeeze emphasis: winner brightens + pops forward (scale up), loser
  //      dims + recedes (scale down) + gets pushed toward its outer edge.
  const dim = t.dimOther;
  const winScale = 1.06, loseScale = 0.9, winBright = 1.05, loseBright = 0.8;
  const famTx    = active === "right" ? -(50 - split) : 0;     // 親子 loser pushed left
  const famScale = active === "left" ? winScale : active === "right" ? loseScale : 1;
  const famBright= active === "left" ? winBright : (active === "right" && dim) ? loseBright : 1;
  const aduScale = active === "right" ? winScale : active === "left" ? loseScale : 1;
  const aduBright= active === "right" ? winBright : (active === "left" && dim) ? loseBright : 1;
  // 成人 loser is pushed right automatically by dx (kraft slides away).

  const motionVars = {
    "--split": split + "%",
    "--kraft-dx": dx + "%",
    "--fam-tx": famTx + "%",
    "--fam-scale": famScale,
    "--fam-bright": famBright,
    "--adu-scale": aduScale,
    "--adu-bright": aduBright,
    "--hint-dur": t.hintSpeed + "s",
  };

  const enter = useCallback((side) => {
    setEntered(side === "left" ? "family" : "adult");
    setActive(null);
    setTip(p => ({ ...p, show: false }));
    setPhase("tearing");
    setTimeout(() => setPhase("revealed"), 780);
  }, []);

  const back = useCallback(() => {
    setPhase("home");
    setTimeout(() => setEntered(null), 780);
  }, []);

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

  const coverBg = entered === "family" ? A+"cover-family.webp" : A+"cover-adult.webp";

  const stageCls = [
    "stage",
    active ? "active-" + active : "",
    t.dimOther ? "dim" : "",
    "shadow-" + t.paperShadow,
    touch ? "touch" : "",
    touch ? "hint-" + t.mobileHint : "",
    phase === "tearing" ? "tearing" : "",
    phase === "revealed" ? "revealed" : "",
  ].filter(Boolean).join(" ");

  const tipText = (tip.side === "left" ? "親子班・" : "成人班・") + t.tooltipText;

  return (
    <div className={stageCls}
         onMouseLeave={() => { setActive(null); setTip(p=>({...p, show:false})); }}>
      <div className="artboard" style={motionVars}>

        <div className="layerbox cover-layer" style={{ backgroundImage:`url(${coverBg})` }} />

        {/* left side: white paper (static full-bleed base, always under kraft) */}
        <img className="white-paper" src={A+"paper-white.webp"} alt="" />
        {/* 親子班 doodles — pop forward / recede & slide away, glued to the paper */}
        <div className="family-content">
          {FAMILY.map((s,i) => <Sprite key={i} s={s} />)}
        </div>

        {/* right unit — kraft paper + 成人班 doodles slide / dim together as one piece */}
        <div className="kraft-layer">
          <div className="kraft-slide">
            <img className="kraft-paper" src={A+"kraft-wide.webp"} alt="" />
            {ADULT.map((s,i) => <Sprite key={i} s={s} />)}
          </div>
        </div>

        {/* tapes — own layer; 親子 always above 成人. each tape rides with its side's
            motion (slide + pop/recede) so neither feels stuck to the screen. */}
        <div className="tape-layer">
          <img className="tape tape-adult" src={TAPE_ADULT.src} alt="成人班"
               style={{ left:TAPE_ADULT.left+"%", top:TAPE_ADULT.top+"%", width:TAPE_ADULT.w+"%" }} />
          <img className="tape tape-family" src={TAPE_FAMILY.src} alt="親子班"
               style={{ left:TAPE_FAMILY.left+"%", top:TAPE_FAMILY.top+"%", width:TAPE_FAMILY.w+"%" }} />
        </div>

        {/* exact title + subtitle from the 首頁 PNG */}
        <div className="layerbox title-layer">
          <img className="title-img" src={A+"title.webp"} alt="塗鴉變 3D 模型？！" />
          {t.showSubtitle &&
            <img className="subtitle-img" src={A+"subtitle-clean-y56.webp"} alt="零基礎用隨手 塗鴉+AI 創作出你的列印公仔" />}
        </div>

        {/* hit zones */}
        <div className="hit left"
             onMouseEnter={() => phase==="home" && setActive("left")}
             onMouseMove={(e)=>onMove(e,"left")}
             onClick={()=>onClick("left")} />
        <div className="hit right"
             onMouseEnter={() => phase==="home" && setActive("right")}
             onMouseMove={(e)=>onMove(e,"right")}
             onClick={()=>onClick("right")} />

        {/* mobile tap pills */}
        {touch && phase==="home" && (<>
          <div className="tap-pill" style={{ left: (split/2) + "%" }}>點我看親子班 <span className="arrow">›</span></div>
          <div className="tap-pill" style={{ left: (split + (100-split)/2) + "%" }}>點我看成人班 <span className="arrow">›</span></div>
        </>)}
      </div>

      <div className={"tooltip" + (tip.show ? " show" : "")} style={{ left: tip.x, top: tip.y }}>
        {tipText}<span className="arrow">→</span>
      </div>

      <button className="backbtn" onClick={back}>‹ 返回選擇</button>

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
        <TweakRadio label="提示動態" value={t.mobileHint}
                    options={[{value:"wobble",label:"晃動"},{value:"breathe",label:"呼吸"},{value:"glow",label:"發光"}]}
                    onChange={(v)=>setTweak("mobileHint", v)} />
        <TweakSlider label="提示節奏" value={t.hintSpeed} min={1.5} max={4} step={0.1} unit="s"
                     onChange={(v)=>setTweak("hintSpeed", v)} />
        <TweakRadio label="進入方式" value={t.enterOn}
                    options={[{value:"single",label:"點一下"},{value:"double",label:"點兩下"}]}
                    onChange={(v)=>setTweak("enterOn", v)} />
        <div style={{fontSize:11, color:"#8a8275", padding:"4px 2px 0", lineHeight:1.5}}>
          桌機：滑過任一側即可預覽整張紙的排擠效果；手機：依「提示動態」輪流提示可點。
        </div>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
