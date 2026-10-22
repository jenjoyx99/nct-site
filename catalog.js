/* GSA Products catalog.
   Data comes from data/ (built by tools/build_catalog.py from the price list).
   Only the small files a search needs are downloaded. */
(function () {
  "use strict";

  // SIN number -> name shown in the filter. Add or edit as needed.
  var SIN_NAMES = {
    "332510C": "Industrial Products & Hardware",
    "339940": "Office Supplies",
    "33411": "IT Hardware",
    "511210": "Software & Licenses",
    "811212": "IT Maintenance & Support",
    "322291": "Janitorial & Paper Products"
  };
  var CONTRACT = "GS-21F-0088X";
  var PER = 24;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var cache = {};
  function get(path) {
    if (!cache[path]) cache[path] = fetch("data/" + path).then(function (r) {
      if (!r.ok) { if (r.status === 404) return null; throw new Error(r.status); }
      return r.json();
    });
    return cache[path];
  }

  var META, F = {};
  function rec(arr, id) { var o = { id: id }; META.fields.forEach(function (f, i) { o[f] = arr[i]; }); return o; }
  function items(ids) {
    var need = {};
    ids.forEach(function (id) { need[Math.floor(id / META.chunk)] = 1; });
    return Promise.all(Object.keys(need).map(function (c) { return get("c/" + c + ".json").then(function (d) { need[c] = d; }); }))
      .then(function () { return ids.map(function (id) { var c = Math.floor(id / META.chunk); return rec(need[c][id % META.chunk], id); }); });
  }
  function words(s) { return s.toLowerCase().split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 2; }); }
  function pnKey(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function sinLabel(s) { return SIN_NAMES[s] ? s + " – " + SIN_NAMES[s] : "SIN " + s; }
  function gsaUrl(q) {
    var u = "https://www.gsaadvantage.gov/advantage/ws/search/advantage_search?q=0:2" + CONTRACT;
    return (q ? u + "&q=1:0" + encodeURIComponent(q) : u) + "&db=0&searchType=1";
  }

  // ids of items with a word starting with w. Ids matched in the name/part number
  // are recorded in strong (used for ranking); description-only words start with "~".
  function prefixIds(w, strong) {
    var key = w.length >= 3 ? w.slice(0, 3) : w;
    return get("i/" + key + ".json").then(function (shard) {
      var out = new Set();
      if (!shard) return out;
      for (var t in shard) {
        var main = t.charAt(0) !== "~", word = main ? t : t.slice(1);
        if (word.lastIndexOf(w, 0) !== 0) continue;
        shard[t].forEach(function (i) { out.add(i); if (main && strong) strong.set(i, (strong.get(i) || 0) + 1); });
      }
      return out;
    });
  }
  function intersect(a, b) { var o = new Set(); a.forEach(function (x) { if (b.has(x)) o.add(x); }); return o; }

  function search(q, mfrIdx, sin) {
    var ws = words(q), joined = pnKey(q), jobs = [], score = null;
    if (ws.length) {
      score = new Map();
      jobs.push(Promise.all(ws.map(function (w) { return prefixIds(w, score); })).then(function (sets) {
        return sets.reduce(function (a, b) { return a.size < b.size ? intersect(a, b) : intersect(b, a); });
      }));
      // also match part numbers typed with or without dashes/spaces
      if (joined.length >= 3 && (ws.length > 1 || ws[0] !== joined)) jobs.push(prefixIds(joined));
    }
    if (mfrIdx > -1) jobs.push(get("m/" + mfrIdx + ".json").then(function (a) { return { f: new Set(a || []) }; }));
    if (sin) jobs.push(get("s/" + sin.replace(/[^A-Za-z0-9_-]/g, "_") + ".json").then(function (a) { return { f: new Set(a || []) }; }));
    var exact = joined.length >= 2 ? get("p/" + joined.slice(0, 2) + ".json").then(function (d) { var v = d && d[joined]; return v == null ? [] : [].concat(v); }) : Promise.resolve([]);

    return Promise.all([Promise.all(jobs), exact]).then(function (r) {
      var res = r[0], ex = r[1], hit = null, filters = [];
      res.forEach(function (x) {
        if (x instanceof Set) { if (hit) x.forEach(function (i) { hit.add(i); }); else hit = new Set(x); }
        else filters.push(x.f);
      });
      if (!ws.length) hit = filters.length ? filters.shift() : null;
      filters.forEach(function (f) { hit = intersect(hit, f); });
      if (!hit) return null; // everything
      var ids = Array.from(hit);
      if (score) ids.sort(function (a, b) { return (score.get(b) || 0) - (score.get(a) || 0) || a - b; });
      else ids.sort(function (a, b) { return a - b; });
      var top = ex.filter(function (i) { return hit.has(i); });
      if (top.length) ids = top.concat(ids.filter(function (i) { return top.indexOf(i) < 0; }));
      return ids;
    });
  }

  // ---------- List page ----------
  var state = { q: "", mfr: "", sin: "", page: 1 }, token = 0;

  function readUrl() {
    var p = new URLSearchParams(location.search);
    state.q = p.get("q") || ""; state.mfr = p.get("mfr") || ""; state.sin = p.get("sin") || "";
    state.page = Math.max(1, parseInt(p.get("page"), 10) || 1);
  }
  function writeUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q); if (state.mfr) p.set("mfr", state.mfr); if (state.sin) p.set("sin", state.sin);
    if (state.page > 1) p.set("page", state.page);
    var s = p.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : ""));
  }
  function mfrIndex(name) {
    var n = name.trim().toLowerCase();
    if (!n) return -1;
    for (var i = 0; i < META.manufacturers.length; i++) if (META.manufacturers[i][0].toLowerCase() === n) return i;
    return -2; // typed something that is not a manufacturer
  }

  function card(d) {
    var link = "products.html?pn=" + encodeURIComponent(d.mpn || d.vpn);
    var img = d.photo ? '<div class="pcard-img"><img src="img/p/' + esc(d.photo) + '" alt="" loading="lazy" onerror="this.parentNode.remove()"></div>' : '';
    return '<a class="pcard' + (d.photo ? ' has-img' : '') + '" href="' + link + '">' + img +
      '<div class="pcard-body"><span class="pcard-cat">' + esc(d.mfr) + '</span>' +
      '<span class="pcard-name">' + esc(d.name) + '</span>' +
      '<span class="pcard-part">Mfr # ' + esc(d.mpn) + '</span>' +
      (d.price ? '<span class="pcard-price">' + '$' + esc(d.price) + (d.uom ? ' <small>/ ' + esc(d.uom) + '</small>' : '') + '</span>' : '') +
      '<span class="pcard-cta">Request a quote &rarr;</span></div></a>';
  }

  function pager(total) {
    var pages = Math.ceil(total / PER), p = state.page, h = "";
    if (pages <= 1) return "";
    var btn = function (n, label, cur) { return '<button data-p="' + n + '"' + (cur ? ' aria-current="true"' : "") + (n < 1 || n > pages ? " disabled" : "") + ">" + label + "</button>"; };
    h += btn(p - 1, "&larr; Prev");
    var shown = {};
    [1, p - 2, p - 1, p, p + 1, p + 2, pages].forEach(function (n) { if (n >= 1 && n <= pages) shown[n] = 1; });
    var last = 0;
    Object.keys(shown).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) {
      if (n - last > 1) h += '<span class="gap">&hellip;</span>';
      h += btn(n, n.toLocaleString(), n === p); last = n;
    });
    return h + btn(p + 1, "Next &rarr;");
  }

  function render() {
    var my = ++token;
    writeUrl();
    $("clear").hidden = !(state.q || state.mfr || state.sin);
    var mi = mfrIndex(state.mfr);
    var showFeat = !state.q && !state.mfr && !state.sin && state.page === 1 && META.featured && META.featured.length;
    $("featured").hidden = !showFeat;
    if (showFeat && !$("featured-grid").childElementCount) {
      items(META.featured).then(function (rows) { $("featured-grid").innerHTML = rows.map(card).join(""); });
    }
    $("count").textContent = "Searching…";
    var find = mi === -2 ? Promise.resolve([]) : search(state.q, mi, state.sin);
    find.then(function (ids) {
      if (my !== token) return;
      var total = ids ? ids.length : META.count;
      var pages = Math.max(1, Math.ceil(total / PER));
      if (state.page > pages) state.page = pages;
      var start = (state.page - 1) * PER, pageIds = [];
      for (var i = start; i < Math.min(start + PER, total); i++) pageIds.push(ids ? ids[i] : i);
      return items(pageIds).then(function (rows) {
        if (my !== token) return;
        $("count").textContent = total.toLocaleString() + (total === 1 ? " product" : " products") +
          (total > PER ? " · page " + state.page.toLocaleString() + " of " + pages.toLocaleString() : "");
        $("grid").innerHTML = rows.length ? rows.map(card).join("") :
          '<p class="empty">No products match. Try a part number, a shorter word, or <a href="quote.html">ask us for a quote</a> &mdash; we can source items not listed here.</p>';
        $("pager").innerHTML = pager(total);
      });
    }).catch(function () {
      $("count").textContent = "";
      $("grid").innerHTML = '<p class="empty">The catalog could not be loaded right now. Please try again or <a href="quote.html">request a quote</a>.</p>';
    });
  }

  function initList() {
    readUrl();
    $("q").value = state.q; $("mfr").value = state.mfr;
    $("mfr-list").innerHTML = META.manufacturers.map(function (m) { return '<option value="' + esc(m[0]) + '">'; }).join("");
    $("sin").innerHTML = '<option value="">All SINs</option>' + META.sins.map(function (s) {
      return '<option value="' + esc(s[0]) + '">' + esc(sinLabel(s[0])) + " (" + s[1].toLocaleString() + ")</option>";
    }).join("");
    $("sin").value = state.sin;

    var timer;
    $("q").addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.q = $("q").value.trim(); state.page = 1; render(); }, 250);
    });
    $("cat-form").addEventListener("submit", function (e) { e.preventDefault(); clearTimeout(timer); state.q = $("q").value.trim(); state.page = 1; render(); });
    $("mfr").addEventListener("change", function () { state.mfr = $("mfr").value.trim(); state.page = 1; render(); });
    $("sin").addEventListener("change", function () { state.sin = $("sin").value; state.page = 1; render(); });
    $("clear").addEventListener("click", function () {
      state = { q: "", mfr: "", sin: "", page: 1 };
      $("q").value = ""; $("mfr").value = ""; $("sin").value = ""; render();
    });
    $("pager").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b || b.disabled) return;
      state.page = +b.dataset.p; render(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    render();
  }

  // ---------- Product page ----------
  function showItem(pn) {
    $("list-view").hidden = true; $("item-view").hidden = false;
    var k = pnKey(pn);
    get("p/" + k.slice(0, 2) + ".json").then(function (d) {
      var v = d && d[k];
      if (v == null) throw new Error("not found");
      return items([].concat(v));
    }).then(function (r) {
      var want = pn.toLowerCase();
      var d = r.filter(function (x) { return x.mpn.toLowerCase() === want; })[0] ||
              r.filter(function (x) { return x.vpn.toLowerCase() === want; })[0] || r[0];
      document.title = d.name + " | " + d.mpn + " | New Century Technologies Inc.";
      $("i-img").innerHTML = d.photo ?
        '<img src="img/p/' + esc(d.photo) + '" alt="' + esc(d.name) + '" onerror="this.outerHTML=\'<span>' + esc(d.mfr || "NCT").replace(/'/g, "") + '</span>\'">' :
        "<span>" + esc(d.mfr || "NCT") + "</span>";
      $("i-cat").textContent = d.mfr;
      $("i-name").textContent = d.name;
      var rows = [
        ["Price", d.price ? "$" + d.price : ""],
        ["Manufacturer", d.mfr],
        ["Mfr part #", d.mpn],
        ["Vendor part #", d.vpn],
        ["Unit", d.uom],
        ["SIN", d.sin ? sinLabel(d.sin).replace(/^SIN /, "") : ""],
        ["Country of origin", d.coo],
        ["Delivery", d.days ? d.days + " days" : ""],
        ["GSA contract", d.contract]
      ];
      $("i-specs").innerHTML = rows.filter(function (r) { return r[1]; }).map(function (r) {
        return "<dt>" + r[0] + "</dt><dd" + (r[0] === "Price" ? ' class="price"' : "") + ">" + esc(r[1]) + "</dd>";
      }).join("");
      $("i-desc").textContent = d.desc && d.desc !== d.name ? d.desc : "";
      $("i-quote").href = "quote.html?item=" + encodeURIComponent(d.mfr + " " + d.mpn + " — " + d.name);
    }).catch(function () {
      $("i-name").textContent = "Product not found";
      $("i-desc").innerHTML = 'This part number isn&rsquo;t in our online catalog. We may still be able to source it &mdash; <a href="quote.html?item=' + encodeURIComponent(pn) + '">request a quote</a>.';
      document.querySelector(".item-actions").hidden = true;
    });
  }

  get("meta.json").then(function (m) {
    if (!m) throw new Error("no data");
    META = m;
    var pn = new URLSearchParams(location.search).get("pn");
    if (pn) showItem(pn); else initList();
  }).catch(function () {
    $("count").textContent = "";
    $("grid").innerHTML = location.protocol === "file:" ?
      '<p class="empty">The catalog needs a web server to load. Run <code>python -m http.server 8000</code> in the site folder and open http://localhost:8000/products.html</p>' :
      '<p class="empty">The catalog is being updated. Please check back shortly or <a href="quote.html">request a quote</a>.</p>';
  });
})();
