import sys, re, lxml.html as H
from lxml import etree
KEEP={'section','article','div','h1','h2','h3','h4','h5','p','ul','ol','li','dl','dt','dd','table','thead','tbody','tr','th','td','a','strong','em','b','i','img','video','source','details','summary','blockquote','figure','figcaption','nav','form','label','input','select','option','textarea','button','fieldset','legend','span','time','code','br','header','aside','picture','small','sup','cite','mark'}
ATTR={'li':['data-side'],'a':['href'],'img':['src','alt'],'video':['src','poster'],'source':['src','srcset','type'],'input':['type','name','value','placeholder'],'section':['id'],'div':['data-panel','role'],'h2':['id'],'h1':['id'],'select':['name'],'option':['value'],'textarea':['name','placeholder'],'label':[],'td':['colspan'],'th':['colspan']}
def clean(el):
    for e in list(el.iter()):
        if not isinstance(e.tag,str): 
            e.getparent().remove(e) if e.getparent() is not None else None; continue
    for e in list(el.iter()):
        if e is el: continue
        c=e.get('class') or ''
        txt=' '.join(e.text_content().split()) if isinstance(e.tag,str) else ''
        panel = 'invisible' in c.split() and len(txt)>40
        if e.tag in ('svg','script','style','noscript','template','canvas','path') or (e.get('aria-hidden')=='true' and not panel) or e.get('hidden') is not None:
            e.drop_tree(); continue
        if txt.startswith('Still to come'):
            e.drop_tree(); continue
        if panel: e.set('data-panel','1')
        if e.tag=='li' and 'justify-self-end' in c.split(): e.set('data-side','visitor')
        elif e.tag=='li' and 'justify-self-start' in c.split(): e.set('data-side','agent')
        if 'sr-only' in c.split(): e.drop_tree(); continue
    for e in list(el.iter()):
        if not isinstance(e.tag,str): continue
        if e is el: continue
        if e.tag not in KEEP: e.drop_tag(); continue
        keep=ATTR.get(e.tag,[])
        for k in list(e.attrib):
            if k not in keep: del e.attrib[k]
    # unwrap meaningless divs/spans
    changed=True
    while changed:
        changed=False
        for e in list(el.iter('div','span')):
            if e is el: continue
            if not e.attrib and (len(e)==1 and not (e.text or '').strip() and not (e[0].tail or '').strip()):
                e.drop_tag(); changed=True
    return el
if __name__=='__main__':
    doc=H.parse(sys.argv[1]).getroot(); m=doc.find('.//main')
    clean(m)
    s=etree.tostring(m,encoding='unicode',pretty_print=True)
    print(s)
