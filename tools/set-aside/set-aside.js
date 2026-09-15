/* Openhours — the Set-Aside Calculator  ·  tools/set-aside/set-aside.js
   One file does three jobs: the arithmetic (pure functions, testable), drawing the tool into any
   <div data-tool="set-aside">, and posting "email me this" to a webhook (same pattern as the contact form).
   Embed on any site with two lines:
     <div data-tool="set-aside" data-endpoint=""></div>
     <script src="https://openhours-nz.github.io/tools/set-aside/set-aside.js" defer></script>
   Every rate below has a source. Change the year in one place: TAX_YEAR. */
(() => {
  'use strict';

  /* ---------- 1. RULES — tax year 1 April 2026 – 31 March 2027. Sources in OFFER.md. ---------- */
  const TAX_YEAR = { label: '2026–27', endYear: 2027 };          // 31 March 2027 balance date
  const BRACKETS = [                                               // IRD, tax rates for individuals
    { upTo: 15600,    rate: 0.105 },
    { upTo: 53500,    rate: 0.175 },
    { upTo: 78100,    rate: 0.30  },
    { upTo: 180000,   rate: 0.33  },
    { upTo: Infinity, rate: 0.39  },
  ];
  const PROVISIONAL_TRIGGER = 5000;    // residual income tax over this → provisional taxpayer next year (IRD)
  const PROVISIONAL_UPLIFT  = 1.05;    // standard option: last year's RIT + 5% (IRD)
  const GST_RATE            = 0.15;
  const GST_THRESHOLD       = 60000;   // must register once turnover passes this in 12 months (IRD)
  const ACC = {                        // ACC Levy Guidebook 2026/27 (rates ex-GST, per $100) + IRD earners' levy page
    earners: 0.0152,                   // $1.52 per $100 ex-GST ($1.75 incl GST)
    safer:   0.0008,                   // Working Safer levy, $0.08 per $100, flat
    maxLiable: 156641,                 // earners' levy stops at this much income (IRD)
    gst: 1.15,                         // ACC invoices include GST; not registered → you pay it
  };
  // Type of work → ACC classification unit and its CoverPlus work-levy rate (ex-GST, per $100). Guidebook 2026/27 rate table.
  const WORK = [
    { key: 'office',    label: 'Office, admin or consulting',                          cu: '78550', rate: 0.0012 },
    { key: 'it',        label: 'IT, software or web',                                  cu: '78340', rate: 0.0002 },
    { key: 'accounts',  label: 'Accounting or bookkeeping',                            cu: '78420', rate: 0.0003 },
    { key: 'design',    label: 'Design, marketing or photography',                     cu: '78510', rate: 0.0011 },
    { key: 'arts',      label: 'Writing, music, arts or teaching',                     cu: '92420', rate: 0.0037 },
    { key: 'health',    label: 'Physio, massage or allied health',                     cu: '86390', rate: 0.0019 },
    { key: 'fitness',   label: 'Fitness or sports coaching',                           cu: '84500', rate: 0.0058 },
    { key: 'realestate',label: 'Real estate',                                          cu: '77200', rate: 0.0016 },
    { key: 'food',      label: 'Café, restaurant or catering',                         cu: '57300', rate: 0.0040 },
    { key: 'beauty',    label: 'Hair, beauty or nails',                                cu: '95260', rate: 0.0050 },
    { key: 'mechanic',  label: 'Mechanic or vehicle repair',                           cu: '53290', rate: 0.0087 },
    { key: 'cleaning',  label: 'Cleaning or pest control',                             cu: '78660', rate: 0.0100 },
    { key: 'courier',   label: 'Courier or delivery driving',                          cu: '71120', rate: 0.0130 },
    { key: 'electrical',label: 'Electrical',                                           cu: '42320', rate: 0.0068 },
    { key: 'plumbing',  label: 'Plumbing, gasfitting or drainlaying',                  cu: '42310', rate: 0.0135 },
    { key: 'painting',  label: 'Painting or decorating',                               cu: '42440', rate: 0.0167 },
    { key: 'building',  label: 'Building, carpentry, plastering, tiling, glazing, concreting or landscaping', cu: '42420', rate: 0.0176 },
    { key: 'roofing',   label: 'Roofing, bricklaying or truck driving',                cu: '42230', rate: 0.0225 },
    { key: 'other',     label: 'Not sure / something else',                            cu: '78550', rate: 0.0012 },
  ];
  const DATES = {   // for a 31 March balance date
    terminal:  `7 February ${TAX_YEAR.endYear + 1}`,          // this year's tax, if not provisional (7 April with a tax agent)
    prov: [ `28 August ${TAX_YEAR.endYear}`, `15 January ${TAX_YEAR.endYear + 1}`, `7 May ${TAX_YEAR.endYear + 1}` ],
    crunch: `August ${TAX_YEAR.endYear} and May ${TAX_YEAR.endYear + 1}`,
  };

  /* ---------- 2. ARITHMETIC — pure. compute(inputs) → results. Nothing here touches the page. ---------- */
  const incomeTax = (income) => {      // progressive: each slice at its own rate
    let tax = 0, from = 0;
    for (const b of BRACKETS) {
      if (income <= from) break;
      tax += (Math.min(income, b.upTo) - from) * b.rate;
      from = b.upTo;
    }
    return tax;
  };

  const compute = (i) => {
    const income   = Math.max(0, +i.income   || 0);
    const expenses = Math.max(0, +i.expenses || 0);
    const other    = Math.max(0, +i.other    || 0);
    const gst      = !!i.gst;
    const work     = WORK.find(w => w.key === i.work) || WORK[WORK.length - 1];

    const profit      = Math.max(0, income - expenses);
    const taxable     = profit + other;
    const totalTax    = incomeTax(taxable);
    const taxOnOther  = incomeTax(other);            // what PAYE already took on the wages, roughly
    const businessTax = totalTax - taxOnOther;       // the tax the business income adds — the residual income tax, near enough

    // ACC: on business earnings, up to the cap (wages have already used some of it through PAYE)
    const liable   = Math.min(profit, Math.max(0, ACC.maxLiable - other));
    const earners  = liable * ACC.earners;
    const workLevy = liable * work.rate;
    const safer    = liable * ACC.safer;
    const accEx    = earners + workLevy + safer;
    const acc      = gst ? accEx : accEx * ACC.gst;  // registered → claim the GST back; not → you pay it

    const total     = businessTax + acc;
    const perMonth  = total / 12;
    const perInvoice= income > 0 ? total / income : 0;

    const provisional = businessTax > PROVISIONAL_TRIGGER;
    const provTotal   = provisional ? businessTax * PROVISIONAL_UPLIFT : 0;
    const provEach    = provTotal / 3;
    const crunch      = businessTax + provTotal;    // year one's bill + year two's instalments, all inside nine months

    return { income, expenses, other, gst, work, profit, taxable, totalTax, taxOnOther, businessTax,
             liable, earners, workLevy, safer, accEx, acc, total, perMonth, perInvoice,
             provisional, provTotal, provEach, crunch, firstYear: !!i.firstYear, lossYear: expenses > income && income > 0 };
  };

  /* ---------- 3. FORMAT ---------- */
  const nzd  = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 });
  const money = (n) => nzd.format(Math.round(n));
  const pct   = (n) => (n * 100).toFixed(n * 100 < 10 ? 1 : 0) + '%';
  const esc   = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- 4. MARKUP — drawn once per embed. ---------- */
  const template = (id) => `
  <div class="oh-tool__grid">
    <form class="oh-tool__inputs" id="${id}-form" novalidate autocomplete="off">
      <div class="oh-tool__intro">
        <p class="oh-tool__eyebrow">How much should I put aside?</p>
        <p class="oh-tool__lede">Six questions. A real number. For sole traders, contractors and first-year businesses in New Zealand — tax year ${TAX_YEAR.label}.</p>
      </div>

      <div class="oh-field">
        <label for="${id}-income">Business income this year, before expenses</label>
        <div class="oh-money"><span>$</span><input id="${id}-income" name="income" type="number" inputmode="decimal" min="0" step="1000" value="90000"></div>
        <p class="oh-hint" data-hint="income">What you'll invoice this year, not counting GST.</p>
      </div>

      <div class="oh-field">
        <label for="${id}-expenses">Business expenses this year</label>
        <div class="oh-money"><span>$</span><input id="${id}-expenses" name="expenses" type="number" inputmode="decimal" min="0" step="500" value="25000"></div>
        <p class="oh-hint">Tools, vehicle, software, phone, materials, insurance — anything that's a cost of doing the work.</p>
      </div>

      <div class="oh-field">
        <label for="${id}-other">Other income this year — wages, salary</label>
        <div class="oh-money"><span>$</span><input id="${id}-other" name="other" type="number" inputmode="decimal" min="0" step="1000" value="0"></div>
        <p class="oh-hint">From a job that already takes PAYE. It uses up the low tax brackets first, so your business income is taxed higher. Most calculators ignore this.</p>
      </div>

      <fieldset class="oh-field oh-choice">
        <legend>GST registered?</legend>
        <label><input type="radio" name="gst" value="yes" checked><span>Yes</span></label>
        <label><input type="radio" name="gst" value="no"><span>No</span></label>
        <p class="oh-hint">You must register once you earn over ${money(GST_THRESHOLD)} in any 12 months.</p>
      </fieldset>

      <div class="oh-field">
        <label for="${id}-work">Type of work</label>
        <select id="${id}-work" name="work">
          ${WORK.map(w => `<option value="${w.key}"${w.key === 'plumbing' ? ' selected' : ''}>${esc(w.label)}</option>`).join('')}
        </select>
        <p class="oh-hint">Sets your ACC work levy. ACC decides the real rate from the code on your tax return.</p>
      </div>

      <fieldset class="oh-field oh-choice">
        <legend>First year in business?</legend>
        <label><input type="radio" name="firstYear" value="yes" checked><span>Yes</span></label>
        <label><input type="radio" name="firstYear" value="no"><span>No</span></label>
      </fieldset>
    </form>

    <div class="oh-tool__results">
      <div class="oh-result" aria-live="polite" aria-atomic="true">
        <p class="oh-tool__eyebrow">Put aside</p>
        <p class="oh-result__big"><span class="oh-accent" data-out="perMonth">—</span> <span class="oh-result__unit">a month</span></p>
        <p class="oh-result__sub">That's <strong data-out="perInvoice">—</strong> of every invoice, before GST.</p>
      </div>
      <ul class="oh-rows">
        <li><span>Income tax for the year</span><span data-out="businessTax">—</span></li>
        <li><span>ACC levies <small data-out="accNote"></small></span><span data-out="acc">—</span></li>
        <li class="oh-rows__total"><span>Total to put aside for the year</span><span data-out="total">—</span></li>
        <li data-show="gst"><span>GST to hold, on top of every invoice</span><span>15% — it was never yours</span></li>
      </ul>
      <div class="oh-note" data-show="loss" hidden><p><strong>Your expenses are higher than your income.</strong> No tax to put aside — but a loss year has its own rules, and it's worth a conversation.</p></div>
      <div class="oh-note" data-show="provisional-yes" hidden>
        <p><strong>Provisional tax next year: yes.</strong> Your tax bill is over ${money(PROVISIONAL_TRIGGER)}, so IRD will want next year's paid in advance — three instalments of about <strong data-out="provEach">—</strong> on ${DATES.prov.join(', ')}. (Two instalments if you file GST six-monthly.)</p>
      </div>
      <div class="oh-note" data-show="provisional-no" hidden>
        <p><strong>Provisional tax next year: not yet.</strong> That starts once your tax bill passes ${money(PROVISIONAL_TRIGGER)}. This year's tax is due ${DATES.terminal} — 7 April if you use a tax agent.</p>
      </div>
      <div class="oh-note oh-note--warn" data-show="crunch" hidden>
        <p><strong>Heads up for year two.</strong> This year's tax (<span data-out="businessTax2">—</span>) is due ${DATES.terminal}. Next year's instalments start ${DATES.prov[0]}. So between ${DATES.crunch} you pay <em>both</em> — about <strong data-out="crunch">—</strong> in nine months, having saved for one year. This is the thing that catches people.</p>
      </div>

      <form class="oh-capture" id="${id}-capture" action="#" method="post" novalidate>
        <p class="oh-tool__eyebrow">Want this checked?</p>
        <p class="oh-capture__lede">Get the breakdown by email. This doesn't cover student loan, KiwiSaver, Working for Families, a loss year, or whether you should be a company — an accountant does.</p>
        <div class="oh-field"><label for="${id}-name">Name</label><input id="${id}-name" name="name" type="text" autocomplete="name" required></div>
        <div class="oh-field"><label for="${id}-email">Email</label><input id="${id}-email" name="email" type="email" autocomplete="email" required></div>
        <div class="oh-field">
          <label for="${id}-acct">Do you have an accountant?</label>
          <select id="${id}-acct" name="accountant">
            <option value="">Choose one (optional)</option>
            <option value="no">No</option>
            <option value="looking">I'm looking for one</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        <div class="oh-hp" aria-hidden="true"><label for="${id}-website">Leave this empty</label><input id="${id}-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
        <p class="oh-row"><button class="oh-btn" type="submit">Email me this breakdown</button> <span class="oh-status" role="status" aria-live="polite"></span></p>
      </form>
      <div class="oh-note oh-sent" id="${id}-sent" hidden><p><strong>Sent.</strong> Check your inbox — and your spam folder, just in case.</p></div>

      <p class="oh-fine">Estimates for the ${TAX_YEAR.label} tax year (1 April ${TAX_YEAR.endYear - 1} – 31 March ${TAX_YEAR.endYear}), 31 March balance date. Not advice. Doesn't include student loan repayments, KiwiSaver, Working for Families, ACC's minimum-earnings floor, or GST claimed back on expenses. Income tax and provisional tax rules from Inland Revenue; ACC rates from the ACC Levy Guidebook 2026/27.</p>
    </div>
  </div>`;

  /* ---------- 5. WIRE UP — read inputs, compute, write results. ---------- */
  const mount = (root, n) => {
    const id = 'oh' + n;
    root.classList.add('oh-tool');
    root.innerHTML = template(id);
    if (root.dataset.intro === 'off') root.querySelector('.oh-tool__intro').remove();   // the host page already introduced it
    const form = root.querySelector('#' + id + '-form');
    const out  = (k) => root.querySelectorAll(`[data-out="${k}"]`);
    const show = (k, on) => root.querySelectorAll(`[data-show="${k}"]`).forEach(el => el.hidden = !on);
    const set  = (k, v) => out(k).forEach(el => el.textContent = v);

    const read = () => {
      const d = Object.fromEntries(new FormData(form));
      return { income: d.income, expenses: d.expenses, other: d.other, gst: d.gst === 'yes', work: d.work, firstYear: d.firstYear === 'yes' };
    };

    let last = null;
    const render = () => {
      const r = compute(read()); last = r;
      root.querySelector('[data-hint="income"]').textContent = r.gst ? 'What you\'ll invoice this year, not counting GST.' : 'What you\'ll invoice this year.';
      const empty = r.income <= 0;
      set('perMonth',   empty ? '—' : money(r.perMonth));
      set('perInvoice', empty ? '—' : pct(r.perInvoice));
      set('businessTax',empty ? '—' : money(r.businessTax));
      set('businessTax2', money(r.businessTax));
      set('acc',        empty ? '—' : money(r.acc));
      set('accNote',    r.liable > 0 ? `(earners' + ${r.work.label.split(',')[0].toLowerCase()} work levy${r.gst ? '' : ', incl GST'})` : '');
      set('total',      empty ? '—' : money(r.total));
      set('provEach',   money(r.provEach));
      set('crunch',     money(r.crunch));
      show('gst', r.gst && !empty);
      show('loss', r.lossYear);
      show('provisional-yes', !empty && r.provisional);
      show('provisional-no',  !empty && !r.provisional && !r.lossYear);
      show('crunch', !empty && r.provisional && r.firstYear);
      root.dispatchEvent(new CustomEvent('oh:result', { detail: r, bubbles: true }));
    };
    form.addEventListener('input', render);
    form.addEventListener('change', render);
    form.addEventListener('submit', ev => ev.preventDefault());   // Enter in a field should not "submit" the inputs
    render();

    // "Email me this breakdown" → webhook. Without an endpoint the tool still works; only the email doesn't.
    const cap = root.querySelector('#' + id + '-capture');
    const status = cap.querySelector('.oh-status');
    const button = cap.querySelector('button');
    const sent = root.querySelector('#' + id + '-sent');
    cap.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!cap.reportValidity()) return;
      const d = Object.fromEntries(new FormData(cap));
      if (d.website) { cap.reset(); status.textContent = ''; return; } // honeypot: a bot. Say nothing.
      const endpoint = root.dataset.endpoint;
      if (!endpoint) { status.textContent = 'Email isn\'t connected on this page yet.'; return; }
      button.disabled = true; status.textContent = 'Sending…';
      const r = last;
      try {
        const res = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'set-aside', name: d.name, email: d.email, accountant: d.accountant, website: d.website,
            inputs:  { income: r.income, expenses: r.expenses, other: r.other, gst: r.gst, work: r.work.label, cu: r.work.cu, firstYear: r.firstYear },
            results: { businessTax: Math.round(r.businessTax), acc: Math.round(r.acc), total: Math.round(r.total), perMonth: Math.round(r.perMonth),
                       perInvoice: +(r.perInvoice * 100).toFixed(1), provisional: r.provisional, provEach: Math.round(r.provEach), crunch: Math.round(r.crunch) },
            taxYear: TAX_YEAR.label, page: location.href, sent: new Date().toISOString(),
          }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        cap.hidden = true; sent.hidden = false;
      } catch (err) {
        status.textContent = 'That didn\'t send. Please try again in a minute.';
        button.disabled = false;
      }
    });
  };

  /* ---------- 6. BOOT — find every embed, load the stylesheet once, mount. ---------- */
  const me = document.currentScript;
  const base = me && me.src ? me.src.replace(/[^/]*$/, '') : '/tools/set-aside/';
  if (!document.querySelector('link[data-oh-tool]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = base + 'set-aside.css'; link.dataset.ohTool = 'set-aside';
    document.head.appendChild(link);
  }
  document.querySelectorAll('[data-tool="set-aside"]').forEach(mount);

  // If we're inside an iframe, tell the parent page how tall we are, so it can size the frame.
  if (window.parent !== window) {
    const tell = () => parent.postMessage({ ohTool: 'set-aside', height: document.documentElement.scrollHeight }, '*');
    new ResizeObserver(tell).observe(document.documentElement); tell();
  }

  window.OpenhoursSetAside = { compute, incomeTax, WORK, BRACKETS, ACC, TAX_YEAR };   // for tests and for anyone curious
})();
