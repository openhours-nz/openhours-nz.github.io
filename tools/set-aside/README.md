# The Set-Aside Calculator

"How much should I put aside?" — six questions, a real number, for New Zealand sole traders and contractors.
Tax year 2026–27. Rules and sources: income tax and provisional tax from Inland Revenue; ACC rates from the
ACC Levy Guidebook 2026/27. Every rate is a named constant at the top of `set-aside.js`.

## Files
- `set-aside.js` — the arithmetic (`compute()`), the markup, the wiring, the email step. Loads the CSS itself.
- `set-aside.css` — scoped under `.oh-tool`; takes the host site's colours if it has tokens, sensible defaults if not.
- `index.html` — the tool on its own page. This is what gets framed into a client's site.

## Install on any site — two lines
```html
<div data-tool="set-aside" data-endpoint=""></div>
<script src="https://openhours-nz.github.io/tools/set-aside/set-aside.js" defer></script>
```
- `data-endpoint` — the n8n webhook URL that receives "email me this breakdown". Empty = the tool works, the email step says it isn't connected.
- `data-intro="off"` — hide the tool's own heading and intro line when the page already introduces it.
- Colours: set custom properties on the div, e.g. `style="--oh-accent:#0B5; --oh-accent-bg:#0B5; --oh-on-accent:#fff"`.
  Available: `--oh-bg --oh-fg --oh-muted --oh-accent --oh-accent-bg --oh-on-accent --oh-line --oh-radius`.
- The font is inherited from the page.

## Install as an iframe (Wix "Embed HTML", or anywhere scripts aren't allowed)
```html
<iframe src="https://openhours-nz.github.io/tools/set-aside/" style="width:100%;border:0" title="How much should I put aside?"></iframe>
<script>addEventListener('message', e => { if (e.data && e.data.ohTool === 'set-aside') document.querySelector('iframe[src*="set-aside"]').style.height = e.data.height + 'px'; });</script>
```
The framed page posts its height whenever it changes.

## What "email me this breakdown" sends (JSON, POST)
`{ tool, name, email, accountant, inputs: { income, expenses, other, gst, work, cu, firstYear }, results: { businessTax, acc, total, perMonth, perInvoice, provisional, provEach, crunch }, taxYear, page, sent }` — plus `website`, a honeypot that must be empty.

## Test case
Sam, a plumber: income $90,000, expenses $25,000, other $0, GST yes, first year yes →
income tax $11,720.50 · ACC $1,917.50 · total $13,638 · $1,136.50 a month · 15.2% of every invoice · provisional yes, 3 × $4,102.18.
In the browser console: `OpenhoursSetAside.compute({ income: 90000, expenses: 25000, other: 0, gst: true, work: 'plumbing', firstYear: true })`.
