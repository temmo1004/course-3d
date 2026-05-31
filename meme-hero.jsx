// ===================================================================
// MemeLayers — the galaxy / white split for 迷因變 3D 模型
//   LEFT  : 健康乖寶寶班  — 星空底 + 貓 + 「0%」
//   RIGHT : 酒鬼班        — 白底   + 李奧納多 + 「酒鬼」
// Same squeeze → tear → reveal mechanic as DoodleLayers, but the
// artwork is a stack of full-canvas (16:9) pre-positioned PNGs that
// are clipped to each side by --split. The <section.stage> wrapper,
// hit zones and tap pills live in App.
// ===================================================================
const MA = "assets/";

function MemeLayers({ coverBg }) {
  return (
    <React.Fragment>
      {/* revealed clean cover (細分課封面) — shown once torn apart */}
      <div className="layerbox cover-layer" style={{ backgroundImage: `url(${coverBg})` }} />

      {/* LEFT — 健康乖寶寶班 */}
      <div className="m-scene m-left">
        <img className="m-bg"   src={MA + "meme-bg-galaxy.webp"} alt="" />
        <div className="m-hero-pos m-pos-left">
          <img className="m-hero m-hero-left" src={MA + "meme-cat.webp?v=2"} alt="健康乖寶寶班" />
        </div>
        <img className="m-label m-label-left" src={MA + "meme-label-zero.webp"} alt="0%" />
      </div>

      {/* RIGHT — 酒鬼班 */}
      <div className="m-scene m-right">
        <img className="m-bg"   src={MA + "meme-bg-white.webp"} alt="" />
        <div className="m-hero-pos m-pos-right">
          <img className="m-hero m-hero-right" src={MA + "meme-dicaprio.webp?v=2"} alt="酒鬼班" />
        </div>
        <img className="m-label m-label-right" src={MA + "meme-label-drunk.webp"} alt="酒鬼" />
      </div>

      {/* title + rainbow subtitle band (single combined PNG) */}
      <div className="layerbox title-layer m-title">
        <img className="m-titleimg" src={MA + "meme-title.webp"} alt="迷因變 3D 模型？！ — 零基礎用網路迷因+AI 創作出您的列印公仔" />
      </div>
    </React.Fragment>
  );
}

const MEME_IMG = [
  MA+"meme-bg-galaxy.webp", MA+"meme-bg-white.webp", MA+"meme-title.webp",
  MA+"meme-cat.webp", MA+"meme-dicaprio.webp",
  MA+"meme-label-zero.webp", MA+"meme-label-drunk.webp",
  MA+"meme-cover-good.webp", MA+"meme-cover-drunk.webp",
];

Object.assign(window, { MemeLayers, MEME_IMG });
