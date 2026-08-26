#!/usr/bin/env python3
"""
Build a Canvas-NATIVE course export (.imscc) from the content that build-canvas.js
already wrote into ./out (pages/ and quizzes/).

Why native format (not a plain Common Cartridge): a generic CC makes Canvas import
reading HTML as *Files* and ignores module ordering. Canvas only creates real
Pages + numbered/ordered Modules when the package carries its own extensions:
course_settings/module_meta.xml, wiki_content/ pages, g+md5 identifiers, and a
ZIP_STORED archive whose first entry is imsmanifest.xml.

Requirements followed (per the Canvas .imscc reconstruction spec):
  - identifiers are "g" + 32-char md5 hex (human-readable ids are silently rejected)
  - ZIP_STORED compression; imsmanifest.xml written FIRST; canvas_export.txt non-empty
  - manifest carries lom/lomimscc namespaces + LOM metadata; schemaLocation uses
    ccv1p1_imscp_v1p2_v1p0.xsd
  - syllabus resource before the course-settings bundle; bundle has no intendeduse
  - required course_settings stub files with correct root element names
Produces:  out/cs227-course.imscc
"""
import os, re, glob, html, hashlib, zipfile, sys

USE_EMBED = "--embed" in sys.argv   # embed the LIVE hosted reading (iframe) in each Page
BASE_URL = ""                       # public host of the readings (for the quiz->reading link)
if "--base" in sys.argv:
    BASE_URL = sys.argv[sys.argv.index("--base") + 1].rstrip("/")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(HERE, "out")
PAGES_DIR   = os.path.join(OUT, "pages")
QUIZZES_DIR = os.path.join(OUT, "quizzes")
COURSE_TITLE = "CS 227 — Interactive Readings"
NS_CCC = "http://canvas.instructure.com/xsd/cccv1p0"
XSI    = "http://www.w3.org/2001/XMLSchema-instance"

def gid(seed):
    return "g" + hashlib.md5(seed.encode("utf-8")).hexdigest()

def esc(s):
    return html.escape(str(s), quote=True)

def cccroot(tag, extra=""):
    return (f'<{tag} xmlns="{NS_CCC}" xmlns:xsi="{XSI}" '
            f'xsi:schemaLocation="{NS_CCC} {NS_CCC}.xsd"{extra}>')

# ---- gather readings from the node build output ----
readings = []
for pg in sorted(glob.glob(os.path.join(PAGES_DIR, "reading-*-*.page.html"))):
    fn = os.path.basename(pg)                       # reading-06-predicate-logic.page.html
    m = re.match(r"reading-(\d\d)-(.+)\.page\.html$", fn)
    num, slug = m.group(1), m.group(2)
    prose = open(pg, encoding="utf-8").read()
    if USE_EMBED:
        emb = os.path.join(PAGES_DIR, f"reading-{num}-{slug}.embed.html")
        body = open(emb, encoding="utf-8").read()   # iframe to the live hosted reading
    else:
        body = prose                                 # static prose only
    h2 = re.search(r"<h2>(.*?)</h2>", prose, re.S)
    full = re.sub(r"\s+", " ", html.unescape(h2.group(1))).strip() if h2 else f"Reading {int(num)}"
    short = re.sub(r"^Reading\s+\d+\s*[—-]\s*", "", full).strip()   # drop "Reading N — "
    disp = f"Reading {num} — {short}"                                # zero-padded for sort

    # matching quiz package written by build-canvas.js
    qdir = os.path.join(QUIZZES_DIR, f"reading-{num}-{slug}-check")
    qxml = glob.glob(os.path.join(qdir, "*", "*_check.xml"))
    qmeta = glob.glob(os.path.join(qdir, "*", "assessment_meta.xml"))
    readings.append({
        "num": num, "slug": slug, "short": short, "disp": disp, "body": body,
        "qti": open(qxml[0], encoding="utf-8").read() if qxml else None,
        "qmeta": open(qmeta[0], encoding="utf-8").read() if qmeta else None,
    })

course_id = gid("cs227_course")
files = {}   # arcname -> bytes/str  (imsmanifest added last, written first)

org_items, mod_items, resources = [], [], []

for r in readings:
    num = r["num"]
    page_id  = gid("page_" + num)
    quiz_id  = gid("quiz_" + num)
    assign_id = gid("quiz_assign_" + num)
    mod_id    = gid("module_" + num)
    mi_page   = gid("mi_page_" + num)
    mi_quiz   = gid("mi_quiz_" + num)
    reading_file = f"reading-{num}-{r['slug']}.html"
    page_href = f"wiki_content/{reading_file}"
    # Canvas-native quiz layout: QTI under non_cc_assessments/, meta in the quiz folder.
    qti_href  = f"non_cc_assessments/{quiz_id}.xml.qti"
    meta_href = f"{quiz_id}/assessment_meta.xml"
    quiz_title = f"{r['disp']} — Reading Check"

    # Link from the quiz back to its reading. If the readings are hosted, link the
    # live reading directly; otherwise link the Canvas Page by its wiki reference.
    if BASE_URL:
        reading_link = f"{BASE_URL}/{reading_file}"
    else:
        pslug = re.sub(r"[^a-z0-9]+", "-", r["disp"].lower()).strip("-")
        reading_link = f"$WIKI_REFERENCE$/pages/{pslug}"
    desc_html = (f'<p>First work through the reading: '
                 f'<a href="{reading_link}">{esc(r["disp"])}</a>. '
                 f'Then complete this short check.</p>')

    # ---- wiki page (Canvas Page) with required meta head ----
    files[page_href] = (
        "<html>\n<head>\n"
        '<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>\n'
        f"<title>{esc(r['disp'])}</title>\n"
        f'<meta name="identifier" content="{page_id}"/>\n'
        '<meta name="editing_roles" content="teachers"/>\n'
        '<meta name="workflow_state" content="active"/>\n'
        "</head>\n<body>\n" + r["body"] + "\n</body>\n</html>\n"
    )

    # ---- quiz: reuse node QTI + meta, but rewrite top-level ids/titles to g+md5 ----
    if r["qti"]:
        qti = re.sub(r'<assessment ident="[^"]+"',
                     f'<assessment ident="{quiz_id}"', r["qti"], count=1)
        qti = re.sub(r'(<assessment ident="[^"]+") title="[^"]+"',
                     rf'\1 title="{esc(quiz_title)}"', qti, count=1)
        files[qti_href] = qti

        meta = r["qmeta"]
        meta = re.sub(r'<quiz identifier="[^"]+"',
                      f'<quiz identifier="{quiz_id}"', meta, count=1)
        meta = re.sub(r'<assignment identifier="[^"]+"',
                      f'<assignment identifier="{assign_id}"', meta, count=1)
        meta = re.sub(r"<title>.*?</title>",
                      f"<title>{esc(quiz_title)}</title>", meta, count=2)
        meta = re.sub(r"<description>.*?</description>",
                      f"<description>{esc(desc_html)}</description>", meta, count=1, flags=re.S)
        files[meta_href] = meta

    # Modules are intentionally NOT generated — the instructor builds those manually.
    # Pages and quizzes still import as standalone Canvas Pages and Quizzes.

    # ---- imsmanifest resources ----
    resources.append(
        f'    <resource identifier="{page_id}" type="webcontent" href="{page_href}">\n'
        f'      <file href="{page_href}"/>\n'
        f"    </resource>"
    )
    if r["qti"]:
        meta_res = gid("quiz_metares_" + num)
        resources.append(
            f'    <resource identifier="{quiz_id}" type="imsqti_xmlv1p2/imscc_xmlv1p1/assessment" href="{qti_href}">\n'
            f'      <file href="{qti_href}"/>\n'
            f'      <dependency identifierref="{meta_res}"/>\n'
            f"    </resource>\n"
            f'    <resource identifier="{meta_res}" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="{meta_href}">\n'
            f'      <file href="{meta_href}"/>\n'
            f"    </resource>"
        )

# ---- course_settings stubs ----
files["course_settings/canvas_export.txt"] = "course, version 1\n"
files["course_settings/course_settings.xml"] = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    + cccroot("course", f' identifier="{course_id}"') + "\n"
    + f"  <title>{esc(COURSE_TITLE)}</title>\n"
    + "  <course_code>CS227</course_code>\n"
    + "  <default_view>modules</default_view>\n"
    + "  <is_public>false</is_public>\n"
    + "  <grading_standard_enabled>false</grading_standard_enabled>\n"
    + "</course>\n"
)
files["course_settings/module_meta.xml"] = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    + cccroot("modules") + "\n" + "\n".join(mod_items) + "\n</modules>\n"
)
files["course_settings/syllabus.html"] = (
    "<html>\n<head>\n"
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>\n'
    "<title>Syllabus</title>\n</head>\n<body>\n"
    f"<h2>{esc(COURSE_TITLE)}</h2>\n"
    "<p>Interactive readings and reading checks, organized by session in Modules.</p>\n"
    "</body>\n</html>\n"
)
files["course_settings/assignment_groups.xml"] = (
    '<?xml version="1.0" encoding="UTF-8"?>\n' + cccroot("assignmentGroups") + "\n</assignmentGroups>\n")
files["course_settings/files_meta.xml"] = (
    '<?xml version="1.0" encoding="UTF-8"?>\n' + cccroot("fileMeta") + "\n</fileMeta>\n")
files["course_settings/events.xml"] = (
    '<?xml version="1.0" encoding="UTF-8"?>\n' + cccroot("events") + "\n</events>\n")
files["course_settings/context.xml"] = (
    '<?xml version="1.0" encoding="UTF-8"?>\n' + cccroot("context_info") + "\n</context_info>\n")
files["course_settings/media_tracks.xml"] = (
    '<?xml version="1.0" encoding="UTF-8"?>\n' + cccroot("media_tracks") + "\n</media_tracks>\n")
files["course_settings/late_policy.xml"] = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    + cccroot("late_policy", f' identifier="{gid("late_policy")}"') + "\n"
    + "  <missing_submission_deduction_enabled>false</missing_submission_deduction_enabled>\n"
    + "  <missing_submission_deduction>0.0</missing_submission_deduction>\n"
    + "  <late_submission_deduction_enabled>false</late_submission_deduction_enabled>\n"
    + "  <late_submission_deduction>0.0</late_submission_deduction>\n"
    + "  <late_submission_interval>day</late_submission_interval>\n"
    + "  <late_submission_minimum_percent_enabled>false</late_submission_minimum_percent_enabled>\n"
    + "  <late_submission_minimum_percent>0.0</late_submission_minimum_percent>\n"
    + "</late_policy>\n"
)

settings_files = [
    "course_settings/course_settings.xml", "course_settings/module_meta.xml",
    "course_settings/assignment_groups.xml", "course_settings/files_meta.xml",
    "course_settings/events.xml", "course_settings/context.xml",
    "course_settings/media_tracks.xml", "course_settings/late_policy.xml",
    "course_settings/canvas_export.txt",
]

# ---- imsmanifest.xml (syllabus resource, then settings bundle, then content) ----
manifest = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    f'<manifest identifier="{course_id}"\n'
    '          xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1"\n'
    '          xmlns:lom="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource"\n'
    '          xmlns:lomimscc="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest"\n'
    '          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n'
    '          xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 '
    'https://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imscp_v1p2_v1p0.xsd">\n'
    "  <metadata>\n"
    "    <schema>IMS Common Cartridge</schema>\n"
    "    <schemaversion>1.1.0</schemaversion>\n"
    "    <lomimscc:lom>\n"
    "      <lomimscc:general>\n"
    f"        <lomimscc:title><lomimscc:string>{esc(COURSE_TITLE)}</lomimscc:string></lomimscc:title>\n"
    "      </lomimscc:general>\n"
    "      <lomimscc:lifeCycle>\n"
    "        <lomimscc:contribute>\n"
    "          <lomimscc:date><lomimscc:dateTime>2026-01-01</lomimscc:dateTime></lomimscc:date>\n"
    "        </lomimscc:contribute>\n"
    "      </lomimscc:lifeCycle>\n"
    "      <lomimscc:rights>\n"
    "        <lomimscc:copyrightAndOtherRestrictions>\n"
    "          <lomimscc:value>yes</lomimscc:value>\n"
    "        </lomimscc:copyrightAndOtherRestrictions>\n"
    "        <lomimscc:description>\n"
    "          <lomimscc:string>Private (Copyrighted) - http://en.wikipedia.org/wiki/Copyright</lomimscc:string>\n"
    "        </lomimscc:description>\n"
    "      </lomimscc:rights>\n"
    "    </lomimscc:lom>\n"
    "  </metadata>\n"
    "  <organizations>\n"
    '    <organization identifier="org_1" structure="rooted-hierarchy">\n'
    '      <item identifier="LearningModules">\n'
    + "\n".join(org_items) + "\n"
    "      </item>\n"
    "    </organization>\n"
    "  </organizations>\n"
    "  <resources>\n"
    f'    <resource identifier="{gid("syllabus")}" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="course_settings/syllabus.html" intendeduse="syllabus">\n'
    '      <file href="course_settings/syllabus.html"/>\n'
    "    </resource>\n"
    f'    <resource identifier="{course_id}" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="course_settings/canvas_export.txt">\n'
    + "".join(f'      <file href="{f}"/>\n' for f in settings_files)
    + "    </resource>\n"
    + "\n".join(resources) + "\n"
    "  </resources>\n</manifest>\n"
)

# ---- write ZIP: imsmanifest.xml FIRST, ZIP_STORED ----
out_path = os.path.join(OUT, "cs227-course.imscc")
if os.path.exists(out_path):
    os.remove(out_path)
with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_STORED) as zf:
    zf.writestr("imsmanifest.xml", manifest)
    for arc, data in files.items():
        zf.writestr(arc, data)

print(f"Wrote {out_path}")
print(f"  readings: {len(readings)}  |  modules: {len(mod_items)}  |  resources: {len(resources)+2}")
