# Inner-page generator

Builds the 50 inner pages in `prototype-services/` from the live applyd.ai HTML saved in `raw/`
(downloaded 2026-11-10). The homepage (`prototype-services/index.html`) is hand-built and is not touched.

    cd tools/site-build
    python3 -P build.py raw ../../prototype-services

- `clean.py` strips the live markup to semantic HTML (keeps hidden walkthrough steps, chat sides).
- `build.py` maps each section to prototype components and writes `<route>.html` (e.g. `/ai/video-ai` -> `ai-video-ai.html`).
- `specials.py` holds the tool pages and sections: pilot fit check, approach finder, sensor demo, demo page.

Styling for these pages is in `prototype-services/pages.css`; scroll scenes are `subScenes()` in `main.js`;
tool behaviour is in `tools.js`. To refresh content, re-download the pages into `raw/` and rerun.
Requires Python 3 with lxml.
