/* Calculator panel on the Expenses page.
   Evaluates with a small hand-written parser (numbers, + - × ÷, brackets, %),
   so the typed text is never run as code. */
(function () {
  'use strict';
  const { $ } = Tracker;

  // Returns a number, null for empty input, or NaN when the text is not a valid sum.
  function evaluate(text) {
    const src = text.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/[,\s]/g, '');
    if (!src) return null;
    if (!/^[0-9+\-*/.()%]+$/.test(src)) return NaN;

    let pos = 0;
    const peek = () => src[pos];

    function expression() {                       // + and -
      let value = term();
      while (peek() === '+' || peek() === '-') {
        const op = src[pos++], right = term();
        value = op === '+' ? value + right : value - right;
      }
      return value;
    }
    function term() {                             // * and /
      let value = factor();
      while (peek() === '*' || peek() === '/') {
        const op = src[pos++], right = factor();
        value = op === '*' ? value * right : value / right;
      }
      return value;
    }
    function factor() {                           // a leading + or -
      if (peek() === '-') { pos++; return -factor(); }
      if (peek() === '+') { pos++; return factor(); }
      return primary();
    }
    function primary() {                          // a number or (brackets), then any % signs
      let value;
      if (peek() === '(') {
        pos++;
        value = expression();
        if (peek() !== ')') throw new Error('missing )');
        pos++;
      } else {
        const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(pos));
        if (!m) throw new Error('number expected');
        value = parseFloat(m[0]);
        pos += m[0].length;
      }
      while (peek() === '%') { pos++; value /= 100; }
      return value;
    }

    try {
      const result = expression();
      if (pos !== src.length) return NaN;         // leftovers such as "2(3)"
      return Number.isFinite(result) ? Math.round(result * 1e8) / 1e8 : NaN;
    } catch (e) {
      return NaN;
    }
  }

  const panel = $('calc'), input = $('calcIn'), output = $('calcOut'), toggle = $('calcBtn');

  function showResult() {
    const r = evaluate(input.value);
    output.textContent = r === null ? ' '
      : Number.isNaN(r) ? 'Invalid'
      : '= ' + r.toLocaleString('en-IN', { maximumFractionDigits: 8 });
  }

  function equals() {
    const r = evaluate(input.value);
    if (r !== null && !Number.isNaN(r)) input.value = String(r);
    showResult();
  }

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }

  // keypad
  const KEYS = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '(', ')', '='];
  for (const k of KEYS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = k;
    if ('÷×−+%'.includes(k) || k === 'C' || k === '⌫') b.className = 'op';
    if (k === '=') b.className = 'eq';
    b.addEventListener('click', () => {
      if (k === 'C') input.value = '';
      else if (k === '⌫') input.value = input.value.slice(0, -1);
      else if (k === '=') { equals(); return; }
      else input.value += k;
      showResult();
    });
    $('keys').append(b);
  }

  input.addEventListener('input', showResult);
  input.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); equals(); } });
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  $('calcClose').addEventListener('click', () => setOpen(false));

  $('useAmt').addEventListener('click', () => {
    const r = evaluate(input.value);
    if (r === null || Number.isNaN(r) || r <= 0) {
      output.textContent = 'Enter a calculation with a positive result';
      return;
    }
    $('amount').value = Math.round(r * 100) / 100;
    setOpen(false);
    $('amount').focus();
  });
})();
