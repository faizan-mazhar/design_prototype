"""Pages and sections that are tools on the live site. Content is the live site's;
behaviour is reimplemented in prototype-services/tools.js."""
import re


def register(g):
    esc, text, inner, ARROW = g['esc'], g['text'], g['inner'], g['ARROW']
    heading_html, local_href, local_src = g['heading_html'], g['local_href'], g['local_src']

    def split_head(head):
        return head or ''

    # ------------------------------------------------ consulting: approach finder
    FINDER = [
        ('data', 'Does it need your own documents or records to answer well?', 'Policies, product data, contracts, tickets.'),
        ('act', 'Should it take actions in other systems?', 'Update a record, send an email, raise an order.'),
        ('create', 'Is the main job creating content?', 'Copy, images, reports or documents.'),
        ('talk', 'Will customers or staff talk to it in a conversation?', 'Chat on your site, in an app or on a messaging channel.'),
        ('examples', 'Is it a narrow, repetitive task with thousands of labelled examples?', 'A specific style or format learned from past data.'),
    ]

    def finder(sec, head, toks, faqmap, ctx):
        qs = ''.join(
            f'<fieldset data-q="{k}"><legend><span class="mono">{n+1}/{len(FINDER)}</span>{esc(q)}</legend><p class="quiz__hint">{esc(h)}</p>'
            f'<div class="opts"><label class="opt"><input type="radio" name="f-{k}" value="yes"><span>Yes</span></label>'
            f'<label class="opt"><input type="radio" name="f-{k}" value="no"><span>No</span></label></div></fieldset>'
            for n, (k, q, h) in enumerate(FINDER))
        return (f'<section class="sec" id="approach-demo" data-nav="light"><div class="wrap">{head}'
                f'<div class="tool" data-finder><form class="quiz" onsubmit="return false">{qs}'
                f'<div class="actions" style="padding-top:20px"><button class="btn btn--line" type="reset">Clear answers</button></div></form>'
                f'<aside class="tool__result" aria-live="polite"><p class="eyebrow">Your suggestion</p><div class="tool__progress"><i></i></div>'
                f'<h3 data-title>Answer all five questions</h3><p data-why>Answer all five questions to see the approach that usually fits first.</p>'
                f'<p class="mono" data-pattern></p><ul data-also></ul><a class="btn btn--light" data-go href="ai.html" hidden>Read how we build it {ARROW}</a>'
                f'<p class="tool__note">Illustrative demo. Scripted, not a live system.</p></aside></div></div></section>')

    # ------------------------------------------------ physical AI: sensor demo
    def sensor(sec, head, toks, faqmap, ctx):
        return (f'<section class="sec sec--ink" id="sensor-demo" data-nav="dark"><div class="wrap">{head}'
                f'<div class="sensor" data-sensor>'
                f'<div class="sensor__assets" role="group" aria-label="Asset"><button type="button" data-asset="pump" aria-pressed="true">Process pump</button>'
                f'<button type="button" data-asset="compressor" aria-pressed="false">Compressor</button><button type="button" data-asset="exchanger" aria-pressed="false">Heat exchanger</button>'
                f'<button type="button" data-asset="motor" aria-pressed="false">Drive motor</button></div>'
                f'<div class="sensor__grid"><div class="sensor__main"><div class="sensor__head"><h3 data-title>P-204 · Process pump</h3><p class="sensor__status" data-stream role="status">Sensor stream running</p></div>'
                f'<div class="sensor__signals" data-signals></div>'
                f'<p class="caption">Solid line: observed signal. Dashed line: operating baseline. Latest readings at right.</p></div>'
                f'<div class="sensor__insight"><p class="sensor__status" data-state role="status">Normal operating pattern</p><h4 data-diag>Measurements follow the baseline.</h4>'
                f'<p data-copy>Run a developing-fault example to see how the signals change together.</p><ul class="mini" data-evidence></ul>'
                f'<fieldset class="sensor__notify"><legend class="mono">Notify maintenance through</legend><div class="opts">'
                + ''.join(f'<label class="opt opt--dark"><input type="radio" name="notify" value="{c}"{" checked" if i == 0 else ""}><span>{c}</span></label>' for i, c in enumerate(['Email', 'Slack', 'Push notification']))
                + f'</div></fieldset><p class="caption" data-sent>No alert in this example.</p></div></div>'
                f'<div class="sensor__ctrl"><button type="button" data-pause>Pause</button><button type="button" data-reset>Reset</button><button type="button" class="is-primary" data-fault>Simulate developing fault</button></div>'
                f'<p class="caption">Interactive capability demonstration. All readings, anomalies, diagnoses and notifications are simulated. Real analysis depends on equipment, instrumentation, data quality and operating context.</p>'
                f'</div></div></section>')

    # ------------------------------------------------ pilot fit check
    PILOT = [
        ('volume', 'How many inbound leads do you get each month?', [('low', 'Under 100'), ('mid', '100 to 500'), ('high', '500 to 2,000'), ('vhigh', 'More than 2,000')]),
        ('speed', 'How quickly does a new lead usually get a first reply?', [('fast', 'Within 5 minutes'), ('hour', 'Within an hour'), ('day', 'Within a day'), ('slow', 'More than a day, or it varies')]),
        ('channels', 'Which channels do leads come through?', [('one', 'Mostly one, such as web forms'), ('email', 'Web forms and email'), ('multi', 'Several, including SMS, WhatsApp or chat')]),
        ('crm', 'Do you have a CRM in place?', [('yes', 'Yes'), ('no', 'No')]),
        ('owner', 'Who follows up with new leads today?', [('sdr', 'A dedicated SDR team'), ('reps', 'Sales reps, alongside other work'), ('marketing', 'Marketing'), ('nobody', 'No one consistently')]),
        ('rules', 'Are your rules for pricing and contract questions written down?', [('yes', 'Yes'), ('partly', 'Partly'), ('no', 'No')]),
    ]

    def pilot_tool():
        qs = ''.join(
            f'<fieldset data-q="{k}"><legend><span class="mono">{n+1:02d}</span>{esc(q)}</legend><div class="opts">'
            + ''.join(f'<label class="opt"><input type="radio" name="p-{k}" value="{v}"><span>{esc(l)}</span></label>' for v, l in opts)
            + '</div></fieldset>' for n, (k, q, opts) in enumerate(PILOT))
        stages = ''.join(f'<span data-stage="{k}">{l}</span>' for k, l in [('capture', 'Capture'), ('qualify', 'Qualify'), ('engage', 'Follow up'), ('book', 'Book'), ('sync', 'Sync')])
        return (f'<section class="sec" id="check" data-nav="light"><div class="wrap"><div class="tool" data-pilot>'
                f'<form class="quiz" onsubmit="return false">{qs}</form>'
                f'<aside class="tool__result" aria-live="polite"><p class="eyebrow">Your starting point</p><div class="tool__progress"><i></i></div>'
                f'<div class="tool__stages">{stages}</div><h3 data-title>Six questions to go</h3>'
                f'<p data-empty>Answer all six questions and your suggested starting point appears here.</p><ul data-reasons></ul><ul data-notes></ul>'
                f'<a class="btn btn--light" data-go href="demo.html" hidden>Book a demo with this {ARROW}</a>'
                f'<p class="tool__note">A starting point for the demo conversation, not a guarantee. Nothing leaves your browser until you send the demo form.</p></aside>'
                f'</div></div></section>')

    def page_pilot(doc, main, ctx):
        parts = []
        for s in [x for x in main if isinstance(x.tag, str) and x.tag == 'section']:
            if s.get('id') == 'page-hero': parts.append(g['render_hero'](s, ctx['route'])); continue
            if s.find('.//form') is not None: parts.append(pilot_tool()); continue
            parts.append(g['render_section'](s, {}, len(parts), ctx))
        return parts[0] + '\n<div class="flow flow--sub">\n' + '\n'.join(parts[1:]) + '\n</div>'

    # ------------------------------------------------ demo page
    SERVICES = ['Physical AI', 'Video AI', 'AI Agents', 'OT Security', 'AI Development', 'Not sure yet']

    def page_demo(doc, main, ctx):
        sec = main.find('.//section')
        h1 = sec.find('.//h1'); img = sec.find('.//img')
        ps = [p for p in sec.iter('p') if text(p) and p.getparent().tag != 'form' and not any(a.tag == 'form' for a in p.iterancestors())]
        ticks = [text(s) for s in sec.iter('span') if text(s) and len(text(s)) > 20 and not any(a.tag == 'form' for a in s.iterancestors()) and s.getparent().tag != 'p']
        lead = ''.join(f'<p class="lead" data-rise>{inner(p)}</p>' for p in ps)
        chips = ''.join(f'<label><input type="radio" name="service" value="{esc(v)}"><span>{esc(v)}</span></label>' for v in SERVICES)
        return (f'<div class="flow flow--sub flow--top"><section class="sec sec--ink demo-page" id="demo" data-nav="dark"><div class="wrap demo">'
                f'<div><h1 class="h2 demo__title" data-split>{heading_html(h1)}</h1>{lead}'
                f'<ul class="ticks">' + ''.join(f'<li data-rise>{esc(t)}</li>' for t in ticks) + '</ul>'
                + (f'<figure class="clip clip--demo"><img data-settle src="{esc(local_src(img.get("src")))}" alt="{esc(img.get("alt"))}"></figure>' if img is not None else '')
                + f'</div><form class="form" data-beam novalidate><h3>Your details</h3>'
                f'<fieldset class="form__services"><legend>What do you want to see?</legend><div class="form__chips">{chips}</div></fieldset>'
                f'<label>Full name <input name="name" autocomplete="name" required></label>'
                f'<div class="form__two"><label>Work email <input name="email" type="email" autocomplete="email" required></label>'
                f'<label>Company <input name="company" autocomplete="organization" required></label></div>'
                f'<label>What should we look at first? (optional) <textarea name="message" rows="3"></textarea></label>'
                f'<button class="btn btn--light" data-shimmer type="submit">Book a demo {ARROW}</button><p class="form__msg" role="status"></p>'
                f'<p class="form__privacy">We use these details only to arrange your demo. <a href="privacy.html">Privacy policy</a></p></form>'
                f'</div></section></div>')

    pages = {'/pilot-fit': page_pilot, '/demo': page_demo}
    sections = {'approach-demo': finder, 'sensor-demo': sensor}
    return pages, sections
