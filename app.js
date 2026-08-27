(() => {
  const cfg = window.DUGUN || {};
  const PIN = String(cfg.adminPin || "2026");

  const TABLES = buildTables();
  const byId = Object.fromEntries(TABLES.map((t) => [t.id, t]));

  let state = { guests: [], meta: {} };
  let backend = "local";
  let admin = false;
  let zoom = 1;
  let selectedDupId = null;
  let openTableId = null;
  let putTimer = 0;
  let putBusy = false;
  let lastPutBody = "";
  let lastJsonOk = false;
  let ready = false;
  let saveQueued = false;
  let synced = { guests: [], meta: {} };
  let loadGen = 0;

  const $ = (id) => document.getElementById(id);
  const els = {
    plan: $("plan"),
    q: $("q"),
    suggest: $("suggest"),
    result: $("result"),
    stats: $("stats"),
    coupleTitle: $("coupleTitle"),
    venueLabel: $("venueLabel"),
    eventDate: $("eventDate"),
    sync: $("syncLabel"),
    admin: $("admin"),
    adminBody: $("adminBody"),
    pinForm: $("pinForm"),
    modal: $("modal"),
    toast: $("toast"),
    viewport: $("viewport"),
    planView: $("planView"),
    listView: $("listView"),
    guestList: $("guestList"),
    dupPick: $("dupPick"),
    tableHint: $("tableHint")
  };

  async function init() {
    renderPlan();
    bind();
    applyMeta(cfg);
    const cached = readLocal();
    if (cached && cached.guests.length) state = cloneState(cached);
    synced = readSynced();
    renderAll();
    try {
      await load();
    } catch {
      ready = true;
      lastJsonOk = false;
      setSync();
      renderAll();
    }
  }

  function buildTables() {
    const T = [];
    const add = (id, no, cap, shape, color, zone, dir) => {
      T.push({ id, no, cap, shape, color, zone, dir });
    };

    const top = [
      [9, "top-left"], [8, "top-left"], [7, "top-left"], [6, "top-left"],
      [5, "top-right"], [4, "top-right"], [3, "top-right"], [2, "top-right"], [1, "top-right"]
    ];
    top.forEach(([n, z]) =>
      add(`y-${n}`, n, 10, "round", "yellow", z, dirFor(z, 10))
    );

    [18, 17, 16, 15].forEach((n) =>
      add(`y-${n}`, n, 10, "round", "yellow", "top-left", dirFor("top-left", 10))
    );
    add("y-32", 32, 10, "round", "yellow", "aisle", "Havuzun tam üstü, orta koridor");
    [14, 13, 12, 11, 10].forEach((n) =>
      add(`y-${n}`, n, 10, "round", "yellow", "top-right", dirFor("top-right", 10))
    );

    [26, 25, 24, 23].forEach((n) =>
      add(`y-${n}`, n, 10, "round", "yellow", "pool-top-left", "Havuzun üst kenarına yakın, sol blok")
    );
    [22, 21, 20, 19].forEach((n) =>
      add(`y-${n}`, n, 10, "round", "yellow", "pool-top-right", "Havuzun üst kenarına yakın, sağ blok")
    );

    [27, 28, 29, 30, 31].forEach((n) =>
      add(`y-${n}`, n, 10, "round", "yellow", "pool-left", "Havuzun sol kenarı, merdiven tarafı")
    );

    [42, 43, 44, 45, 46, 47, 48, 49].forEach((n) =>
      add(
        `pl-${n}`,
        n,
        8,
        "rect",
        "pink",
        "left-wall",
        "Sol duvar boyunca, 8 kişilik dikdörtgen masa"
      )
    );

    [41, 40, 39, 38, 37, 36, 35, 34].forEach((n) =>
      add(
        `pb-${n}`,
        n,
        8,
        "rect",
        "pink",
        "bottom-pink",
        "Havuzun altı, giriş merdivenine yakın, 8 kişilik"
      )
    );

    [41, 42, 43, 44].forEach((n) =>
      add(
        `bb-${n}`,
        n,
        16,
        "rect",
        "blue",
        "bottom-blue",
        "Havuzun altı, otopark girişine yakın, 16 kişilik büyük masa"
      )
    );

    return T;
  }

  function dirFor(zone, cap) {
    if (zone === "top-left") return "Havuzun üstü, sol blok (10 kişilik yuvarlak)";
    if (zone === "top-right") return "Havuzun üstü, otopark girişine bakan sağ blok (10 kişilik)";
    return `${cap} kişilik masa`;
  }

  function renderPlan() {
    const btn = (id) => {
      const t = byId[id];
      const cls = `tbl ${t.shape} ${t.color}`;
      return `<button type="button" class="${cls}" data-id="${t.id}" aria-label="Masa ${t.no}, ${t.cap} kişilik">
        ${t.no}<small class="occ"></small>
      </button>`;
    };

    els.plan.innerHTML = `
      ${place("y-9",3,1)}${place("y-8",4,1)}${place("y-7",5,1)}${place("y-6",6,1)}
      ${place("y-5",8,1)}${place("y-4",9,1)}${place("y-3",10,1)}${place("y-2",11,1)}${place("y-1",12,1)}

      ${place("y-18",3,2)}${place("y-17",4,2)}${place("y-16",5,2)}${place("y-15",6,2)}
      ${place("y-32",7,2)}
      ${place("y-14",8,2)}${place("y-13",9,2)}${place("y-12",10,2)}${place("y-11",11,2)}${place("y-10",12,2)}

      ${place("y-26",3,3)}${place("y-25",4,3)}${place("y-24",5,3)}${place("y-23",6,3)}
      ${place("y-22",8,3)}${place("y-21",9,3)}${place("y-20",10,3)}${place("y-19",11,3)}

      ${place("pl-42",1,3)}${place("pl-43",1,4)}${place("pl-44",1,5)}${place("pl-45",1,6)}
      ${place("pl-46",1,7)}${place("pl-47",1,8)}${place("pl-48",1,9)}${place("pl-49",1,10)}

      ${place("y-27",2,4)}${place("y-28",2,5)}${place("y-29",2,6)}${place("y-30",2,7)}${place("y-31",2,8)}

      <div class="pool" style="grid-column:3/13;grid-row:4/8">HAVUZ<small>500 kişilik</small></div>
      <div class="parking" style="grid-column:13;grid-row:1/3">Otopark girişi</div>
      <div class="main-entry" style="grid-column:13;grid-row:3/9">Ana giriş</div>
      <div class="bottom-row" style="grid-column:4/13;grid-row:9">
        ${["pb-41","pb-40","pb-39","pb-38","pb-37","pb-36","pb-35","pb-34"].map(btn).join("")}
        ${["bb-41","bb-42","bb-43","bb-44"].map(btn).join("")}
      </div>
      <div class="stairs" style="grid-column:1/3;grid-row:11">giriş merdiveni</div>
    `;

    function place(id, col, row) {
      const t = byId[id];
      return `<button type="button" class="tbl ${t.shape} ${t.color}" data-id="${t.id}" style="grid-column:${col};grid-row:${row}" aria-label="Masa ${t.no}, ${t.cap} kişilik">${t.no}<small class="occ"></small></button>`;
    }
  }

  function bind() {
    els.plan.addEventListener("click", (e) => {
      const b = e.target.closest("[data-id]");
      if (b) openTable(b.dataset.id);
    });

    $("searchForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const hits = search(els.q.value);
      if (hits.length) showGuest(hits[0]);
      else toast("Bu isimde misafir yok");
      els.suggest.hidden = true;
    });

    els.q.addEventListener("input", () => {
      const hits = search(els.q.value).slice(0, 8);
      if (!els.q.value.trim() || !hits.length) {
        els.suggest.hidden = true;
        return;
      }
      els.suggest.hidden = false;
      els.suggest.innerHTML = hits
        .map(
          (g, i) =>
            `<button type="button" data-gid="${g.id}" class="${i === 0 ? "active" : ""}">${esc(
              g.name
            )} <small>Masa ${tableNo(g)}</small></button>`
        )
        .join("");
    });

    els.suggest.addEventListener("click", (e) => {
      const b = e.target.closest("[data-gid]");
      if (!b) return;
      const g = state.guests.find((x) => x.id === b.dataset.gid);
      if (g) showGuest(g);
      els.suggest.hidden = true;
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".search")) els.suggest.hidden = true;
    });

    $("btnAdmin").onclick = () => {
      els.admin.hidden = false;
      $("pinForm").hidden = admin;
      els.adminBody.hidden = !admin;
      if (admin) $("modalAdd").hidden = false;
    };
    $("closeAdmin").onclick = () => (els.admin.hidden = true);
    $("closeModal").onclick = () => {
      els.modal.hidden = true;
      openTableId = null;
    };
    els.admin.addEventListener("click", (e) => {
      if (e.target === els.admin) els.admin.hidden = true;
    });
    els.modal.addEventListener("click", (e) => {
      if (e.target !== els.modal) return;
      els.modal.hidden = true;
      openTableId = null;
    });

    $("pinForm").onsubmit = (e) => {
      e.preventDefault();
      if ($("pinInput").value === PIN) {
        admin = true;
        sessionStorage.setItem("dugun-admin", "1");
        $("pinForm").hidden = true;
        els.adminBody.hidden = false;
        $("modalAdd").hidden = false;
        toast("Yönetim açık");
        refreshUi();
      } else toast("Şifre yanlış");
    };

    if (sessionStorage.getItem("dugun-admin") === "1") {
      admin = true;
      $("pinForm").hidden = true;
      els.adminBody.hidden = false;
      $("modalAdd").hidden = false;
    }

    $("addForm").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const names = splitNames(fd.get("names"));
      const no = Number(fd.get("tableNo"));
      if (!names.length) return toast("İsim yazın");
      if (!no) return toast("Masa numarası yazın");
      const matches = TABLES.filter((t) => t.no === no);
      if (!matches.length) return toast("Bu numarada masa yok");
      let table = matches.length === 1 ? matches[0] : byId[selectedDupId];
      if (!table) {
        els.dupPick.hidden = false;
        els.dupPick.innerHTML =
          `<p class="hint">Planda ${no} numaralı ${matches.length} masa var, birini seçin:</p>` +
          matches
            .map(
              (t) =>
                `<button type="button" class="dup-item" data-id="${t.id}">Masa ${t.no} · ${t.cap} kişilik · ${shortZone(t)}</button>`
            )
            .join("");
        return;
      }
      const added = addGuests(names, table.id, "", "");
      if (added) {
        await save();
        e.target.reset();
        selectedDupId = null;
        els.dupPick.hidden = true;
        toast(`${added} kişi masa ${table.no}’ye eklendi`);
        highlight(table.id);
      }
    };

    els.dupPick.addEventListener("click", (e) => {
      const b = e.target.closest("[data-id]");
      if (!b) return;
      selectedDupId = b.dataset.id;
      [...els.dupPick.querySelectorAll("button")].forEach((x) => {
        x.style.borderColor = x === b ? "var(--gold)" : "";
      });
    });

    $("addForm").elements.tableNo.addEventListener("input", () => {
      selectedDupId = null;
      const no = Number($("addForm").elements.tableNo.value);
      const matches = TABLES.filter((t) => t.no === no);
      els.tableHint.textContent = matches.length
        ? matches.map((t) => `${t.cap} kişilik · ${shortZone(t)} · ${used(t.id)}/${t.cap}`).join("  |  ")
        : "";
      els.dupPick.hidden = matches.length < 2;
      if (matches.length > 1) {
        els.dupPick.innerHTML = matches
          .map(
            (t) =>
              `<button type="button" class="dup-item" data-id="${t.id}">Masa ${t.no} · ${t.cap} kişilik · ${shortZone(t)}</button>`
          )
          .join("");
      }
    });

    $("modalAdd").onsubmit = async (e) => {
      e.preventDefault();
      const id = $("modalAdd").dataset.tableId;
      const name = $("modalAdd").elements.name.value.trim();
      if (!name) return;
      if (addGuests([name], id, "", "")) {
        await save();
        e.target.reset();
        openTableId = id;
      }
    };

    $("zoomIn").onclick = () => setZoom(zoom + 0.12);
    $("zoomOut").onclick = () => setZoom(zoom - 0.12);
    $("zoomReset").onclick = () => fitZoom();

    $("btnList").onclick = () => setView(els.listView.hidden ? "list" : "plan");
    document.querySelectorAll(".view-toggle button").forEach((b) => {
      b.onclick = () => setView(b.dataset.view);
    });
    $("listFilter").oninput = renderList;
    $("listSort").onchange = renderList;
    els.guestList.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-del]");
      if (!b) return;
      await removeGuest(b.dataset.del);
    });
    $("modalPeople").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-del]");
      if (!b) return;
      await removeGuest(b.dataset.del);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      els.admin.hidden = true;
      els.modal.hidden = true;
      els.suggest.hidden = true;
      openTableId = null;
    });

    window.addEventListener("resize", debounce(fitZoom, 150));
    window.addEventListener("pagehide", () => {
      if (ready && state.guests.length) flushPut(true);
    });
    requestAnimationFrame(fitZoom);
  }

  function shortZone(t) {
    if (t.color === "yellow" && t.zone.includes("left") && t.zone !== "pool-left") return "üst sol";
    if (t.zone === "pool-left") return "havuz solu";
    if (t.zone.includes("right")) return "üst sağ / otopark";
    if (t.zone === "aisle") return "orta koridor";
    if (t.zone === "left-wall") return "sol duvar";
    if (t.zone === "bottom-pink") return "alt sıra pembe";
    if (t.zone === "bottom-blue") return "alt sıra mavi";
    return t.zone;
  }

  function splitNames(raw) {
    return String(raw || "")
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function addGuests(names, tableId, note, side) {
    const t = byId[tableId];
    const free = t.cap - used(tableId);
    if (names.length > free) {
      toast(`Bu masada ${free} yer kaldı (kapasite ${t.cap})`);
      return 0;
    }
    for (const name of names) {
      state.guests.push({
        id: uid(),
        name,
        tableId,
        note,
        side,
        at: Date.now()
      });
    }
    return names.length;
  }

  function used(tableId) {
    return state.guests.filter((g) => g.tableId === tableId).length;
  }

  function tableNo(g) {
    return byId[g.tableId]?.no || "?";
  }

  function norm(s) {
    return String(s || "")
      .toLocaleLowerCase("tr")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/ş/g, "s")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");
  }

  function search(q) {
    const n = norm(q.trim());
    if (n.length < 1) return [];
    return state.guests
      .filter((g) => norm(g.name).includes(n))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }

  function showGuest(g) {
    const t = byId[g.tableId];
    els.q.value = g.name;
    els.result.hidden = false;
    els.result.innerHTML = `<div class="result-card">
      <div>
        <div>${esc(g.name)}</div>
        <p>${t.dir}${g.note ? " · " + esc(g.note) : ""}${g.side ? " · " + sideLabel(g.side) : ""}</p>
      </div>
      <div><strong>Masa ${t.no}</strong><br/><button type="button" id="goTable">Masayı göster</button></div>
    </div>`;
    $("goTable").onclick = () => {
      setView("plan");
      highlight(t.id);
      openTable(t.id);
    };
    setView("plan");
    highlight(t.id);
  }

  function sideLabel(s) {
    return s === "gelin" ? "Gelin tarafı" : s === "damat" ? "Damat tarafı" : "";
  }

  function highlight(id) {
    els.plan.querySelectorAll(".hit").forEach((el) => el.classList.remove("hit"));
    const el = els.plan.querySelector(`[data-id="${id}"]`);
    if (!el) return;
    el.classList.add("hit");
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }

  function delBtn(id) {
    return admin ? `<button type="button" class="xbtn" data-del="${id}">sil</button>` : "";
  }

  async function removeGuest(id) {
    const g = state.guests.find((x) => x.id === id);
    if (!g) return;
    rememberRemoved(id);
    state.guests = state.guests.filter((x) => x.id !== id);
    writeLocal();
    await save();
    toast(`${g.name} silindi`);
  }

  function refreshUi() {
    renderAll();
    if (!els.modal.hidden && openTableId) openTable(openTableId);
  }

  function openTable(id) {
    openTableId = id;
    const t = byId[id];
    const people = state.guests.filter((g) => g.tableId === id);
    $("modalTitle").textContent = `Masa ${t.no}  ·  ${t.cap} kişilik`;
    $("modalDir").textContent = `${t.dir}  ·  ${people.length}/${t.cap} dolu`;
    $("modalSeats").innerHTML = `<i style="width:${Math.min(100, (people.length / t.cap) * 100)}%"></i>`;
    $("modalPeople").innerHTML = people.length
      ? people
          .map(
            (g) => `<li>
              <span>${esc(g.name)} <span class="meta">${esc(g.note || "")} ${sideLabel(g.side)}</span></span>
              ${delBtn(g.id)}
            </li>`
          )
          .join("")
      : `<li class="empty">Henüz isim yok</li>`;
    $("modalAdd").hidden = !admin;
    $("modalAdd").dataset.tableId = id;
    els.modal.hidden = false;
  }

  function renderAll() {
    applyMeta({ ...cfg, ...state.meta });
    renderOccupancy();
    renderStats();
    renderList();
    $("modalAdd").hidden = !admin;
  }

  function applyMeta(m) {
    const bride = m.bride || cfg.bride || "Berra";
    const groom = m.groom || cfg.groom || "Kerim";
    els.coupleTitle.innerHTML = `${esc(bride)} <span>&amp;</span> ${esc(groom)}`;
    els.venueLabel.textContent = m.venue || cfg.venue || "Havuzbaşı";
    const d = m.date || cfg.date || "";
    els.eventDate.hidden = !d;
    els.eventDate.textContent = d;
    document.title = `${bride} & ${groom} — Koltuk düzeni`;
  }

  function renderOccupancy() {
    els.plan.querySelectorAll("[data-id]").forEach((el) => {
      const t = byId[el.dataset.id];
      const n = used(t.id);
      const sm = el.querySelector(".occ");
      if (sm) sm.textContent = n ? `${n}/${t.cap}` : "";
      el.classList.toggle("full", n >= t.cap);
      el.classList.toggle("open", n > 0 && n < t.cap);
      el.title = `Masa ${t.no} · ${n}/${t.cap}`;
    });
  }

  function renderStats() {
    const seats = TABLES.reduce((s, t) => s + t.cap, 0);
    const taken = state.guests.length;
    const full = TABLES.filter((t) => used(t.id) >= t.cap).length;
    const empty = TABLES.filter((t) => used(t.id) === 0).length;
    els.stats.innerHTML = [
      ["Misafir", taken],
      ["Boş koltuk", Math.max(0, seats - taken)],
      ["Boş masa", empty],
      ["Dolu masa", full]
    ]
      .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
      .join("");
  }

  function renderList() {
    const q = norm($("listFilter")?.value || "");
    const sort = $("listSort")?.value || "table";
    let guests = state.guests.slice();
    if (q) guests = guests.filter((g) => norm(g.name).includes(q));
    if (sort === "name") guests.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    else guests.sort((a, b) => tableNo(a) - tableNo(b) || a.name.localeCompare(b.name, "tr"));

    if (!guests.length) {
      els.guestList.innerHTML = `<p class="hint">${state.guests.length ? "Eşleşme yok" : "Henüz misafir eklenmedi. Yönetim’den ekleyin."}</p>`;
      return;
    }

    if (sort === "name") {
      els.guestList.innerHTML = `<ul class="people">${guests
        .map(
          (g) =>
            `<li><span>${esc(g.name)} <span class="meta">Masa ${tableNo(g)}</span></span>${delBtn(g.id)}</li>`
        )
        .join("")}</ul>`;
      return;
    }

    const groups = new Map();
    guests.forEach((g) => {
      const id = g.tableId;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(g);
    });
    els.guestList.innerHTML = [...groups.entries()]
      .map(([id, gs]) => {
        const t = byId[id];
        return `<article class="table-group">
          <h3>Masa ${t.no} · ${gs.length}/${t.cap} · ${shortZone(t)}</h3>
          <ul class="people">${gs
            .map(
              (g) =>
                `<li><span>${esc(g.name)}${g.note ? " — " + esc(g.note) : ""}</span>${delBtn(g.id)}</li>`
            )
            .join("")}</ul>
        </article>`;
      })
      .join("");
  }

  function setView(view) {
    const plan = view !== "list";
    els.planView.hidden = !plan;
    els.listView.hidden = plan;
    document.querySelectorAll(".view-toggle button").forEach((b) => {
      b.classList.toggle("on", b.dataset.view === (plan ? "plan" : "list"));
    });
    const btn = $("btnList");
    if (btn) {
      btn.textContent = plan ? "Liste" : "Plan";
      btn.title = plan ? "Liste" : "Masa planı";
    }
    if (!plan) renderList();
  }

  function setZoom(z) {
    zoom = Math.min(1.6, Math.max(0.45, z));
    els.plan.style.transform = `scale(${zoom})`;
    els.plan.style.marginBottom = `${(zoom - 1) * els.plan.offsetHeight}px`;
  }

  function fitZoom() {
    const vp = els.viewport;
    if (!vp) return;
    const avail = vp.clientWidth - 36;
    const w = els.plan.scrollWidth || 920;
    setZoom(Math.min(1, avail / w));
  }

  function cloneState(s) {
    return {
      guests: Array.isArray(s && s.guests) ? s.guests.map((g) => Object.assign({}, g)) : [],
      meta: s && s.meta && typeof s.meta === "object" ? Object.assign({}, s.meta) : {}
    };
  }

  function guestMap(list) {
    const m = new Map();
    (list || []).forEach((g) => {
      if (g && g.id) m.set(g.id, g);
    });
    return m;
  }

  function mergeGuests(base, local, remote) {
    const localIds = new Set((local || []).map((g) => g.id).filter(Boolean));
    const localMap = guestMap(local);
    const removed = readRemoved();
    if (local.length) {
      (base || []).forEach((g) => {
        if (g && g.id && !localIds.has(g.id)) removed.add(g.id);
      });
    }
    const out = [];
    const seen = new Set();
    (remote || []).forEach((g) => {
      if (!g || !g.id || removed.has(g.id)) return;
      out.push(localMap.has(g.id) ? localMap.get(g.id) : g);
      seen.add(g.id);
    });
    (local || []).forEach((g) => {
      if (!g || !g.id || seen.has(g.id) || removed.has(g.id)) return;
      out.push(g);
      seen.add(g.id);
    });
    return out;
  }

  function readRemoved() {
    try {
      const a = JSON.parse(localStorage.getItem("dugun-removed") || "[]");
      return new Set(Array.isArray(a) ? a : []);
    } catch {
      return new Set();
    }
  }

  function rememberRemoved(id) {
    const s = readRemoved();
    s.add(id);
    localStorage.setItem("dugun-removed", JSON.stringify([...s]));
  }

  function pruneRemoved(guests) {
    const have = new Set((guests || []).map((g) => g.id));
    const leftover = [...readRemoved()].filter((id) => have.has(id));
    localStorage.setItem("dugun-removed", JSON.stringify(leftover));
  }

  function readSynced() {
    try {
      const raw = localStorage.getItem("dugun-synced");
      if (!raw) return { guests: [], meta: {} };
      return cloneState(JSON.parse(raw));
    } catch {
      return { guests: [], meta: {} };
    }
  }

  function writeSynced(s) {
    synced = cloneState(s);
    localStorage.setItem("dugun-synced", JSON.stringify(synced));
  }

  function jsonCfg() {
    const url = String(cfg.jsonUrl || "").trim();
    const key = String(cfg.jsonKey || "").trim();
    return { url, key, on: !!url };
  }

  function jsonHeaders(extra) {
    const { url, key } = jsonCfg();
    const h = { Accept: "application/json", ...(extra || {}) };
    if (!key) return h;
    if (url.includes("jsonbin.io")) {
      h["X-Master-Key"] = key;
      h["X-Bin-Meta"] = "false";
    } else {
      h.Authorization = key;
    }
    return h;
  }

  function parseJsonRecord(data) {
    if (!data || typeof data !== "object") return { guests: [], meta: {} };
    const rec = data.record && typeof data.record === "object" ? data.record : data;
    return {
      guests: Array.isArray(rec.guests) ? rec.guests : [],
      meta: rec.meta && typeof rec.meta === "object" ? rec.meta : {}
    };
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem("dugun-state");
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return {
        guests: Array.isArray(data.guests) ? data.guests : [],
        meta: data.meta && typeof data.meta === "object" ? data.meta : {}
      };
    } catch {
      return null;
    }
  }

  function writeLocal() {
    const body = JSON.stringify(state);
    localStorage.setItem("dugun-state", body);
    return body;
  }

  function raceMs(promise, ms) {
    let t;
    const timeout = new Promise((_, reject) => {
      t = setTimeout(() => reject(new Error("timeout")), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
  }

  async function pullRemote() {
    const { on, url } = jsonCfg();
    if (!on) return null;
    const getUrl = url.includes("jsonbin.io") && !/\/latest\/?$/.test(url) ? url.replace(/\/?$/, "/") + "latest" : url;
    const read = async () => {
      let r = await fetch(getUrl, { cache: "no-store" });
      if (r.status === 401 || r.status === 403) {
        r = await fetch(getUrl, { cache: "no-store", headers: jsonHeaders() });
      }
      if (!r.ok) return null;
      return parseJsonRecord(await r.json());
    };
    try {
      return await raceMs(read(), 8000);
    } catch {
      return null;
    }
  }

  async function load() {
    const gen = ++loadGen;
    synced = readSynced();
    const cached = cloneState(readLocal() || { guests: [], meta: {} });
    if (cached.guests.length) {
      state = cloneState(cached);
      renderAll();
    }
    try {
      const remote = await pullRemote();
      if (gen !== loadGen) return;
      if (remote) {
        const removed = readRemoved();
        const map = guestMap(remote.guests);
        cached.guests.forEach((g) => {
          if (g && g.id && !map.has(g.id) && !removed.has(g.id)) map.set(g.id, g);
        });
        removed.forEach((id) => map.delete(id));
        state = {
          guests: [...map.values()],
          meta: Object.assign({}, remote.meta, cached.meta)
        };
        writeLocal();
        writeSynced(state);
        lastJsonOk = true;
        backend = "json";
        ready = true;
        setSync();
        refreshUi();
        return;
      }
    } catch {
      /* local */
    }
    if (gen !== loadGen) return;
    lastJsonOk = false;
    backend = cached.guests.length ? "json" : "local";
    ready = true;
    setSync();
    refreshUi();
  }

  async function save() {
    writeLocal();
    lastJsonOk = true;
    backend = "json";
    setSync();
    await flushPut(true, true);
  }

  async function pushState(body) {
    const { url } = jsonCfg();
    const putUrl = url.includes("jsonbin.io") ? url.replace(/\/latest\/?$/, "") : url;
    const headers = jsonHeaders({ "Content-Type": "application/json" });
    if (url.includes("jsonbin.io")) headers["X-Bin-Versioning"] = "false";
    return fetch(putUrl, {
      method: "PUT",
      headers,
      body,
      keepalive: true
    });
  }

  async function flushPut(keepTimer, allowEmpty) {
    if (!keepTimer) putTimer = 0;
    else clearTimeout(putTimer);
    if (putBusy) {
      saveQueued = true;
      return;
    }
    if (!jsonCfg().on) return;
    putBusy = true;
    try {
      const local = cloneState(state);
      let remote = null;
      try {
        remote = await pullRemote();
      } catch {
        remote = null;
      }
      if (!remote) {
        lastJsonOk = false;
        toast("Liste alınamadı, kayıt yazılmadı");
        setSync();
        return;
      }
      const base = synced.guests.length ? cloneState(synced) : cloneState(remote);
      const merged = {
        guests: mergeGuests(base.guests, local.guests, remote.guests),
        meta: Object.assign({}, remote.meta, local.meta)
      };
      if (!merged.guests.length && !allowEmpty) return;
      const body = JSON.stringify(merged);
      if (body === lastPutBody && body === JSON.stringify(remote)) return;
      const r = await pushState(body);
      if (!r.ok) {
        lastJsonOk = false;
        toast("Ortak kayda yazılamadı (" + r.status + ")");
        setSync();
        return;
      }
      lastPutBody = body;
      state = merged;
      writeLocal();
      writeSynced(merged);
      pruneRemoved(merged.guests);
      lastJsonOk = true;
      backend = "json";
      setSync();
      refreshUi();
    } catch {
      lastJsonOk = false;
      toast("Ortak kayda ulaşılamadı, bu tarayıcıda duruyor");
      setSync();
    } finally {
      putBusy = false;
      if (saveQueued) {
        saveQueued = false;
        flushPut(true, allowEmpty);
      }
    }
  }

  function setSync() {
    if (backend === "json" && lastJsonOk) {
      els.sync.textContent = "Paylaşımlı kayıt";
      els.sync.className = "ok";
    } else {
      els.sync.textContent = "Bu tarayıcıda duruyor — sayfayı yenile";
      els.sync.className = "local";
    }
  }

  function exportCsv() {
    const rows = [["Ad", "Masa", "Kapasite", "Konum", "Taraf", "Not"]];
    state.guests
      .slice()
      .sort((a, b) => tableNo(a) - tableNo(b) || a.name.localeCompare(b.name, "tr"))
      .forEach((g) => {
        const t = byId[g.tableId];
        rows.push([g.name, t.no, t.cap, shortZone(t), sideLabel(g.side), g.note || ""]);
      });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    download("dugun-misafirler.csv", "\ufeff" + csv, "text/csv");
  }

  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function toast(msg) {
    els.toast.hidden = false;
    els.toast.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (els.toast.hidden = true), 2600);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : "g" + Date.now() + Math.random().toString(16).slice(2);
  }

  function debounce(fn, ms) {
    let t;
    return () => {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  init();
})();
