#!/usr/bin/env node
/*
 * CS 227 → Canvas exporter.
 *
 * Source of truth: the reading-*.html files one directory up. This script is a
 * one-way generator; edit the readings, then re-run this to regenerate Canvas
 * artifacts. It does NOT modify the readings.
 *
 * For each reading it emits, under ./out/ :
 *   pages/reading-NN-<slug>.page.html    – prose-only Canvas Page (paste into the RCE)
 *   pages/reading-NN-<slug>.embed.html   – a one-line iframe embed of the live reading
 *   quizzes/reading-NN-<slug>-check/     – a Canvas QTI 1.2 package (imsmanifest + assessment + meta)
 *   quizzes/reading-NN-<slug>-check.zip  – zipped package to import (zipped by the wrapper shell step)
 *
 * The graded "reading check" quiz uses the reading's in-line activities of the
 * import-safe types (multiple choice, multiple answers, numeric, short answer).
 * Parsons / matching / interactive widgets are intentionally left in the Page,
 * not the quiz.
 *
 * Usage:  node build-canvas.js [BASE_URL]
 *   BASE_URL (optional) = the public URL where the interactive-readings folder is
 *   hosted, used for the .embed.html iframe. Defaults to a placeholder.
 */
"use strict";
var fs = require("fs");
var path = require("path");

var SRC = path.resolve(__dirname, "..");
var OUT = path.resolve(__dirname, "out");
var BASE_URL = (process.argv[2] || "REPLACE_WITH_HOSTED_BASE_URL").replace(/\/+$/, "");
var SAFE_TYPES = { mc: 1, selectall: 1, shortnum: 1, shorttext: 1 };
var POINTS_PER_Q = 1;
var CHECK_CAP = 4; // keep the reading-check short; raise/lower as you like

/* ---------- helpers ---------- */
function inlineScript(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(function (m) { return m[1]; })
    .filter(function (s) { return s.indexOf("Reading.init") !== -1; })
    .join("\n");
}
function getCfg(html) {
  var cfg = null;
  // define the custom widget fns as no-ops so files that declare them still eval
  var sandbox = "var recursionUnfolder,treeGrower,greedyExplorer,guidedProof;\n";
  new Function("Reading", sandbox + inlineScript(html))({ init: function (c) { cfg = c; }, renderMath: function () {} });
  return cfg;
}
// $...$ -> \(...\), $$...$$ -> \[...\]  (Canvas renders these via MathJax)
function toCanvasMath(s) {
  if (typeof s !== "string") return s;
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, function (_, x) { return "\\(" + x + "\\)"; });
  s = s.replace(/\$([^$]+?)\$/g, function (_, x) { return "\\(" + x + "\\)"; });
  return s;
}
function xmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function cdata(s) { return "<![CDATA[" + String(s).replace(/\]\]>/g, "]]]]><![CDATA[>") + "]]>"; }
function slugFromFile(f) { return f.replace(/^reading-\d\d-/, "").replace(/\.html$/, ""); }
function numFromFile(f) { return f.match(/^reading-(\d\d)/)[1]; }
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }

/* ---------- Canvas Page (prose only) ---------- */
function buildPage(cfg, num, embedHref) {
  var parts = [];
  parts.push('<h2>' + xmlEscape(cfg.title) + "</h2>");
  if (cfg.subtitle) parts.push('<p><em>' + toCanvasMath(cfg.subtitle) + "</em></p>");
  parts.push('<p style="color:#666"><strong>Read this page, then take the “' +
    xmlEscape(cfg.title.replace(/^Reading \d+ — /, "")) + ' — Reading Check.”</strong></p>');
  for (var i = 0; i < cfg.blocks.length; i++) {
    var b = cfg.blocks[i];
    if (b.type === "prose") {
      // stop at the Exam-practice divider — the Page is the reading, not the practice bank
      if (/Exam practice/.test(b.html)) break;
      parts.push(toCanvasMath(b.html));
    } else if (b.type === "def") {
      parts.push('<div style="border:1px solid #ccc;border-left:4px solid #2f54c8;border-radius:6px;padding:10px 14px;margin:12px 0;">' +
        "<h3>" + xmlEscape(b.title || "Definition") + "</h3>" + toCanvasMath(b.html) + "</div>");
    }
    // mc/selectall/shortnum/etc and custom widgets are omitted from the prose Page
  }
  return parts.join("\n");
}
function buildEmbed(file, cfg) {
  return '<p><em>' + xmlEscape(cfg.title) + '</em></p>\n' +
    '<p><iframe src="' + BASE_URL + "/" + file + '" width="100%" height="1200" ' +
    'style="border:1px solid #ccc;border-radius:8px;" title="' + xmlEscape(cfg.title) + '"></iframe></p>\n' +
    '<p>If the reading does not load above, <a href="' + BASE_URL + "/" + file + '">open it in a new tab</a>.</p>';
}

/* ---------- QTI items ---------- */
function itemMeta(qtype, points) {
  return "<itemmetadata><qtimetadata>" +
    '<qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>' + qtype + "</fieldentry></qtimetadatafield>" +
    '<qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>' + points + "</fieldentry></qtimetadatafield>" +
    "</qtimetadata></itemmetadata>";
}
function outcomes() {
  return '<outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>';
}
function mattext(s) { return '<material><mattext texttype="text/html">' + cdata(toCanvasMath(s)) + "</mattext></material>"; }

// Deterministic per-question permutation of choice display order, seeded by the
// item id so re-exports are stable. Idents stay tied to the ORIGINAL index, so
// the correctness conditions (which reference cN) remain valid regardless of the
// order the labels are presented in. This removes the correct-answer-position
// bias baked into the source data (correct choice is authored first).
function seededPerm(seedStr, n) {
  var h = 2166136261 >>> 0;
  for (var k = 0; k < seedStr.length; k++) {
    h ^= seedStr.charCodeAt(k); h = Math.imul(h, 16777619) >>> 0;
  }
  function rng() { h += 0x6D2B79F5; var t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  var a = []; for (var i = 0; i < n; i++) a.push(i);
  for (var j = n - 1; j > 0; j--) { var m = Math.floor(rng() * (j + 1)); var tmp = a[j]; a[j] = a[m]; a[m] = tmp; }
  return a;
}

function itemMC(id, b) {
  var perm = seededPerm(id, b.choices.length);
  var labels = perm.map(function (oi) {
    return '<response_label ident="c' + oi + '">' + mattext(b.choices[oi]) + "</response_label>";
  }).join("");
  var fb = "";
  var resp =
    "<resprocessing>" + outcomes() +
    '<respcondition continue="No"><conditionvar><varequal respident="response1">c' + b.answer + "</varequal></conditionvar>" +
    '<setvar action="Set" varname="SCORE">100</setvar></respcondition>' +
    "</resprocessing>";
  return '<item ident="' + id + '" title="' + xmlEscape(id) + '">' + itemMeta("multiple_choice_question", POINTS_PER_Q) +
    "<presentation>" + mattext(b.prompt) +
    '<response_lid ident="response1" rcardinality="Single"><render_choice>' + labels + "</render_choice></response_lid>" +
    "</presentation>" + resp + "</item>";
}

function itemMulti(id, b) {
  var correct = {}; b.answers.forEach(function (i) { correct[i] = 1; });
  var perm = seededPerm(id, b.choices.length);
  var labels = perm.map(function (oi) {
    return '<response_label ident="c' + oi + '">' + mattext(b.choices[oi]) + "</response_label>";
  }).join("");
  var conds = b.choices.map(function (c, i) {
    return correct[i]
      ? '<varequal respident="response1">c' + i + "</varequal>"
      : '<not><varequal respident="response1">c' + i + "</varequal></not>";
  }).join("");
  var resp =
    "<resprocessing>" + outcomes() +
    '<respcondition continue="No"><conditionvar><and>' + conds + "</and></conditionvar>" +
    '<setvar action="Set" varname="SCORE">100</setvar></respcondition>' +
    "</resprocessing>";
  return '<item ident="' + id + '" title="' + xmlEscape(id) + '">' + itemMeta("multiple_answers_question", POINTS_PER_Q) +
    "<presentation>" + mattext(b.prompt) +
    '<response_lid ident="response1" rcardinality="Multiple"><render_choice>' + labels + "</render_choice></response_lid>" +
    "</presentation>" + resp + "</item>";
}

function itemNumeric(id, b) {
  var a = b.answer, tol = b.tol || 0;
  var cond = tol > 0
    ? "<or><varequal respident=\"response1\">" + a + "</varequal>" +
      "<and><vargte respident=\"response1\">" + (a - tol) + "</vargte><varlte respident=\"response1\">" + (a + tol) + "</varlte></and></or>"
    : "<varequal respident=\"response1\">" + a + "</varequal>";
  var resp =
    "<resprocessing>" + outcomes() +
    '<respcondition continue="No"><conditionvar>' + cond + "</conditionvar>" +
    '<setvar action="Set" varname="SCORE">100</setvar></respcondition>' +
    "</resprocessing>";
  return '<item ident="' + id + '" title="' + xmlEscape(id) + '">' + itemMeta("numerical_question", POINTS_PER_Q) +
    "<presentation>" + mattext(b.prompt) +
    '<response_str ident="response1" rcardinality="Single"><render_fib fibtype="Decimal"><response_label ident="answer1"/></render_fib></response_str>' +
    "</presentation>" + resp + "</item>";
}

function itemShortText(id, b) {
  var accepts = [b.answer].concat(b.accept || []);
  var conds = accepts.map(function (a) {
    return '<varequal respident="response1" case="No">' + xmlEscape(a) + "</varequal>";
  }).join("");
  var resp =
    "<resprocessing>" + outcomes() +
    '<respcondition continue="No"><conditionvar><or>' + conds + "</or></conditionvar>" +
    '<setvar action="Set" varname="SCORE">100</setvar></respcondition>' +
    "</resprocessing>";
  return '<item ident="' + id + '" title="' + xmlEscape(id) + '">' + itemMeta("short_answer_question", POINTS_PER_Q) +
    "<presentation>" + mattext(b.prompt) +
    '<response_str ident="response1" rcardinality="Single"><render_fib><response_label ident="answer1"/></render_fib></response_str>' +
    "</presentation>" + resp + "</item>";
}

function buildItem(readingId, b) {
  var id = ("cs227_" + readingId + "_" + b.id).replace(/[^A-Za-z0-9_]/g, "_");
  if (b.type === "mc") return itemMC(id, b);
  if (b.type === "selectall") return itemMulti(id, b);
  if (b.type === "shortnum") return itemNumeric(id, b);
  if (b.type === "shorttext") return itemShortText(id, b);
  return null;
}

/* ---------- QTI assessment + manifest + meta ---------- */
function buildQuiz(cfg, num, items, quizIdent, title) {
  var pts = (items.length * POINTS_PER_Q).toFixed(1);
  var assessment =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">\n' +
    '  <assessment ident="' + quizIdent + '" title="' + xmlEscape(title) + '">\n' +
    "    <qtimetadata><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>unlimited</fieldentry></qtimetadatafield></qtimetadata>\n" +
    '    <section ident="root_section">\n      ' + items.join("\n      ") + "\n    </section>\n" +
    "  </assessment>\n</questestinterop>\n";

  var meta =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<quiz identifier="' + quizIdent + '" xmlns="http://canvas.instructure.com/xsd/cccv1p0" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xsi:schemaLocation="http://canvas.instructure.com/xsd/cccv1p0 https://canvas.instructure.com/xsd/cccv1p0.xsd">\n' +
    "  <title>" + xmlEscape(title) + "</title>\n" +
    "  <description>&lt;p&gt;Short reading check. Auto-graded.&lt;/p&gt;</description>\n" +
    "  <quiz_type>assignment</quiz_type>\n" +
    "  <points_possible>" + pts + "</points_possible>\n" +
    "  <allowed_attempts>-1</allowed_attempts>\n" +
    "  <scoring_policy>keep_highest</scoring_policy>\n" +
    "  <shuffle_answers>true</shuffle_answers>\n" +
    "  <show_correct_answers>true</show_correct_answers>\n" +
    "  <assignment identifier=\"" + quizIdent + "_assign\">\n" +
    "    <title>" + xmlEscape(title) + "</title>\n" +
    "    <points_possible>" + pts + "</points_possible>\n" +
    "    <grading_type>points</grading_type>\n" +
    "    <submission_types>online_quiz</submission_types>\n" +
    "  </assignment>\n</quiz>\n";

  var manifest =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<manifest identifier="cs227_' + quizIdent + '_manifest" ' +
    'xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n' +
    "  <metadata><schema>IMS Content</schema><schemaversion>1.1.3</schemaversion></metadata>\n" +
    "  <organizations/>\n" +
    "  <resources>\n" +
    '    <resource identifier="' + quizIdent + '" type="imsqti_xmlv1p2/imscc_xmlv1p1/assessment" href="' + quizIdent + "/" + quizIdent + '.xml">\n' +
    '      <file href="' + quizIdent + "/" + quizIdent + '.xml"/>\n' +
    '      <dependency identifierref="' + quizIdent + '_meta"/>\n' +
    "    </resource>\n" +
    '    <resource identifier="' + quizIdent + '_meta" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="' + quizIdent + '/assessment_meta.xml">\n' +
    '      <file href="' + quizIdent + '/assessment_meta.xml"/>\n' +
    "    </resource>\n" +
    "  </resources>\n</manifest>\n";

  return { assessment: assessment, meta: meta, manifest: manifest };
}

/* ---------- main ---------- */
mkdirp(path.join(OUT, "pages"));
mkdirp(path.join(OUT, "quizzes"));

var files = fs.readdirSync(SRC).filter(function (f) { return /^reading-\d\d.*\.html$/.test(f); }).sort();
var summary = [];
var cartridge = [];   // collected per-reading pieces for the whole-course .imscc

files.forEach(function (file) {
  var html = fs.readFileSync(path.join(SRC, file), "utf8");
  var cfg = getCfg(html);
  var num = numFromFile(file);
  var slug = slugFromFile(file);
  var base = "reading-" + num + "-" + slug;

  // Page (prose-only) + embed variant
  fs.writeFileSync(path.join(OUT, "pages", base + ".page.html"), buildPage(cfg, num) + "\n");
  fs.writeFileSync(path.join(OUT, "pages", base + ".embed.html"), buildEmbed(file, cfg) + "\n");

  // Quiz: in-line activities (not practice), import-safe types only
  var checkBlocks = cfg.blocks.filter(function (b) {
    return SAFE_TYPES[b.type] && !b.practice;
  }).slice(0, CHECK_CAP);
  var items = checkBlocks.map(function (b) { return buildItem(cfg.id, b); }).filter(Boolean);
  var title = cfg.title.replace(/^Reading \d+ — /, "") + " — Reading Check";
  var quizIdent = ("cs227_" + num + "_check").replace(/[^A-Za-z0-9_]/g, "_");
  var q = buildQuiz(cfg, num, items, quizIdent, title);

  var qdir = path.join(OUT, "quizzes", base + "-check");
  mkdirp(path.join(qdir, quizIdent));
  fs.writeFileSync(path.join(qdir, "imsmanifest.xml"), q.manifest);
  fs.writeFileSync(path.join(qdir, quizIdent, quizIdent + ".xml"), q.assessment);
  fs.writeFileSync(path.join(qdir, quizIdent, "assessment_meta.xml"), q.meta);

  summary.push({ file: file, page: base + ".page.html", quiz: base + "-check", items: items.length });
  cartridge.push({
    num: num, base: base, moduleTitle: cfg.title, quizTitle: title,
    pageHtml: buildPage(cfg, num) + "\n", quizIdent: quizIdent,
    assessment: q.assessment, meta: q.meta, items: items.length
  });
});

/* ---------- whole-course Common Cartridge (.imscc source tree) ---------- */
(function buildCartridge() {
  var CART = path.join(OUT, "cartridge");
  mkdirp(path.join(CART, "pages"));

  var orgItems = "";
  var resources = "";

  cartridge.forEach(function (r) {
    var pageRes = "res_page_" + r.num;
    var quizRes = r.quizIdent;              // e.g. cs227_06_check
    var metaRes = r.quizIdent + "_meta";
    var pageHref = "pages/" + r.base + ".html";
    var quizDir = "q_" + r.quizIdent;
    var quizHref = quizDir + "/" + r.quizIdent + ".xml";
    var metaHref = quizDir + "/assessment_meta.xml";

    // files
    fs.writeFileSync(path.join(CART, "pages", r.base + ".html"), r.pageHtml);
    mkdirp(path.join(CART, quizDir));
    fs.writeFileSync(path.join(CART, quizDir, r.quizIdent + ".xml"), r.assessment);
    fs.writeFileSync(path.join(CART, quizDir, "assessment_meta.xml"), r.meta);

    // one module per reading: Page then Quiz
    orgItems +=
      '      <item identifier="mod_' + r.num + '">\n' +
      "        <title>" + xmlEscape(r.moduleTitle) + "</title>\n" +
      '        <item identifier="it_page_' + r.num + '" identifierref="' + pageRes + '">\n' +
      "          <title>" + xmlEscape(r.moduleTitle) + "</title>\n" +
      "        </item>\n" +
      '        <item identifier="it_quiz_' + r.num + '" identifierref="' + quizRes + '">\n' +
      "          <title>" + xmlEscape(r.quizTitle) + "</title>\n" +
      "        </item>\n" +
      "      </item>\n";

    resources +=
      '    <resource identifier="' + pageRes + '" type="webcontent" href="' + pageHref + '">\n' +
      '      <file href="' + pageHref + '"/>\n' +
      "    </resource>\n" +
      '    <resource identifier="' + quizRes + '" type="imsqti_xmlv1p2/imscc_xmlv1p1/assessment" href="' + quizHref + '">\n' +
      '      <file href="' + quizHref + '"/>\n' +
      '      <dependency identifierref="' + metaRes + '"/>\n' +
      "    </resource>\n" +
      '    <resource identifier="' + metaRes + '" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="' + metaHref + '">\n' +
      '      <file href="' + metaHref + '"/>\n' +
      "    </resource>\n";
  });

  var manifest =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<manifest identifier="cs227_readings_course" ' +
    'xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1" ' +
    'xmlns:lom="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource" ' +
    'xmlns:lomimscc="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imscp_v1p2_v1p0.xsd">\n' +
    "  <metadata>\n" +
    "    <schema>IMS Common Cartridge</schema>\n" +
    "    <schemaversion>1.1.0</schemaversion>\n" +
    "  </metadata>\n" +
    '  <organizations>\n' +
    '    <organization identifier="org_cs227" structure="rooted-hierarchy">\n' +
    '      <item identifier="root">\n' +
    orgItems +
    "      </item>\n" +
    "    </organization>\n" +
    "  </organizations>\n" +
    "  <resources>\n" +
    resources +
    "  </resources>\n</manifest>\n";

  fs.writeFileSync(path.join(CART, "imsmanifest.xml"), manifest);
})();

console.log("READING FILE".padEnd(38) + "CHECK Qs");
summary.forEach(function (s) { console.log(s.file.padEnd(38) + s.items); });
console.log("\nTotal readings: " + summary.length + " | total check questions: " +
  summary.reduce(function (a, s) { return a + s.items; }, 0));
console.log("Output in: " + OUT);
