const SVG = "http://www.w3.org/2000/svg";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const touch = window.matchMedia("(hover: none)").matches;
const narrow = window.matchMedia("(max-width: 640px)");

function el(name, attrs, parent) {
  const n = document.createElementNS(SVG, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

// Draws one box with a title and a small mono subtitle.
function drawNode(parent, n, x, y, w, h, fs) {
  const g = el("g", { class: `node ${n.k}`, "data-id": n.id }, parent);
  if (n.k === "core" && fs.ring) {
    const ring = el("rect", { class: "ring", x: x - w / 2 - 7, y: y - h / 2 - 7, width: w + 14, height: h + 14, rx: 15 }, g);
    if (!reduceMotion) el("animate", { attributeName: "opacity", values: "0.3;0.04;0.3", dur: "3s", repeatCount: "indefinite" }, ring);
  }
  el("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 9 }, g);
  const big = n.k === "core" && fs.ring;
  el("text", { class: "t", x, y: y - 3, "text-anchor": "middle", "font-size": big ? fs.t + 5 : fs.t }, g).textContent = n.t;
  el("text", { class: "s", x, y: y + (big ? 19 : 15), "text-anchor": "middle", "font-size": fs.s }, g).textContent = n.s;
  return g;
}

// Moving dots along a path. `both` sends dots in both directions.
function addDots(layer, pathId, len, both, i, a, b) {
  if (reduceMotion) return;
  const dur = Math.max(1.6, len / 70).toFixed(2);
  [false, both].forEach((rev, j) => {
    if (j === 1 && !rev) return;
    const dot = el("circle", { r: 3.2, class: "dot", "data-a": a, "data-b": b }, layer);
    const anim = el("animateMotion", {
      dur: `${dur}s`, repeatCount: "indefinite",
      begin: `${(-(i * 0.43) - j * dur / 2).toFixed(2)}s`,
      ...(rev ? { keyPoints: "1;0", keyTimes: "0;1", calcMode: "linear" } : {}),
    }, dot);
    el("mpath", { href: `#${pathId}` }, anim);
  });
}

/* ---------------- System map (hero) ---------------- */
// w = [x, y] on the 1000x560 wide map, m = [x, y] on the 400x790 tall map.
const NODES = {
  shopify:  { t: "Commerce core", s: "Shopify · 4 stores", k: "core", w: [500, 280], m: [200, 270],
              d: "The client's store platform. Each service listens to its events or writes back through its API." },
  fraud:    { t: "Fraud screening", s: "webhooks · scoring", k: "mine", w: [290, 90], m: [70, 160], c: "fraud",
              d: "Scores every new order. Cancels known fraud and queues risky orders for support." },
  oauth:    { t: "Auth service", s: "OAuth · tokens", k: "mine", w: [500, 90], m: [200, 50], c: "oauth",
              d: "Connects each store once and hands tokens to every other app." },
  wishlist: { t: "Wishlist app", s: "Remix · Prisma", k: "mine", w: [710, 90], m: [330, 160], c: "wishlist",
              d: "Custom Shopify app that replaced a paid one, with a conversion report and marketing sync." },
  subs:     { t: "Sub reporting", s: "daily rollups", k: "mine", w: [290, 280], m: [200, 610], c: "subs",
              d: "Turns subscription data from four stores into daily numbers in Asana." },
  sync:     { t: "Product sync", s: "job queue · per store", k: "mine", w: [710, 280], m: [330, 380], c: "sync",
              d: "Copies products from the main store to three regional stores, with a preview first." },
  erp:      { t: "ERP sync", s: "middleware", k: "mine", w: [500, 470], m: [70, 380], c: "erp",
              d: "Two-way product and stock sync between the ERP and Shopify, plus a sales portal." },
  support:  { t: "Support team", s: "review dashboard", k: "ext", w: [90, 90], m: [70, 50],
              d: "Reviews flagged orders in a dashboard with their own logins, notes, and actions." },
  klaviyo:  { t: "Klaviyo", s: "email marketing", k: "ext", w: [910, 90], m: [330, 50],
              d: "Gets each shopper's saved products, so campaigns can say \"still on your wishlist\"." },
  asana:    { t: "Asana", s: "leadership view", k: "ext", w: [90, 280], m: [330, 610],
              d: "Custom fields update themselves every day. No more copying numbers." },
  recharge: { t: "Recharge", s: "subscriptions", k: "ext", w: [90, 470], m: [70, 610],
              d: "Subscription platform. Orders and subscriptions are pulled for all four stores." },
  stores:   { t: "CA · EU · AU", s: "regional stores", k: "ext", w: [910, 280], m: [330, 490],
              d: "Regional stores that receive product updates from the main store." },
  odoo:     { t: "Odoo ERP", s: "inventory", k: "ext", w: [290, 470], m: [70, 490],
              d: "Source of truth for stock. Synced both ways." },
  market:   { t: "Marketplace", s: "orders", k: "ext", w: [710, 470], m: [200, 490],
              d: "Marketplace orders arrive in chunks and are stored for the ERP to read." },
  you:      { t: "+ Your system", s: "let's connect it", k: "you", w: [910, 470], m: [200, 720], c: "contact",
              d: "Have systems that should talk to each other? That's the work I like." },
};

const EDGES = [
  ["shopify", "fraud"], ["fraud", "support"],
  ["oauth", "shopify"],
  ["shopify", "wishlist"], ["wishlist", "klaviyo"],
  ["shopify", "sync"], ["sync", "stores"],
  ["recharge", "subs"], ["subs", "asana"],
  ["shopify", "erp", true], ["market", "erp"], ["erp", "odoo", true],
];

const MAP_LAYOUTS = {
  wide: { key: "w", vb: [1000, 560], box: [164, 60], core: [196, 76], t: 16, s: 11.5 },
  tall: { key: "m", vb: [400, 790], box: [124, 56], core: [150, 68], t: 13.5, s: 10 },
};

const map = document.getElementById("map");
const panel = document.getElementById("panel");
const defaultPanel = panel.innerHTML;

function renderMap() {
  const L = narrow.matches ? MAP_LAYOUTS.tall : MAP_LAYOUTS.wide;
  map.innerHTML = "";
  map.setAttribute("viewBox", `0 0 ${L.vb[0]} ${L.vb[1]}`);
  const pos = (id) => NODES[id][L.key];
  const edgeLayer = el("g", {}, map), dotLayer = el("g", {}, map), nodeLayer = el("g", {}, map);

  EDGES.forEach(([a, b, both], i) => {
    const [x1, y1] = pos(a), [x2, y2] = pos(b);
    el("path", { id: `me${i}`, class: "edge", d: `M${x1} ${y1} L${x2} ${y2}`, "data-a": a, "data-b": b }, edgeLayer);
    addDots(dotLayer, `me${i}`, Math.hypot(x2 - x1, y2 - y1), both, i, a, b);
  });

  for (const id in NODES) {
    const n = { ...NODES[id], id };
    const [x, y] = n[L.key];
    const [w, h] = n.k === "core" ? L.core : L.box;
    const g = drawNode(nodeLayer, n, x, y, w, h, { t: L.t, s: L.s, ring: true });
    g.setAttribute("tabindex", 0);
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", `${n.t}: ${n.d}`);
    g.addEventListener("mouseenter", () => { if (!touch) focusNode(id); });
    g.addEventListener("mouseleave", () => { if (!touch) clearFocus(); });
    g.addEventListener("focus", () => focusNode(id));
    g.addEventListener("blur", clearFocus);
    g.addEventListener("click", () => {
      if (touch) return focusNode(id);
      if (n.c) document.getElementById(n.c).scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
    g.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && n.c) { e.preventDefault(); document.getElementById(n.c).scrollIntoView(); }
    });
  }
}

function focusNode(id) {
  const n = NODES[id];
  map.classList.add("focus");
  map.querySelectorAll(".on, .active").forEach((x) => x.classList.remove("on", "active"));
  const linked = new Set([id]);
  map.querySelectorAll(".edge, .dot").forEach((e) => {
    const { a, b } = e.dataset;
    if (a === id || b === id) { e.classList.add("on"); linked.add(a); linked.add(b); }
  });
  map.querySelectorAll(".node").forEach((g) => {
    if (linked.has(g.dataset.id)) g.classList.add("on");
    if (g.dataset.id === id) g.classList.add("active");
  });
  const kind = { mine: "Built by me", ext: "Connected system", core: "Platform", you: "Next" }[n.k];
  const link = n.c ? ` <a href="#${n.c}">${n.c === "contact" ? "Get in touch" : "Read the case study"} →</a>` : "";
  panel.innerHTML = `<p class="p-kind">${kind}</p><p class="p-title">${n.t}</p><p class="p-text">${n.d}${link}</p>`;
}

function clearFocus() {
  map.classList.remove("focus");
  map.querySelectorAll(".on, .active").forEach((x) => x.classList.remove("on", "active"));
  panel.innerHTML = defaultPanel;
}

/* ---------------- Architecture charts (case studies) ---------------- */
// Each chart is a list of ranks (columns on desktop, rows on phones).
// Kinds: mine = built by me, ext = outside system, db = database, core = Shopify.
const N = (id, t, s, k = "mine") => ({ id, t, s, k });
const ARCH = {
  fraud: {
    ranks: [
      [N("hook", "Order webhooks", "orders · risk updates", "ext"), N("clock", "Daily clock", "midnight CT", "ext")],
      [N("api", "Webhook API", "FastAPI · HMAC"), N("job", "Nightly re-scan", "last 26 hours")],
      [N("fetch", "Delay + re-fetch", "90 s · GraphQL"), N("db", "Postgres", "fraud records", "db")],
      [N("pipe", "Fraud pipeline", "records + risk level")],
      [N("switch", "Write switch", "off = log only"), N("queue", "Review queue", "pending orders")],
      [N("cancel", "Store API", "cancel · capture", "core"), N("dash", "CSR dashboard", "per-user login"), N("mail", "Email alert", "Microsoft Graph", "ext")],
    ],
    edges: [["hook", "api", "webhook"], ["clock", "job"], ["api", "fetch"], ["job", "fetch"], ["fetch", "pipe"], ["db", "pipe", "match"],
            ["pipe", "switch", "fraud"], ["pipe", "queue", "risky"], ["switch", "cancel"], ["queue", "dash"], ["queue", "mail"]],
  },
  wishlist: {
    ranks: [
      [N("front", "Storefront", "heart · Liquid", "ext"), N("acct", "My Wishlists", "account page"), N("events", "Store events", "orders · GDPR", "ext")],
      [N("app", "Remix backend", "proxy · CORS · webhooks")],
      [N("db", "Postgres", "Prisma · events", "db"), N("ks", "Klaviyo sync", "best-effort · retry")],
      [N("admin", "Admin report", "saved → cart → bought"), N("klav", "Klaviyo", "profile + objects", "ext")],
      [N("mkt", "Campaigns", "marketing team", "ext")],
    ],
    edges: [["front", "app", "app proxy"], ["acct", "app"], ["events", "app"], ["app", "db"], ["app", "ks"],
            ["db", "admin"], ["ks", "klav", "upsert"], ["klav", "mkt"]],
  },
  oauth: {
    ranks: [
      [N("admin", "Store admin", "approves once", "ext")],
      [N("svc", "Auth service", "FastAPI · OAuth 2.0")],
      [N("db", "Postgres", "token per store", "db"), N("apps", "Internal apps", "sync · fraud · jobs")],
      [N("api", "Store APIs", "any connected store", "core")],
    ],
    edges: [["admin", "svc", "OAuth"], ["svc", "db"], ["apps", "svc", "GET /token"], ["apps", "api", "token"]],
  },
  sync: {
    ranks: [
      [N("team", "Team", "pick · preview", "ext"), N("main", "US store", "source", "core")],
      [N("api", "Sync app", "FastAPI · dry run"), N("auth", "Auth service", "token per store")],
      [N("queue", "Job queue", "Postgres · worker", "db")],
      [N("ca", "Canada", "retry · isolated", "ext"), N("eu", "EU", "retry · isolated", "ext"), N("au", "Australia", "retry · isolated", "ext")],
    ],
    edges: [["team", "api", "run"], ["main", "api", "read"], ["api", "queue", "item per store"], ["auth", "queue", "token"],
            ["queue", "ca"], ["queue", "eu"], ["queue", "au"]],
  },
  subs: {
    ranks: [
      [N("rc", "Recharge", "4 stores", "ext"), N("clk", "Scheduler", "daily cron")],
      [N("sync", "Sync", "cursor · idempotent")],
      [N("db", "Postgres", "orders · subs", "db")],
      [N("agg", "Rollups", "revenue · churn")],
      [N("asana", "Asana", "custom fields", "ext")],
    ],
    edges: [["rc", "sync", "pull"], ["clk", "sync"], ["sync", "db", "upsert"], ["db", "agg"], ["agg", "asana", "write"]],
  },
  erp: {
    ranks: [
      [N("sales", "Sales team", "pricing portal", "ext"), N("odoo", "Odoo ERP", "JSON-RPC", "ext")],
      [N("mw", "Flask middleware", "GCP")],
      [N("shop", "E-commerce store", "orders · stock", "core")],
    ],
    edges: [["sales", "mw", "draft order"], ["odoo", "mw", "stock", true], ["mw", "shop", "", true]],
  },
};

function renderArch(svg) {
  const name = svg.dataset.arch;
  const def = ARCH[name];
  const tall = narrow.matches;
  const R = def.ranks;
  const maxN = Math.max(...R.map((r) => r.length));
  const pos = {};
  let W, H, fs;

  let showLabels = true;
  if (!tall) {
    // Leave at least 50 units between columns so arrows stay visible.
    W = 1000; const bh = 58, gap = 84;
    const bw = Math.min(160, (W - 8 - (R.length - 1) * 50) / R.length);
    H = (maxN - 1) * gap + bh + 24;
    const step = (W - bw - 8) / (R.length - 1);
    showLabels = step - bw >= 80;
    R.forEach((r, i) => r.forEach((n, j) => {
      pos[n.id] = { x: bw / 2 + 4 + i * step, y: H / 2 + (j - (r.length - 1) / 2) * gap, w: bw, h: bh, r: i, n };
    }));
    fs = bw < 140 ? { t: 13, s: 9.5 } : { t: 14, s: 10.5 };
  } else {
    W = 400; const bh = 52, gap = 98;
    H = (R.length - 1) * gap + bh + 12;
    R.forEach((r, i) => {
      const col = (W - 8) / r.length;
      const bw = Math.min(170, col - 10);
      r.forEach((n, j) => {
        pos[n.id] = { x: W / 2 + (j - (r.length - 1) / 2) * col, y: bh / 2 + 6 + i * gap, w: bw, h: bh, r: i, n };
      });
    });
    fs = { t: 12.5, s: 9.5 };
  }

  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const defs = el("defs", {}, svg);
  const marker = el("marker", { id: `ar-${name}`, viewBox: "0 0 8 8", refX: 7.5, refY: 4, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
  el("path", { class: "arrow", d: "M0,0 L8,4 L0,8 z" }, marker);
  const edgeLayer = el("g", {}, svg), dotLayer = el("g", {}, svg), labelLayer = el("g", {}, svg), nodeLayer = el("g", {}, svg);

  def.edges.forEach(([a, b, label, both], i) => {
    const A = pos[a], B = pos[b];
    const fwd = B.r >= A.r ? 1 : -1;
    let d, mx, my;
    if (!tall) {
      const x1 = A.x + fwd * A.w / 2, x2 = B.x - fwd * B.w / 2, cx = (x1 + x2) / 2;
      d = `M${x1} ${A.y} C${cx} ${A.y} ${cx} ${B.y} ${x2} ${B.y}`;
      mx = cx; my = (A.y + B.y) / 2;
    } else {
      const y1 = A.y + fwd * A.h / 2, y2 = B.y - fwd * B.h / 2, cy = (y1 + y2) / 2;
      d = `M${A.x} ${y1} C${A.x} ${cy} ${B.x} ${cy} ${B.x} ${y2}`;
      mx = (A.x + B.x) / 2; my = cy;
    }
    const id = `${name}-e${i}`;
    const p = el("path", { id, class: "edge", d, "marker-end": `url(#ar-${name})` }, edgeLayer);
    if (both) p.setAttribute("marker-start", `url(#ar-${name})`);
    addDots(dotLayer, id, Math.hypot(B.x - A.x, B.y - A.y), both, i, a, b);
    if (label && !tall && showLabels) {
      el("text", { x: mx, y: my - 6, "text-anchor": "middle", "font-size": 10, class: "s elabel" }, labelLayer).textContent = label;
    }
  });

  for (const id in pos) {
    const P = pos[id];
    drawNode(nodeLayer, P.n, P.x, P.y, P.w, P.h, fs);
  }
}

const archSvgs = document.querySelectorAll("svg[data-arch]");
function renderAll() {
  renderMap();
  archSvgs.forEach(renderArch);
}

/* ---------------- Terminal ---------------- */
const TERM = [
  { c: "whoami", o: '<span class="hl">pranav patel</span> · software engineer · backend, AI/LLM &amp; integrations' },
  { c: "cat stack.txt", o: "python  typescript  fastapi  node\npostgres  rest  graphql  webhooks" },
  { c: "uptime", o: "3+ years shipping to production" },
  { c: "./status --open-to", o: '<span class="hl">●</span> Backend  <span class="hl">●</span> AI/LLM  <span class="hl">●</span> Integrations' },
];
const PROMPT = '<span class="pr">➜</span> <span class="path">~</span> ';
const term = document.getElementById("term");
let termRun = 0;

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function playTerminal() {
  const run = ++termRun;
  term.innerHTML = "";
  if (reduceMotion) {
    term.innerHTML = TERM.map((l) => `${PROMPT}${l.c}\n<span class="out">${l.o}</span>\n`).join("") + PROMPT + '<span class="cursor"></span>';
    return;
  }
  await wait(500);
  for (const line of TERM) {
    const row = document.createElement("span");
    row.innerHTML = PROMPT;
    const cmd = document.createElement("span");
    row.appendChild(cmd);
    const cur = document.createElement("span");
    cur.className = "cursor";
    row.appendChild(cur);
    term.appendChild(row);
    for (const ch of line.c) {
      if (run !== termRun) return;
      cmd.textContent += ch;
      await wait(55 + Math.random() * 60);
    }
    await wait(250);
    cur.remove();
    term.insertAdjacentHTML("beforeend", `\n<span class="out">${line.o}</span>\n`);
    await wait(650);
  }
  if (run !== termRun) return;
  term.insertAdjacentHTML("beforeend", `${PROMPT}<span class="cursor"></span>`);
}

term.parentElement.addEventListener("click", playTerminal);

renderAll();
playTerminal();
narrow.addEventListener("change", () => { clearFocus(); renderAll(); });
