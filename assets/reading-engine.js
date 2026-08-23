/* CS 227 Interactive Readings — shared engine.
 *
 * Author a reading by calling:
 *   Reading.init({ id, title, subtitle, crumb, blocks, prev, next });
 *
 * Block types (each interactive block needs a unique `id`):
 *   { type:'prose', html }
 *   { type:'def',   title, html }
 *   { type:'mc',        id, prompt, choices:[...], answer:<index>, explain }
 *   { type:'selectall', id, prompt, choices:[...], answers:[<indices>], explain }
 *   { type:'shortnum',  id, prompt, answer:<number>, tol:<number?>, explain }
 *   { type:'shorttext', id, prompt, answer:'...', accept:[...alts], explain }
 *   { type:'parsons',   id, prompt, steps:[...in correct order], explain }
 *   { type:'custom',    id?, activity:false, render:function(el, api){...} }
 *
 * Progress is stored in localStorage per reading id. No network/back end.
 */
(function () {
  "use strict";
  var Reading = {};
  var S = { id: null, done: null, activityIds: [] };

  /* ---------- storage ---------- */
  function key() { return "cs227-reading-" + S.id; }
  function load() {
    S.done = {};
    try {
      var raw = localStorage.getItem(key());
      if (raw) JSON.parse(raw).forEach(function (x) { S.done[x] = true; });
    } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(key(), JSON.stringify(Object.keys(S.done))); } catch (e) {}
  }
  function markDone(id) { if (id && !S.done[id]) { S.done[id] = true; save(); updateProgress(); } }
  function isDone(id) { return !!S.done[id]; }

  /* ---------- helpers ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function normText(s) {
    return String(s).toLowerCase().trim().replace(/\s+/g, " ").replace(/[.]$/, "");
  }
  // safe arithmetic evaluator: digits and + - * / ^ ( ) . only
  function evalNum(s) {
    s = String(s).trim();
    if (!/^[0-9+\-*/^().\s]+$/.test(s)) return NaN;
    try { return Function('"use strict";return (' + s.replace(/\^/g, "**") + ")")(); }
    catch (e) { return NaN; }
  }

  function renderMath(node) {
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(node, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true }
          ],
          throwOnError: false
        });
      } catch (e) {}
    }
  }
  Reading.renderMath = renderMath;

  /* ---------- activity chrome ---------- */
  function activityCard(badge, id) {
    var card = el("div", "r-activity");
    if (id) card.dataset.blockId = id;
    var head = el("div", "r-activity-head");
    head.appendChild(el("span", "r-badge", badge));
    var chk = el("span", "r-check", '<span aria-hidden="true">✓</span> complete');
    if (id && isDone(id)) chk.classList.add("on");
    head.appendChild(chk);
    card.appendChild(head);
    card._chk = chk;
    return card;
  }
  function feedback(card) {
    var fb = el("p", "r-feedback");
    fb.setAttribute("aria-live", "polite");
    card.appendChild(fb);
    return fb;
  }
  function setFeedback(fb, ok, msg, why) {
    fb.className = "r-feedback " + (ok ? "ok" : "no");
    fb.innerHTML = msg + (why ? '<span class="r-why">' + why + "</span>" : "");
    renderMath(fb);
  }

  /* ---------- block renderers ---------- */
  var R = {};

  R.prose = function (b) {
    var d = el("div", "r-prose");
    d.innerHTML = b.html;
    return d;
  };

  R.def = function (b) {
    var d = el("div", "r-def");
    d.appendChild(el("div", "r-def-title", b.title || "Definition"));
    d.appendChild(el("div", null, b.html));
    return d;
  };

  R.mc = function (b) {
    var card = activityCard(b.badge || "Check your understanding", b.id);
    card.appendChild(el("p", "r-prompt", b.prompt));
    var wrap = el("div", "r-choices");
    var fb = null;
    var settled = isDone(b.id);
    // choices are shuffled at render time so the correct answer isn't always first
    var items = b.choices.map(function (txt, i) {
      return { txt: txt, correct: i === b.answer, fb: (b.choiceFeedback && b.choiceFeedback[i]) ? b.choiceFeedback[i] : null };
    });
    shuffle(items).forEach(function (it) {
      var btn = el("button", "r-choice r-radio");
      btn.type = "button";
      btn.innerHTML = '<span class="r-tick"></span><span>' + it.txt + "</span>";
      if (settled && it.correct) btn.classList.add("correct");
      btn.onclick = function () {
        if (btn.disabled) return;
        Array.prototype.forEach.call(wrap.children, function (c) { c.classList.remove("sel", "correct", "wrong"); });
        btn.classList.add("sel");
        if (it.correct) {
          btn.classList.add("correct");
          Array.prototype.forEach.call(wrap.children, function (c) { c.disabled = true; });
          card._chk.classList.add("on");
          setFeedback(fb, true, "Correct.", b.explain);
          markDone(b.id);
        } else {
          btn.classList.add("wrong");
          setFeedback(fb, false, it.fb || "Not quite — try again.", "");
        }
      };
      if (settled) btn.disabled = true;
      wrap.appendChild(btn);
    });
    card.appendChild(wrap);
    fb = feedback(card);
    if (settled) setFeedback(fb, true, "Correct.", b.explain);
    return card;
  };

  R.selectall = function (b) {
    var card = activityCard(b.badge || "Select all that apply", b.id);
    card.appendChild(el("p", "r-prompt", b.prompt));
    var wrap = el("div", "r-choices");
    var ansSet = {};
    b.answers.forEach(function (i) { ansSet[i] = true; });
    // choices shuffled at render time; correctness tracked per item
    var items = b.choices.map(function (txt, i) {
      return { txt: txt, correct: !!ansSet[i], chosen: false, btn: null };
    });
    shuffle(items).forEach(function (it) {
      var btn = el("button", "r-choice");
      btn.type = "button";
      btn.innerHTML = '<span class="r-tick"></span><span>' + it.txt + "</span>";
      it.btn = btn;
      btn.onclick = function () {
        it.chosen = !it.chosen;
        btn.classList.toggle("sel", it.chosen);
      };
      wrap.appendChild(btn);
    });
    card.appendChild(wrap);
    var fb;
    var row = el("div", "r-row");
    var check = el("button", "r-btn", "Check");
    check.type = "button";
    row.appendChild(check);
    card.appendChild(row);
    fb = feedback(card);
    function settle() {
      items.forEach(function (it) {
        it.btn.disabled = true;
        if (it.correct) it.btn.classList.add("correct");
        else if (it.chosen) it.btn.classList.add("wrong");
      });
      check.disabled = true;
      card._chk.classList.add("on");
      setFeedback(fb, true, "Correct selection.", b.explain);
      markDone(b.id);
    }
    check.onclick = function () {
      var ok = items.every(function (it) { return it.chosen === it.correct; });
      if (ok) settle();
      else setFeedback(fb, false, b.hint || "Not quite — you've either included something that doesn't belong or left one out. Adjust and check again.", "");
    };
    if (isDone(b.id)) { items.forEach(function (it) { it.chosen = it.correct; }); settle(); }
    return card;
  };

  R.shortnum = function (b) {
    var card = activityCard(b.badge || "Challenge", b.id);
    card.appendChild(el("p", "r-prompt", b.prompt));
    var row = el("div", "r-row");
    var inp = el("input", "r-input");
    inp.type = "text";
    inp.setAttribute("inputmode", "text");
    inp.placeholder = b.placeholder || "your answer";
    var btn = el("button", "r-btn", "Check");
    btn.type = "button";
    row.appendChild(inp); row.appendChild(btn);
    card.appendChild(row);
    var fb = feedback(card);
    var tol = b.tol || 0;
    function check() {
      var raw = inp.value.trim();
      if (raw === "") { setFeedback(fb, false, "Enter an answer first.", ""); return; }
      var v = evalNum(raw);
      if (isNaN(v)) { setFeedback(fb, false, "That doesn't look like a number — try again.", ""); return; }
      if (Math.abs(v - b.answer) <= tol) {
        inp.disabled = true; btn.disabled = true;
        card._chk.classList.add("on");
        setFeedback(fb, true, "Correct.", b.explain);
        markDone(b.id);
      } else {
        setFeedback(fb, false, b.hint || "Not yet — rework it and try again.", "");
      }
    }
    btn.onclick = check;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") check(); });
    if (isDone(b.id)) { inp.value = String(b.answer); inp.disabled = true; btn.disabled = true; setFeedback(fb, true, "Correct.", b.explain); }
    return card;
  };

  R.shorttext = function (b) {
    var card = activityCard(b.badge || "Short answer", b.id);
    card.appendChild(el("p", "r-prompt", b.prompt));
    var row = el("div", "r-row");
    var inp = el("input", "r-input");
    inp.type = "text"; inp.style.width = "260px";
    inp.placeholder = b.placeholder || "your answer";
    var btn = el("button", "r-btn", "Check");
    btn.type = "button";
    row.appendChild(inp); row.appendChild(btn);
    card.appendChild(row);
    var fb = feedback(card);
    var accepts = [b.answer].concat(b.accept || []).map(normText);
    function check() {
      var raw = inp.value.trim();
      if (raw === "") { setFeedback(fb, false, "Enter an answer first.", ""); return; }
      if (accepts.indexOf(normText(raw)) !== -1) {
        inp.disabled = true; btn.disabled = true;
        card._chk.classList.add("on");
        setFeedback(fb, true, "Correct.", b.explain);
        markDone(b.id);
      } else {
        setFeedback(fb, false, b.hint || "Not quite — try again.", "");
      }
    }
    btn.onclick = check;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") check(); });
    if (isDone(b.id)) { inp.value = b.answer; inp.disabled = true; btn.disabled = true; setFeedback(fb, true, "Correct.", b.explain); }
    return card;
  };

  R.parsons = function (b) {
    var card = activityCard(b.badge || "Build the proof", b.id);
    card.appendChild(el("p", "r-prompt", b.prompt || "Click the steps in the correct order to build the proof."));
    var grid = el("div", "r-parsons");
    var bankCol = el("div"); bankCol.appendChild(el("div", "r-pcol-title", "Available steps"));
    var ansCol = el("div"); ansCol.appendChild(el("div", "r-pcol-title", "Your proof (in order)"));
    var bank = el("div", "r-pbank");
    var ans = el("div", "r-pans");
    bankCol.appendChild(bank); ansCol.appendChild(ans);
    grid.appendChild(bankCol); grid.appendChild(ansCol);
    card.appendChild(grid);

    var order = [];               // indices placed, in order
    var idx = b.steps.map(function (_, i) { return i; });
    var shuffled = shuffle(idx);

    function stepBtn(i, where) {
      var btn = el("button", "r-step");
      btn.type = "button";
      btn.innerHTML = b.steps[i];
      btn.dataset.i = i;
      btn.onclick = function () {
        if (where === "bank") { order.push(i); redraw(); }
        else { order.splice(order.indexOf(i), 1); redraw(); }
      };
      return btn;
    }
    function redraw() {
      bank.innerHTML = ""; ans.innerHTML = "";
      shuffled.forEach(function (i) { if (order.indexOf(i) === -1) bank.appendChild(stepBtn(i, "bank")); });
      order.forEach(function (i, pos) {
        var s = stepBtn(i, "ans");
        s.innerHTML = '<span class="r-stepnum">' + (pos + 1) + ".</span>" + b.steps[i];
        ans.appendChild(s);
      });
      renderMath(grid);
    }

    var row = el("div", "r-row"); row.style.marginTop = "12px";
    var check = el("button", "r-btn", "Check order");
    var reset = el("button", "r-btn ghost", "Reset");
    check.type = "button"; reset.type = "button";
    row.appendChild(check); row.appendChild(reset);
    card.appendChild(row);
    var fb = feedback(card);

    function settle() {
      Array.prototype.forEach.call(ans.children, function (c) { c.classList.add("locked-ok"); c.disabled = true; });
      Array.prototype.forEach.call(bank.children, function (c) { c.disabled = true; });
      check.disabled = true;
      card._chk.classList.add("on");
      setFeedback(fb, true, "Correct — that's a valid proof.", b.explain);
      markDone(b.id);
    }
    check.onclick = function () {
      if (order.length !== b.steps.length) { setFeedback(fb, false, "Place all the steps first.", ""); return; }
      var ok = order.every(function (v, i) { return v === i; });
      if (ok) settle();
      else setFeedback(fb, false, b.hint || "Not quite — the order isn't valid yet. Reset and rethink which step each one depends on (what does each step need to already be true?).", "");
    };
    reset.onclick = function () { order = []; check.disabled = false; fb.textContent = ""; redraw(); };

    if (isDone(b.id)) { order = idx.slice(); redraw(); settle(); }
    else redraw();
    return card;
  };

  R.matching = function (b) {
    var card = activityCard(b.badge || "Match each item", b.id);
    card.appendChild(el("p", "r-prompt", b.prompt));
    var rights = b.pairs.map(function (p) { return p.right; });
    var shuffled = shuffle(rights);
    var table = el("div", "r-match");
    var selects = [];
    b.pairs.forEach(function (p, pi) {
      var row = el("div", "r-matchrow");
      var lab = el("div", "r-matchleft"); lab.innerHTML = p.left;
      var sel = document.createElement("select"); sel.className = "r-select";
      sel.setAttribute("aria-label", "Match for row " + (pi + 1));
      var o0 = document.createElement("option"); o0.value = ""; o0.textContent = "choose…"; sel.appendChild(o0);
      shuffled.forEach(function (r, ri) {
        var o = document.createElement("option"); o.value = String(ri); o.textContent = r; sel.appendChild(o);
      });
      row.appendChild(lab); row.appendChild(sel);
      table.appendChild(row);
      selects.push({ sel: sel, row: row, correct: p.right });
    });
    card.appendChild(table);
    var row = el("div", "r-row"); row.style.marginTop = "12px";
    var check = el("button", "r-btn", "Check"); check.type = "button";
    row.appendChild(check); card.appendChild(row);
    var fb = feedback(card);
    function settle() {
      selects.forEach(function (s) { s.sel.disabled = true; s.row.classList.add("ok"); });
      check.disabled = true;
      card._chk.classList.add("on");
      setFeedback(fb, true, "All matched correctly.", b.explain);
      markDone(b.id);
    }
    check.onclick = function () {
      var anyEmpty = selects.some(function (s) { return s.sel.value === ""; });
      if (anyEmpty) { setFeedback(fb, false, "Make a choice for every row first.", ""); return; }
      var allOk = true;
      selects.forEach(function (s) {
        var picked = shuffled[Number(s.sel.value)];
        var good = picked === s.correct;
        s.row.classList.toggle("ok", good);
        s.row.classList.toggle("no", !good);
        if (!good) allOk = false;
      });
      if (allOk) settle();
      else setFeedback(fb, false, "Not quite — the highlighted rows are wrong. Adjust and check again.", "");
    };
    if (isDone(b.id)) {
      selects.forEach(function (s) {
        for (var i = 0; i < shuffled.length; i++) { if (shuffled[i] === s.correct) { s.sel.value = String(i); break; } }
      });
      settle();
    }
    return card;
  };

  R.challenge = function (b) {
    var card = el("div", "r-activity r-challenge");
    if (b.id) card.dataset.blockId = b.id;
    var head = el("div", "r-activity-head");
    head.appendChild(el("span", "r-badge", b.badge || "Challenge"));
    card.appendChild(head);
    card.appendChild(el("p", "r-prompt", b.prompt));
    var btn = el("button", "r-btn secondary", "Show solution");
    btn.type = "button";
    var sol = el("div", "r-solution");
    sol.style.display = "none";
    sol.innerHTML = "<strong>Solution.</strong> " + b.solution;
    btn.onclick = function () {
      var show = sol.style.display === "none";
      sol.style.display = show ? "block" : "none";
      btn.textContent = show ? "Hide solution" : "Show solution";
      if (show) renderMath(sol);
    };
    card.appendChild(btn);
    card.appendChild(sol);
    return card;
  };

  R.custom = function (b) {
    var wrap = el("div", "r-widget");
    if (b.id) wrap.dataset.blockId = b.id;
    var api = {
      complete: function () { if (b.activity && b.id) { markDone(b.id); } },
      renderMath: function (n) { renderMath(n || wrap); },
      el: el
    };
    try { b.render(wrap, api); } catch (e) { wrap.textContent = "[widget error]"; }
    return wrap;
  };

  /* ---------- progress ---------- */
  function updateProgress() {
    var total = S.activityIds.length;
    var n = S.activityIds.filter(isDone).length;
    var fill = document.getElementById("r-progress-fill");
    var lab = document.getElementById("r-progress-label");
    if (fill) fill.style.width = total ? Math.round((n / total) * 100) + "%" : "0%";
    if (lab) lab.textContent = n + " of " + total + " activities complete";
    var banner = document.getElementById("r-done-banner");
    if (banner) banner.classList.toggle("on", total > 0 && n === total);
  }

  /* ---------- init ---------- */
  Reading.init = function (cfg) {
    S.id = cfg.id;
    load();
    S.activityIds = cfg.blocks
      .filter(function (b) {
        if (b.practice) return false;
        if (["mc", "selectall", "shortnum", "shorttext", "parsons", "matching"].indexOf(b.type) !== -1) return true;
        return b.type === "custom" && b.activity && b.id;
      })
      .map(function (b) { return b.id; });

    var root = document.getElementById("reading") || document.body;

    // top bar
    var top = el("div", "r-topbar");
    var inner = el("div", "r-topbar-inner");
    var crumb = el("div", "r-crumb", cfg.crumb || '<a href="index.html">CS 227 Readings</a>');
    var prog = el("div", "r-progress");
    prog.innerHTML =
      '<div class="r-progress-track"><div class="r-progress-fill" id="r-progress-fill"></div></div>' +
      '<span class="r-progress-label" id="r-progress-label"></span>';
    var reset = el("button", "r-reset", "reset");
    reset.onclick = function () {
      if (confirm("Reset your progress on this reading?")) { S.done = {}; save(); location.reload(); }
    };
    inner.appendChild(crumb); inner.appendChild(prog); inner.appendChild(reset);
    top.appendChild(inner);
    root.appendChild(top);

    var wrap = el("div", "r-wrap");
    root.appendChild(wrap);

    if (cfg.title) wrap.appendChild(el("h1", "r-title", cfg.title));
    if (cfg.subtitle) wrap.appendChild(el("p", "r-subtitle", cfg.subtitle));

    cfg.blocks.forEach(function (b) {
      var fn = R[b.type];
      if (fn) wrap.appendChild(fn(b));
    });

    // completion banner + nav
    var banner = el("div", "r-done-banner", '<span aria-hidden="true">✓</span> You’ve completed every activity in this reading. Nice work.');
    banner.id = "r-done-banner";
    wrap.appendChild(banner);

    var nav = el("div", "r-nav");
    nav.innerHTML =
      (cfg.prev ? '<a href="' + cfg.prev.href + '">← ' + cfg.prev.label + "</a>" : "<span></span>") +
      (cfg.next ? '<a href="' + cfg.next.href + '">' + cfg.next.label + " →</a>" : "<span></span>");
    wrap.appendChild(nav);

    renderMath(wrap);
    updateProgress();
  };

  window.Reading = Reading;
})();
