// ===================================================================
// DoodleLayers — the torn-paper split for 塗鴉變 3D 模型
// (the original 招生分流首頁 hero, extracted verbatim so it can be
//  swapped against MemeLayers by the course carousel)
// Renders the artboard's inner layers; the <section.stage> wrapper,
// hit zones and tap pills live in App.
// ===================================================================
const DA = "assets/";

const D_FAMILY = [
  { src: DA + "char-family-doodle.webp",  left: 15.8, top: 47.1, w: 16.5, cls: "hero" },
  { src: DA + "char-family-3d.webp",      left: 37.4, top: 48.1, w: 16.0, cls: "hero" },
];
const D_ADULT = [
  { src: DA + "char-adult-doodle.webp",   left: 66.4, top: 46.3, w: 14.8, cls: "hero" },
  { src: DA + "char-adult-3d.webp",       left: 85.7, top: 45.9, w: 14.1, cls: "hero" },
];
const D_TAPE_ADULT  = { src: DA + "tape-adult.webp",  left: 38.58, top: 5.99, w: 39.60 };
const D_TAPE_FAMILY = { src: DA + "tape-family.webp", left: 25.11, top: 6.12, w: 24.89 };

function DoodleSprite({ s }) {
  return (
    <img className={"sprite " + s.cls} src={s.src} alt=""
         style={{ left: s.left + "%", top: s.top + "%", width: s.w + "%" }} />
  );
}

function DoodleLayers({ coverBg, showSubtitle }) {
  return (
    <React.Fragment>
      <div className="layerbox cover-layer" style={{ backgroundImage: `url(${coverBg})` }} />

      <img className="white-paper" src={DA + "paper-white.webp"} alt="" />
      <div className="family-content">
        {D_FAMILY.map((s, i) => <DoodleSprite key={i} s={s} />)}
      </div>

      <div className="kraft-layer">
        <div className="kraft-slide">
          <img className="kraft-paper" src={DA + "kraft-wide.webp"} alt="" />
          {D_ADULT.map((s, i) => <DoodleSprite key={i} s={s} />)}
        </div>
      </div>

      <div className="tape-layer">
        <img className="tape tape-adult" src={D_TAPE_ADULT.src} alt="成人班"
             style={{ left: D_TAPE_ADULT.left + "%", top: D_TAPE_ADULT.top + "%", width: D_TAPE_ADULT.w + "%" }} />
        <img className="tape tape-family" src={D_TAPE_FAMILY.src} alt="親子班"
             style={{ left: D_TAPE_FAMILY.left + "%", top: D_TAPE_FAMILY.top + "%", width: D_TAPE_FAMILY.w + "%" }} />
      </div>

      <div className="layerbox title-layer">
        <img className="title-img" src={DA + "title.webp"} alt="塗鴉變 3D 模型？！" />
        {showSubtitle &&
          <img className="subtitle-img" src={DA + "subtitle-clean-y56.webp"} alt="零基礎用隨手 塗鴉+AI 創作出您的列印公仔" />}
      </div>
    </React.Fragment>
  );
}

// images this hero needs preloaded
const DOODLE_IMG = [
  DA+"paper-white.webp", DA+"kraft-wide.webp", DA+"title.webp", DA+"subtitle-clean-y56.webp",
  D_TAPE_ADULT.src, D_TAPE_FAMILY.src,
  ...D_FAMILY.map(s=>s.src), ...D_ADULT.map(s=>s.src),
  DA+"cover-family.webp", DA+"cover-adult.webp",
];

Object.assign(window, { DoodleLayers, DOODLE_IMG });
