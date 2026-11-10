"""Generate prototype pages for every applyd.ai route from the downloaded HTML.

Content comes from the live pages; markup, theme and motion hooks come from the prototype.
Usage: python3 -P build.py <raw_dir> <out_dir>
"""
import sys, os, re, json, html, copy
from urllib.parse import unquote, urlparse, parse_qs
import lxml.html as H
from lxml import etree
sys.path.insert(0, os.path.dirname(__file__))
from clean import clean

RAW, OUT = sys.argv[1], sys.argv[2]
ROUTES = [u.strip().replace('https://applyd.ai', '') or '/' for u in open(os.path.join(RAW, 'urls.txt')) if u.strip()]
ROUTES = sorted(set(r.rstrip('/') or '/' for r in ROUTES))

def fname(route):
    route = route.rstrip('/') or '/'
    return 'index.html' if route == '/' else route.strip('/').replace('/', '-') + '.html'

def raw_file(route):
    return os.path.join(RAW, ('index' if route == '/' else route.strip('/').replace('/', '_')) + '.html')

ARROW = '<svg width="16" height="16" aria-hidden="true"><use href="#arrow"/></svg>'
ARROW_NE = '<svg width="16" height="16" aria-hidden="true"><use href="#arrow-ne"/></svg>'
esc = lambda s: html.escape(s or '', quote=True)
norm = lambda s: ' '.join((s or '').split())

def local_href(href):
    if not href: return href
    if href.startswith(('mailto:', 'tel:')): return href
    if href.startswith('#'): return href
    u = urlparse(href)
    if u.netloc and u.netloc not in ('applyd.ai', 'www.applyd.ai'): return href
    path = (u.path or '/').rstrip('/') or '/'
    if path not in ROUTES: return href if u.netloc else 'https://applyd.ai' + href
    out = fname(path)
    if u.query: out += '?' + u.query
    if u.fragment: out += '#' + u.fragment
    return out

def local_src(src):
    if not src: return src
    if src.startswith('/_next/image'):
        q = parse_qs(urlparse(src).query)
        src = unquote(q.get('url', [''])[0])
    if src.startswith('/'): return '../assets' + src
    return src

def text(el):
    if el is None: return ''
    parts = []
    for t in el.itertext():
        if parts and t[:1].isalnum() and parts[-1][-1:].isalnum(): parts.append(' ')
        parts.append(t)
    return norm(''.join(parts))
def htext(el):
    return norm(re.sub('<[^>]+>', '', heading_html(el)).replace('&amp;', '&'))

def inner(el):
    """Inline HTML of an element: text, links, emphasis. Everything else is reduced to its text."""
    out = [esc(el.text or '')]
    for c in el:
        if not isinstance(c.tag, str):
            out.append(esc(c.tail or '')); continue
        if c.tag == 'a':
            out.append(f'<a href="{esc(local_href(c.get("href")))}">{inner(c)}</a>')
        elif c.tag in ('em', 'i'):
            out.append(f'<em>{inner(c)}</em>')
        elif c.tag in ('strong', 'b'):
            out.append(f'<strong>{inner(c)}</strong>')
        elif c.tag == 'br':
            out.append('<br>')
        elif c.tag == 'code':
            out.append(f'<code>{esc(c.text_content())}</code>')
        elif c.tag == 'time':
            out.append(f'<time>{esc(c.text_content())}</time>')
        else:
            out.append(inner(c))
        tail = c.tail or ''
        if c.tag in ('span', 'strong', 'b', 'div', 'p', 'li', 'small', 'label') and tail[:1].isalnum() and out[-1][-1:].isalnum():
            out.append(' ')
        out.append(esc(tail))
    return re.sub(r'\s+', ' ', ''.join(out)).strip()

def heading_html(el):
    """Headings carry a second clause in <em>; keep it, with a space before it."""
    s = inner(el)
    s = re.sub(r'(\S)<em>', r'\1 <em>', s)
    return s

# ---------------------------------------------------------------- tokens
# A cleaned section is flattened into a sequence of meaningful units, ignoring layout divs.

def tokens(el, out=None):
    out = [] if out is None else out
    for c in el:
        if not isinstance(c.tag, str): continue
        t = c.tag
        if t in ('h1', 'h2', 'h3', 'h4', 'h5'):
            if c.find('.//button') is not None: out.append(('faq', text(c), c))
            else: out.append(('h', t, c))
        elif t == 'p':
            if text(c): out.append(('p', c))
        elif t in ('ul', 'ol'):
            out.append(('list', c))
        elif t == 'dl': out.append(('dl', c))
        elif t == 'figure': out.append(('figure', c))
        elif t == 'table': out.append(('table', c))
        elif t in ('img', 'video', 'picture'): out.append(('media', c))
        elif t == 'a':
            if text(c): out.append(('a', c))
        elif t in ('strong', 'b'):
            out.append(('strong', c))
        elif t in ('span', 'time', 'small', 'em', 'legend', 'label', 'cite'):
            if text(c): out.append(('span', c))
        elif t == 'nav': out.append(('nav', c))
        elif t == 'form': out.append(('form', c))
        elif t == 'article': out.append(('article', c))
        elif t == 'blockquote': out.append(('quote', c))
        elif t == 'details': out.append(('details', c))
        elif t == 'button': pass
        elif t == 'div' and c.get('role') == 'region' and c.find('.//div[@data-panel]') is not None:
            out.append(('panels', c))
        elif t == 'div' and c.get('data-panel'):
            out.append(('panel', c))
        else:
            if t == 'div' and norm(c.text) and len(c) == 0:
                out.append(('p', c)); continue
            tokens(c, out)
    return out

# ---------------------------------------------------------------- components

TONE_WORDS = {'agent': 'agent', 'system work': 'agent', 'tested': 'agent', 'automatic': 'agent', 'agent work': 'agent',
              'person': 'human', 'a person decides': 'human', 'approval': 'human', 'human': 'human', 'review': 'human',
              'outcome': 'done', 'done': 'done', 'logged': 'done', 'blocked': 'human'}

def pill(label):
    tone = TONE_WORDS.get(label.lower().strip(), 'agent')
    return f'<span class="pill pill--{tone}">{esc(label)}</span>'

def li_parts(li):
    """Split a list item into (title, tag, body, link)."""
    kids = [k for k in li if isinstance(k.tag, str)]
    while len(kids) == 1 and kids[0].tag == 'div' and not norm(kids[0].text):
        kids = [k for k in kids[0] if isinstance(k.tag, str)]
    kids = [k for k in kids if text(k)]
    link = None
    if len(kids) == 1 and kids[0].tag == 'a' and len([k for k in kids[0] if isinstance(k.tag, str)]) >= 1:
        a = kids[0]; link = local_href(a.get('href')); kids = [k for k in a if isinstance(k.tag, str)] or [a]
    title = tag = None; body = []
    for k in kids:
        tx = text(k)
        if not tx: continue
        if title is None and k.tag in ('strong', 'b', 'h3', 'h4', 'span', 'a', 'p') and len(tx) < 110 and (k.tag != 'p' or len(kids) > 1):
            title = k
            a = k if k.tag == 'a' else k.find('a')
            if a is not None and text(a) == tx and link is None:
                link = local_href(a.get('href')); title = H.fromstring(f'<span>{esc(tx)}</span>')
            continue
        if title is not None and tag is None and k.tag == 'span' and len(tx) <= 18 and not body and len(kids) >= 3:
            tag = tx; continue
        body.append(k)
    return title, tag, body, link

def render_body(parts):
    out = []
    for k in parts:
        if k.tag in ('ul', 'ol'):
            out.append('<ul class="mini">' + ''.join(f'<li>{inner(x)}</li>' for x in k if isinstance(x.tag, str)) + '</ul>')
        elif k.tag == 'dl':
            out.append(render_dl(k, small=True))
        elif k.tag == 'time':
            out.append(f'<span class="mono">{esc(text(k))}</span>')
        else:
            out.append(f'<p>{inner(k)}</p>')
    return ''.join(out)

def render_dl(dl, small=False):
    rows = []; dt = None
    for k in dl.iter('dt', 'dd'):
        if k.tag == 'dt': dt = k
        else:
            lis = [x for x in k.iter('li')]
            val = ('<ul class="chips">' + ''.join(f'<li>{esc(text(x))}</li>' for x in lis) + '</ul>') if lis else inner(k)
            rows.append(f'<div data-rise><dt>{inner(dt) if dt is not None else ""}</dt><dd>{val}</dd></div>')
            dt = None
    cls = 'spec' if small else 'facts'
    return f'<dl class="{cls}">' + ''.join(rows) + '</dl>'

def is_question(s): return s.strip().endswith('?')

def render_list(ul, faqmap):
    items = [li for li in ul if isinstance(li.tag, str) and li.tag == 'li']
    if not items: return ''
    # related links / cards that are links
    if all(len([k for k in li if isinstance(k.tag, str)]) == 1 and li.find('a') is not None and text(li.find('a')) == text(li) for li in items):
        cards = []
        for li in items:
            a = li.find('a'); spans = [s for s in a if isinstance(s.tag, str) and text(s)]
            if len(spans) >= 2:
                t, d = text(spans[0]), ' '.join(text(s) for s in spans[1:])
            else:
                t, d = text(a), ''
            cards.append(f'<li data-rise><a class="rel" href="{esc(local_href(a.get("href")))}"><b>{esc(t)}</b>{f"<span>{esc(d)}</span>" if d else ""}{ARROW_NE}</a></li>')
        return '<ul class="rels">' + ''.join(cards) + '</ul>'
    # Chat transcript
    if any(li.get('data-side') for li in items):
        bubbles = []; summary = []
        for li in items:
            side = li.get('data-side')
            if side:
                parts = [x for x in li if isinstance(x.tag, str) and text(x)]
                first = text(parts[0]) if parts else ''
                named = len(parts) > 1 and (first.endswith(':') or first.lower() in ('visitor', 'agent', 'customer', 'assistant', 'user', 'lead', 'rep'))
                who = first.rstrip(':') if named else ('Visitor' if side == 'visitor' else 'Agent')
                rest = parts[1:] if named else parts
                msg = inner(rest[0]) if rest else ''
                meta = ''.join(f'<small class="chat__meta mono">{inner(x)}</small>' for x in rest[1:])
                bubbles.append(f'<li class="chat__msg chat__msg--{side}"><span class="mono">{esc(who)}</span><p>{msg}</p>{meta}</li>')
            else:
                summary.append(f'<li>{inner(li)}</li>')
        return ('<div class="chat" data-chat><ol class="chat__log">' + ''.join(bubbles) + '</ol>'
                + (f'<ul class="chat__sum">{"".join(summary)}</ul>' if summary else '') + '</div>')
    # Clips with a title and a line each
    has_media = [li for li in items if li.find('.//video') is not None or li.find('.//img') is not None]
    if len(has_media) >= 2:
        cards = []; notes = []
        for li in items:
            if li not in has_media:
                notes.append(f'<p class="para para--note" data-rise>{inner(li)}</p>'); continue
            m = media_html(li.find('.//figure') if li.find('.//figure') is not None else (li.find('.//video') if li.find('.//video') is not None else li.find('.//img')), 'vcard__media')
            ts = [x for x in li.iter('h3', 'h4', 'strong') if text(x)]
            ps = [x for x in li.iter('p', 'span') if text(x) and x.getparent().tag not in ('h3', 'h4') and (not ts or text(x) != text(ts[0]))]
            body = ''.join(f'<p class="mono">{esc(text(x))}</p>' if re.match(r'^\d{1,2}\s*/', text(x)) else f'<p>{inner(x)}</p>' for x in ps[:3])
            cards.append(f'<li class="vcard" data-rise>{m}<div class="vcard__body">{f"<h3>{inner(ts[0])}</h3>" if ts else ""}{body}</div></li>')
        return '<ul class="vcards">' + ''.join(cards) + '</ul>' + ''.join(notes)
    # A short ordered path of named steps: a pipeline
    if ul.tag == 'ol' and len(items) >= 4 and all(len(text(li)) < 60 for li in items) and not any(li.find('.//time') is not None for li in items):
        steps = []
        for n, li in enumerate(items):
            spans = [text(x) for x in li if isinstance(x.tag, str) and text(x)] or [text(li)]
            if len(spans) > 1:
                steps.append(f'<li class="pipe__step pipe__step--fork"><span class="mono">{n+1:02d}</span>' + ''.join(f'<b data-tone="{"done" if i == 0 else "human"}">{esc(t)}</b>' for i, t in enumerate(spans)) + '</li>')
            else:
                steps.append(f'<li class="pipe__step"><span class="mono">{n+1:02d}</span><b>{esc(spans[0])}</b></li>')
        return '<ol class="pipe" data-pipe>' + ''.join(steps) + '</ol>'
    # FAQ written as question headings + answers
    if all(li.find('h3') is not None and is_question(text(li.find('h3'))) for li in items):
        return render_faq([(text(li.find('h3')), ''.join(f'<p>{inner(p)}</p>' for p in li.findall('p')) or esc(faqmap.get(text(li.find('h3')), ''))) for li in items])
    # timeline rows (span title, time, span body)
    if all(li.find('time') is not None for li in items):
        return render_log_rows(items)
    parted = [li_parts(li) for li in items]
    if all(p[0] is not None and p[2] for p in parted):
        cards = []
        for i, (t, tag, body, link) in enumerate(parted):
            top = pill(tag) if tag else ('' if re.match(r'^\d{1,2}\s*/', text(t)) else f'<span class="card__n mono">{i+1:02d}</span>')
            inner_html = f'<div class="card__top">{top}</div><h3>{inner(t)}</h3>{render_body(body)}'
            if link: inner_html = f'<a class="card__link" href="{esc(link)}">{inner_html}<span class="card__go">{ARROW_NE}</span></a>'
            cards.append(f'<li class="card spot" data-rise>{inner_html}</li>')
        n = len(cards)
        cols = 'cards--3' if n in (3, 6, 9) or n > 6 else ('cards--2' if n in (2, 4) else 'cards--3')
        return f'<ul class="cards {cols}">' + ''.join(cards) + '</ul>'
    texts = [text(li) for li in items]
    if all(len(t) < 34 for t in texts) and len(items) >= 4:
        return '<ul class="chips">' + ''.join(f'<li data-rise>{esc(t)}</li>' for t in texts) + '</ul>'
    if all(len([k for k in li if isinstance(k.tag, str)]) <= 1 for li in items):
        tag = 'ol' if ul.tag == 'ol' else 'ul'
        return f'<{tag} class="ticks">' + ''.join(f'<li data-rise>{inner(li)}</li>' for li in items) + f'</{tag}>'
    return '<div class="prose" data-rise>' + raw_html(ul) + '</div>'

def render_log_rows(items, dark=True):
    rows = []
    for li in items:
        tm = li.find('.//time')
        spans = [k for k in li if isinstance(k.tag, str) and k.tag != 'time' and text(k)]
        title = text(spans[0]) if spans else ''
        body = ' '.join(text(s) for s in spans[1:])
        low = title.lower()
        tone = 'human' if any(w in low for w in ('rep', 'person', 'took over', 'handed', 'approve', 'staff', 'supervisor', 'manager', 'handler', 'engineer', 'lead ')) else ('done' if any(w in low for w in ('booked', 'sent', 'logged', 'closed', 'resolved', 'done', 'complete', 'confirmed')) else 'agent')
        rows.append(f'<li data-tone="{tone}"><div><b>{esc(title)}</b>{f"<span>{esc(body)}</span>" if body else ""}</div><time>{esc(text(tm))}</time></li>')
    return '<ol class="log__rows" data-log>' + ''.join(rows) + '</ol>'

def render_faq(pairs):
    return '<div class="faq__list" data-rise>' + ''.join(
        f'<details><summary>{esc(q)}</summary>{a if a.startswith("<p") else f"<p>{a}</p>"}</details>' for q, a in pairs) + '</div>'

def raw_html(el):
    """Fallback: the cleaned element itself, links and media rewritten."""
    el = copy.deepcopy(el)
    for a in el.iter('a'): a.set('href', local_href(a.get('href')))
    for m in el.iter('img', 'source', 'video'):
        if m.get('src'): m.set('src', local_src(m.get('src')))
    for b in [x for x in el.iter('button') if x is not el]: b.drop_tree()
    if el.tag == 'button': return ''
    s = etree.tostring(el, encoding='unicode', method='html')
    return s

def media_html(el, cls='clip'):
    vid = el if el.tag == 'video' else el.find('.//video')
    if vid is not None:
        src = vid.get('src') or (vid.find('source').get('src') if vid.find('source') is not None else '')
        cap = el.find('figcaption') if el.tag == 'figure' else None
        return (f'<figure class="{cls} clip--video" data-rise><video data-autoplay muted loop playsinline preload="none" src="{esc(local_src(src))}"></video>'
                + (f'<figcaption>{esc(text(cap))}</figcaption>' if cap is not None else '') + '</figure>')
    img = el if el.tag == 'img' else el.find('.//img')
    if img is not None:
        cap = el.find('figcaption') if el.tag == 'figure' else None
        return (f'<figure class="{cls}"><img data-settle src="{esc(local_src(img.get("src")))}" alt="{esc(img.get("alt"))}" loading="lazy"></figure>'
                + (f'<p class="caption">{esc(text(cap))}</p>' if cap is not None else ''))
    return ''

def render_figure(fig, faqmap):
    side = fig.find('.//li[@data-side]')
    if side is not None:
        cap = fig.find('figcaption')
        return render_list(side.getparent(), faqmap) + (f'<p class="caption">{esc(text(cap))}</p>' if cap is not None else '')
    vids = fig.findall('.//video')
    if len(vids) > 1:
        lists = [u for u in fig.iter('ul', 'ol') if u.find('.//video') is not None]
        if lists: return render_list(lists[0], faqmap)
    if fig.find('.//video') is not None or (fig.find('.//img') is not None and fig.find('.//ol') is None and len(text(fig)) < 160):
        return media_html(fig)
    panels = fig.findall('.//div[@data-panel]')
    region = fig.find('.//div[@role="region"]')
    if panels or region is not None:
        return render_run(fig)
    ol = fig.find('.//ol')
    if ol is not None and ol.find('.//time') is not None:
        items = [li for li in ol if isinstance(li.tag, str)]
        # header: everything before the list that has text
        head_bits = []
        for k in fig:
            if k is ol or (isinstance(k.tag, str) and k.find('.//ol') is not None and ol in k.iter('ol')): break
            if isinstance(k.tag, str) and text(k): head_bits.append(k)
        legend = []
        head_txt = [norm(x) for x in ' | '.join(text(h) for h in head_bits).split(' | ')]
        name = sub = status = ''
        first = head_bits[0] if head_bits else None
        if first is not None:
            leaves = [x for x in first.iter() if isinstance(x.tag, str) and norm(x.text) and x.tag in ('div', 'span', 'strong', 'p', 'b')]
            vals = [norm(x.text).strip('· ').strip() for x in leaves if norm(x.text).strip('· ').strip()]
            if vals: name = vals[0]
            if len(vals) > 1: sub = vals[1]
            if len(vals) > 2: status = vals[-1]
        cap = fig.find('figcaption')
        return (f'<figure class="log" data-beam><div class="log__head"><div><strong>{esc(name)}</strong><span>{esc(sub)}</span></div>'
                + (f'<span class="pill pill--done">{esc(status)}</span>' if status else '') + '</div>'
                + render_log_rows(items)
                + (f'<figcaption class="log__note">{esc(text(cap))}</figcaption>' if cap is not None else '') + '</figure>')
    # Anything else: break the figure into its parts and lay them out in a framed box.
    toks = [t for t in tokens(fig) if not (t[0] == 'span' and len(text(t[1])) < 3)]
    cap = fig.find('figcaption')
    body, media = compose(toks, faqmap, {})
    return ('<figure class="figbox" data-rise>' + ''.join(body) + ''.join(media)
            + (f'<figcaption class="caption">{esc(text(cap))}</figcaption>' if cap is not None and text(cap) not in ''.join(body) else '') + '</figure>')

def panel_info(p):
    """One state of an interactive walkthrough: label, kind, title, body, specs."""
    spans = [s for s in p.iter('span', 'p') if text(s)]
    h = p.find('.//h3') if p.find('.//h3') is not None else p.find('.//h4')
    meta = []
    for s in p:
        if not isinstance(s.tag, str): continue
        if s is h or (h is not None and h in s.iter()): break
        if text(s): meta.append(text(s))
    body = []
    after = False
    for s in p.iter():
        if s is h: after = True; continue
        if after and s.tag == 'p' and text(s) and s.getparent().tag != 'dd': body.append(inner(s))
    dl = p.find('.//dl')
    return {'meta': meta, 'title': text(h), 'body': body, 'dl': render_dl(dl, small=True) if dl is not None else ''}

def kind_tone(label):
    l = label.lower()
    if any(w in l for w in ('person', 'human', 'approv', 'review')): return 'human'
    if any(w in l for w in ('outcome', 'done', 'complete')): return 'done'
    return 'agent'

def render_run(container):
    """A scripted run or step-by-step walkthrough, shown as a scroll-driven timeline."""
    panels = container.findall('.//div[@data-panel]')
    region = container.find('.//div[@role="region"]')
    if region is not None:
        first = [k for k in region if isinstance(k.tag, str) and not k.get('data-panel')]
        panels = first[:1] + panels if first and not panels or (first and first[0] not in panels) else panels
    infos = [panel_info(p) for p in panels if text(p)]
    seen = set(); uniq = []
    for i in infos:
        if i['title'] and i['title'] not in seen: seen.add(i['title']); uniq.append(i)
    rows = []
    for n, i in enumerate(uniq):
        meta = [m for m in i['meta'] if not re.match(r'^Step\b', m)]
        when = next((m for m in meta if re.match(r'^\d\d:\d\d', m)), '')
        kinds = [m for m in meta if m != when]
        if not when and i['body'] and re.match(r'^\d\d:\d\d$', re.sub('<[^>]+>', '', i['body'][0])):
            when = re.sub('<[^>]+>', '', i['body'].pop(0))
        k = kinds[0] if kinds else ''
        rows.append(f'<li class="run__step" data-tone="{kind_tone(k)}"><span class="run__n mono">{when or f"{n+1:02d}"}</span>'
                    f'<div class="run__card">{pill(k) if k else ""}<h3>{esc(i["title"])}</h3>'
                    + ''.join(f'<p>{b}</p>' for b in i['body']) + i['dl'] + '</div></li>')
    cap = container.find('.//figcaption')
    return ('<ol class="run" data-run>' + ''.join(rows) + '</ol>'
            + (f'<p class="caption">{esc(text(cap))}</p>' if cap is not None else ''))

# ---------------------------------------------------------------- sections

def section_id(sec):
    if sec.get('id'): return sec.get('id')
    h = sec.find('.//h2')
    return (h.get('id') if h is not None else None) or ''

def compose(toks, faqmap, ctx):
    """Turn a token run into prototype markup."""
    out = []; i = 0; n = len(toks)
    media = []
    while i < n:
        k = toks[i]; kind = k[0]
        if kind == 'faq':
            pairs = []
            while i < n and toks[i][0] == 'faq':
                q = toks[i][1]; pairs.append((q, esc(faqmap.get(q, '')))); i += 1
            out.append(render_faq(pairs)); continue
        if kind == 'h' and k[1] in ('h3', 'h4'):
            # Cards made of loose heading + text runs, optionally numbered by a preceding span.
            cards = []
            while i < n and toks[i][0] == 'h' and toks[i][1] in ('h3', 'h4'):
                h = toks[i][2]; i += 1; body = []; tag = None
                while i < n and toks[i][0] in ('p', 'span', 'dl', 'list', 'a', 'strong') and not (toks[i][0] == 'span' and re.match(r'^\d{1,2}$', text(toks[i][1])) and i + 1 < n and toks[i+1][0] == 'h'):
                    t = toks[i]
                    if t[0] == 'span' and len(text(t[1])) <= 18 and tag is None and not body: tag = text(t[1])
                    elif t[0] == 'dl': body.append(render_dl(t[1], small=True))
                    elif t[0] == 'list': body.append(render_list(t[1], faqmap))
                    elif t[0] == 'a': body.append(f'<a class="link" href="{esc(local_href(t[1].get("href")))}">{esc(text(t[1]))} {ARROW}</a>')
                    else: body.append(f'<p>{inner(t[1])}</p>')
                    i += 1
                num = ctx.pop('num', None)
                top = pill(tag) if tag else (f'<span class="card__n mono">{esc(num)}</span>' if num and not re.match(r'^\d{1,2}\s*/', text(h)) else '')
                cards.append(f'<li class="card spot" data-rise>{f"<div class=card__top>{top}</div>" if top else ""}<h3>{heading_html(h)}</h3>{"".join(body)}</li>')
                if i < n and toks[i][0] == 'span' and re.match(r'^\d{1,2}$', text(toks[i][1])):
                    ctx['num'] = text(toks[i][1]).zfill(2); i += 1
            cols = 'cards--2' if len(cards) in (2, 4) else 'cards--3'
            if len(cards) == 1: cols = 'cards--1'
            out.append(f'<ul class="cards {cols}">' + ''.join(cards) + '</ul>'); continue
        if kind == 'span' and re.match(r'^\d{1,2}$', text(k[1])) and i + 1 < n and toks[i+1][0] == 'h':
            ctx['num'] = text(k[1]).zfill(2); i += 1; continue
        if kind == 'span' and re.match(r'^\d{1,2}$', text(k[1])) and i + 1 < n and toks[i+1][0] == 'p':
            # numbered prompts (yes/no finder): collect
            qs = []
            while i + 1 < n and toks[i][0] == 'span' and re.match(r'^\d{1,2}$', text(toks[i][1])) and toks[i+1][0] == 'p':
                qs.append((text(toks[i][1]), inner(toks[i+1][1]))); i += 2
            out.append('<ol class="qlist">' + ''.join(f'<li data-rise><span class="mono">{q[0].zfill(2)}</span><p>{q[1]}</p></li>' for q in qs) + '</ol>'); continue
        if kind == 'strong':
            rows = []
            while i < n and toks[i][0] == 'strong':
                t = inner(toks[i][1]); i += 1; d = []; tag = None
                while i < n and toks[i][0] == 'span':
                    s = text(toks[i][1])
                    if len(s) <= 18 and tag is None and not d: tag = s
                    else: d.append(inner(toks[i][1]))
                    i += 1
                rows.append(f'<div data-rise><dt>{t}{" " + pill(tag) if tag else ""}</dt><dd>{" ".join(d)}</dd></div>')
            out.append('<dl class="facts">' + ''.join(rows) + '</dl>'); continue
        if kind == 'p' and len(text(k[1])) < 40 and not text(k[1]).endswith('.') and i + 1 < n and toks[i+1][0] == 'list':
            out.append(f'<p class="label mono">{esc(text(k[1]))}</p>'); i += 1; continue
        if kind == 'p':
            out.append(f'<p class="para" data-rise>{inner(k[1])}</p>'); i += 1; continue
        if kind == 'span':
            out.append(f'<p class="para para--note" data-rise>{inner(k[1])}</p>'); i += 1; continue
        if kind == 'h':
            lvl = k[1]
            out.append(f'<h3 class="subhead" data-split>{heading_html(k[2])}</h3>' if lvl in ('h2',) else f'<h4 class="minihead">{heading_html(k[2])}</h4>'); i += 1; continue
        if kind == 'list':
            out.append(render_list(k[1], faqmap)); i += 1; continue
        if kind == 'dl':
            out.append(render_dl(k[1])); i += 1; continue
        if kind == 'figure':
            f = render_figure(k[1], faqmap)
            if 'clip' in f[:40]: media.append(f)
            else: out.append(f)
            i += 1; continue
        if kind == 'media':
            media.append(media_html(k[1])); i += 1; continue
        if kind == 'a':
            links = []
            while i < n and toks[i][0] == 'a':
                a = toks[i][1]; href = local_href(a.get('href')); label = text(a)
                primary = 'demo' in href or label.lower().startswith(('book', 'start', 'talk', 'request', 'get'))
                links.append(f'<a class="btn {"btn--dark" if primary else "btn--line"}" href="{esc(href)}">{esc(label)} {ARROW}</a>' if primary
                             else f'<a class="link" href="{esc(href)}">{esc(label)} {ARROW}</a>')
                i += 1
            out.append('<div class="actions" data-rise>' + ''.join(links) + '</div>'); continue
        if kind in ('panels', 'panel'):
            j = i
            group = [toks[j][1]]
            j += 1
            while j < n and toks[j][0] == 'panel': group.append(toks[j][1]); j += 1
            wrap = H.Element('div')
            for g in group: wrap.append(copy.deepcopy(g))
            out.append(render_run(wrap)); i = j; continue
        if kind == 'table':
            out.append('<div class="tablewrap" data-rise>' + raw_html(k[1]) + '</div>'); i += 1; continue
        if kind == 'article':
            out.append(render_article(k[1])); i += 1; continue
        if kind == 'form':
            out.append(render_form(k[1], ctx)); i += 1; continue
        if kind == 'quote':
            out.append(f'<blockquote class="quote" data-rise>{inner(k[1])}</blockquote>'); i += 1; continue
        if kind == 'details':
            out.append(render_faq([(text(k[1].find('summary')), inner(k[1]))])); i += 1; continue
        if kind == 'nav':
            i += 1; continue
        i += 1
    return out, media

def render_article(art):
    """Long-form text with its own contents list."""
    toc = []; parts = []
    for c in art:
        if not isinstance(c.tag, str): continue
        if c.tag == 'h2':
            sid = re.sub(r'[^a-z0-9]+', '-', text(c).lower()).strip('-')[:48]
            toc.append(f'<li><a href="#{sid}">{esc(text(c))}</a></li>')
            parts.append(f'<h2 id="{sid}" data-split>{heading_html(c)}</h2>')
        elif c.tag in ('h3', 'h4'):
            parts.append(f'<h3>{heading_html(c)}</h3>')
        elif c.tag == 'p':
            # a trailing link inside a paragraph is a call to read on
            links = c.findall('a')
            if links and norm(c.text_content()).endswith(text(links[-1])) and len(text(links[-1])) > 12 and links[-1].tail is None:
                a = links[-1]; href = local_href(a.get('href')); label = text(a); a.drop_tree()
                parts.append(f'<p>{inner(c)}</p><p><a class="link" href="{esc(href)}">{esc(label)} {ARROW}</a></p>')
            else:
                parts.append(f'<p>{inner(c)}</p>')
        elif c.tag in ('ul', 'ol'):
            parts.append(f'<{c.tag}>' + ''.join(f'<li>{inner(li)}</li>' for li in c if isinstance(li.tag, str)) + f'</{c.tag}>')
        elif c.tag == 'table':
            parts.append('<div class="tablewrap">' + raw_html(c) + '</div>')
        elif c.tag == 'blockquote':
            parts.append(f'<blockquote>{inner(c)}</blockquote>')
        elif c.tag == 'figure':
            parts.append(render_figure(c, {}))
        elif c.tag == 'pre':
            parts.append(f'<pre>{esc(c.text_content())}</pre>')
        elif text(c):
            parts.append(raw_html(c))
    aside = (f'<aside class="toc"><p class="mono">On this page</p><ol>{"".join(toc)}</ol><div class="toc__bar"><i></i></div></aside>' if len(toc) > 2 else '')
    return f'<div class="article{" article--toc" if aside else ""}">{aside}<div class="prose prose--long" data-progress>{"".join(parts)}</div></div>'

def render_form(form, ctx):
    """Rebuild a form from its labels and controls, in the prototype's form style."""
    ctx['has_form'] = True
    fields = []; title = ''
    h = form.find('.//h2') if form.find('.//h2') is not None else form.find('.//h3')
    if h is not None: title = text(h)
    for lab in form.iter('label', 'legend'):
        lt = text(lab)
        if not lt: continue
        grp = lab.getparent()
        opts = [text(x) for x in grp.iter('label') if x is not lab and text(x)] if grp.get('role') == 'radiogroup' else []
        nxt = lab.getnext()
        if nxt is not None and nxt.get('role') == 'radiogroup':
            opts = [text(x) for x in nxt.iter('label') if text(x)]
        if lab.getparent().get('role') == 'radiogroup': continue
        name = re.sub(r'[^a-z]+', '-', lt.lower()).strip('-')[:24]
        if opts:
            fields.append(f'<fieldset class="form__services"><legend>{esc(lt)}</legend><div class="form__chips">' + ''.join(f'<label><input type="radio" name="{name}" value="{esc(o)}"><span>{esc(o)}</span></label>' for o in opts) + '</div></fieldset>')
            continue
        ctrl = nxt if nxt is not None and nxt.tag in ('input', 'textarea', 'select') else lab.find('.//input')
        if ctrl is None:
            sib = lab.getparent().find('textarea') if lab.getparent() is not None else None
            ctrl = sib
        optional = 'optional' in lt.lower()
        req = '' if optional else ' required'
        if ctrl is not None and ctrl.tag == 'textarea' or 'should' in lt.lower() or 'message' in lt.lower() or 'anything' in lt.lower():
            fields.append(f'<label>{esc(lt)} <textarea name="{name}" rows="3"></textarea></label>')
        else:
            typ = 'email' if 'email' in lt.lower() else 'text'
            fields.append(f'<label>{esc(lt)} <input name="{name}" type="{typ}"{req}></label>')
    btn = form.find('.//button')
    btxt = text(btn) if btn is not None and text(btn) else 'Send'
    small = form.find('.//small')
    return (f'<form class="sform" data-beam novalidate>{f"<h3>{esc(title)}</h3>" if title else ""}' + ''.join(fields)
            + f'<button class="btn btn--dark" data-shimmer type="submit">{esc(btxt)} {ARROW}</button><p class="form__msg" role="status"></p>'
            + (f'<p class="caption">{inner(small)}</p>' if small is not None else '') + '</form>')

SECTION_SPECIAL = {}
def render_section(sec, faqmap, idx, ctx):
    sid = section_id(sec)
    toks = tokens(sec)
    if not toks: return ''
    # Closing call to action band
    if not any(t[0] == 'h' for t in toks) and any(t[0] == 'a' for t in toks) and len(toks) <= 4:
        ps = [t[1] for t in toks if t[0] == 'p']; links = [t[1] for t in toks if t[0] == 'a']
        title = inner(ps[0]) if ps else 'See it on your own data'
        note = ''.join(f'<p class="cta__note">{inner(p)}</p>' for p in ps[1:])
        btns = ''.join(f'<a class="btn btn--light" data-shimmer href="{esc(local_href(a.get("href")))}">{esc(text(a))} {ARROW}</a>' for a in links)
        return (f'<section class="cta" data-nav="dark"><div class="wrap cta__inner"><h2 class="cta__title" data-split>{title}</h2>'
                f'<div class="btns" data-rise>{btns}<a class="btn btn--ghost" href="pilot-fit.html">Check pilot fit {ARROW}</a></div>{note}</div></section>')
    # Head: first h2 and the paragraphs that directly follow it
    head = ''
    n_h2 = sum(1 for t in toks if t[0] == 'h' and t[1] == 'h2')
    if toks[0][0] == 'h' and toks[0][1] == 'h2' and n_h2 < 3:
        h = toks[0][2]; toks = toks[1:]
        leads = []
        while toks and toks[0][0] == 'p' and len(leads) < 2:
            leads.append(toks.pop(0)[1])
        head_cls = 'sec__head'
        head = (f'<div class="{head_cls}"><h2 class="h2" data-split>{heading_html(h)}</h2>'
                + ''.join(f'<p class="lead" data-rise>{inner(p)}</p>' for p in leads) + '</div>')
        title_txt = htext(h)
        # A single question answered in one paragraph reads as a statement: use the scroll text reveal.
        if is_question(title_txt) and not toks and leads and len(text(leads[0])) > 120:
            return (f'<section class="answer" id="{esc(sid)}" data-nav="light"><div class="answer__sticky"><div class="wrap">'
                    f'<p class="eyebrow">{esc(title_txt)}</p><p class="answer__text">{inner(leads[0])}</p></div></div></section>')
    if sid in SECTION_SPECIAL:
        return SECTION_SPECIAL[sid](sec, head, toks, faqmap, ctx)
    h2s = [t for t in toks if t[0] == 'h' and t[1] == 'h2']
    if len(h2s) >= 3:
        chapters = []; cur = None
        for t in toks:
            if t[0] == 'h' and t[1] == 'h2':
                cur = [t[2], []]; chapters.append(cur)
            elif cur is not None: cur[1].append(t)
        cards = []
        for n, (h, ts) in enumerate(chapters):
            b, m = compose(ts, faqmap, ctx)
            cards.append(f'<article class="chapter" style="--i:{n}"><div class="chapter__top"><span class="mono">{n+1:02d} / {len(chapters):02d}</span></div>'
                         f'<h2 class="chapter__title">{heading_html(h)}</h2><div class="chapter__body">{"".join(b)}{"".join(m)}</div></article>')
        return f'<section class="sec chapters" id="{esc(sid)}" data-nav="light"><div class="wrap"><div class="chapters__list">{"".join(cards)}</div></div></section>'
    body, media = compose(toks, faqmap, ctx)
    ink = any(w in sid for w in ('process', 'demo', 'alerts', 'replay', 'lifecycle', 'rollout', 'record', 'video-ai-videos')) or 'data-run' in ''.join(body) or 'class="log"' in ''.join(body)
    if 'faq__list' in ''.join(body) and head:
        content = f'<div class="wrap faq">{head}<div>{"".join(body)}</div></div>'
    elif media:
        content = f'<div class="wrap split"><div class="split__text">{head}{"".join(body)}</div><div class="split__media">{"".join(media)}</div></div>'
    elif 'class="run"' in ''.join(body):
        content = f'<div class="wrap runwrap"><div class="runwrap__head">{head}</div><div>{"".join(body)}</div></div>'
    elif 'class="log"' in ''.join(body):
        content = f'<div class="wrap split split--log"><div class="split__text">{head}</div><div>{"".join(body)}</div></div>'
    else:
        content = f'<div class="wrap">{head}<div class="sec__body">{"".join(body)}</div></div>'
    tone = 'dark' if ink else 'light'
    cls = 'sec sec--ink' if ink else 'sec'
    if idx % 2 == 0 and not ink: cls += ' sec--line'
    return f'<section class="{cls}" id="{esc(sid)}" data-nav="{tone}">{content}</section>'

def render_hero(sec, page):
    img = sec.find('.//img')
    nav = sec.find('.//nav')
    h1 = sec.find('.//h1')
    crumbs = ''
    if nav is not None:
        items = []
        for x in nav.iter('a', 'span'):
            if x.tag == 'span' and x.getparent().tag == 'a': continue
            if x.tag == 'a': items.append(f'<a href="{esc(local_href(x.get("href")))}">{esc(text(x))}</a>')
            elif text(x): items.append(f'<span aria-current="page">{esc(text(x))}</span>')
        crumbs = '<nav class="crumbs" aria-label="Breadcrumb">' + '<i>/</i>'.join(items) + '</nav>'
    ps = [p for p in sec.iter('p') if text(p) and (nav is None or nav not in p.iterancestors())]
    links = [a for a in sec.iter('a') if (nav is None or nav not in a.iterancestors()) and not any(p in a.iterancestors() for p in ps)]
    leads = ''.join(f'<p class="phero__lead">{inner(p)}</p>' for p in ps)
    btns = ''.join(
        f'<a class="btn {"btn--light" if i == 0 else "btn--ghost"}"{" data-shimmer" if i == 0 else ""} href="{esc(local_href(a.get("href")))}">{esc(text(a))} {ARROW}</a>'
        for i, a in enumerate(links))
    if img is None:
        return (f'<section class="phero phero--plain" id="top" data-nav="light"><div class="wrap phero__plain">{crumbs}'
                f'<h1 class="phero__title" id="page-title">{heading_html(h1)}</h1>{leads}{f"<div class=btns>{btns}</div>" if btns else ""}</div></section>')
    return (f'<section class="phero" id="top" data-nav="dark"><div class="phero__stage">'
            f'<div class="phero__media"><img src="{esc(local_src(img.get("src")))}" alt="{esc(img.get("alt"))}" fetchpriority="high"></div><div class="phero__shade" aria-hidden="true"></div>'
            f'<div class="wrap phero__copy">{crumbs}<h1 class="phero__title" id="page-title">{heading_html(h1)}</h1>{leads}{f"<div class=btns>{btns}</div>" if btns else ""}</div>'
            f'<div class="phero__cue mono" aria-hidden="true">Scroll</div></div></section>')

# ---------------------------------------------------------------- chrome from the existing homepage

proto_index = open(os.path.join(OUT, 'index.html')).read()
def grab(pattern):
    m = re.search(pattern, proto_index, re.S); return m.group(0)
NAV = grab(r'<header class="nav".*?</header>')
FOOT = grab(r'<footer class="foot".*?</footer>')
SPRITE = grab(r'<svg width="0" height="0".*?</svg>')

def localise_chrome(s, home):
    s = re.sub(r'href="(https://applyd\.ai[^"]*)"', lambda m: f'href="{local_href(m.group(1))}"', s)
    if not home:
        s = s.replace('href="#top" aria-label="applyd.ai home"', 'href="index.html" aria-label="applyd.ai home"')
        s = s.replace('href="#company"', 'href="index.html#company"').replace('href="#demo"', 'href="demo.html"')
    return s

def page_shell(route, title, desc, body, nav_tone='dark', extra_class=''):
    home = route == '/'
    nav = localise_chrome(NAV, home).replace('data-tone="light"', f'data-tone="{nav_tone}"')
    cur = fname(route)
    nav = nav.replace(f'href="{cur}"', f'href="{cur}" aria-current="page"', 1) if not home else nav
    foot = localise_chrome(FOOT, home)
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(desc)}">
  <link rel="icon" href="../assets/icon.svg" type="image/svg+xml">
  <link rel="preload" href="../assets/fonts/hanken.woff2" as="font" type="font/woff2" crossorigin>
  <script>
    if (matchMedia('(prefers-reduced-motion: no-preference)').matches) document.documentElement.classList.add('motion');
  </script>
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="magic.css">
  <link rel="stylesheet" href="services.css">
  <link rel="stylesheet" href="pages.css">
</head>
<body class="sub {extra_class}">
{SPRITE}

<a class="skip" href="#main">Skip to content</a>

{nav}

<main id="main">
{body}
</main>

{foot}

<script src="../vendor/gsap.min.js" defer></script>
<script src="../vendor/ScrollTrigger.min.js" defer></script>
<script src="../vendor/SplitText.min.js" defer></script>
<script src="../vendor/lenis.min.js" defer></script>
<script src="main.js" defer></script>
<script src="magic.js" defer></script>
<script src="tools.js" defer></script>
</body>
</html>
'''

def faq_map(doc):
    out = {}
    for s in doc.iter('script'):
        if s.get('type') != 'application/ld+json': continue
        try: data = json.loads(s.text or '')
        except Exception: continue
        stack = [data]
        while stack:
            d = stack.pop()
            if isinstance(d, list): stack.extend(d); continue
            if not isinstance(d, dict): continue
            if d.get('@type') == 'Question':
                a = d.get('acceptedAnswer') or {}
                out[norm(d.get('name'))] = norm(a.get('text') if isinstance(a, dict) else '')
            stack.extend(v for v in d.values() if isinstance(v, (list, dict)))
    return out

import specials
SPECIAL, SECTION_SPECIAL = specials.register(globals())

report = []
for route in ROUTES:
    if route == '/': continue  # the homepage is the hand-built prototype
    doc = H.parse(raw_file(route)).getroot()
    title = norm(doc.findtext('.//title'))
    md = doc.find('.//meta[@name="description"]')
    desc = md.get('content') if md is not None else ''
    fm = faq_map(doc)
    main = clean(doc.find('.//main'))
    ctx = {'route': route}
    if route in SPECIAL:
        body = SPECIAL[route](doc, main, ctx)
    else:
        parts = []; idx = 0
        secs = [s for s in main if isinstance(s.tag, str)]
        for s in secs:
            if s.tag == 'section' and s.get('id') == 'page-hero':
                parts.append(render_hero(s, route)); continue
            if s.tag == 'section' and s.find('.//h1') is not None and idx == 0 and not parts:
                # legal pages: the first section is a plain title
                parts.append(render_hero(s, route)); continue
            if s.tag == 'article':
                parts.append(f'<section class="sec" data-nav="light"><div class="wrap">{render_article(s)}</div></section>'); continue
            if s.tag != 'section': continue
            html_s = render_section(s, fm, idx, ctx)
            if html_s: parts.append(html_s); idx += 1
        hero = parts[0] if parts and 'phero' in parts[0][:40] else ''
        rest = parts[1:] if hero else parts
        body = hero + '\n<div class="flow flow--sub">\n' + '\n'.join(rest) + '\n</div>'
    if 'id="request"' in open(raw_file(route)).read() and 'id="request"' not in body:
        body = body.replace('<form class="sform"', '<form class="sform" id="request"', 1)
    tone = 'light' if 'phero--plain' in body[:200] else 'dark'
    page = page_shell(route, title, desc, body, nav_tone=tone)
    open(os.path.join(OUT, fname(route)), 'w').write(page)
    report.append((route, fname(route), len(page), body.count('class="prose" data-rise')))

for r in report: print(f'{r[1]:45} {r[2]:7}  fallback-blocks={r[3]}')
print(len(report), 'pages')
