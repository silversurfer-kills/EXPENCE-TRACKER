/* Expenses page: add / delete expenses, filter, category totals, monthly budget. */
(function () {
  'use strict';
  const { $, money, today, thisMonth, state, save, drawBars, addRow } = Tracker;

  $('date').value = today;
  $('month').value = thisMonth;

  function render() {
    const month = $('month').value;                       // '' means "all months"
    const query = $('q').value.trim().toLowerCase();

    const shown = state.expenses
      .filter(e => (!month || e.date.startsWith(month)) &&
                   (!query || (e.cat + ' ' + e.note).toLowerCase().includes(query)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    // table
    const body = $('rows');
    body.replaceChildren();
    for (const e of shown) {
      addRow(body, [[e.date], [e.cat], [e.note || '–', 'note']], e.amount, 'Delete expense', () => {
        state.expenses = state.expenses.filter(x => x.id !== e.id);
        save();
        render();
      });
    }
    $('empty').hidden = shown.length > 0;

    // totals and per-category bars
    const byCategory = {};
    for (const e of shown) byCategory[e.cat] = (byCategory[e.cat] || 0) + e.amount;
    const ranked = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    $('total').textContent = money(shown.reduce((sum, e) => sum + e.amount, 0));
    $('count').textContent = shown.length;
    $('top').textContent = ranked.length ? ranked[0][0] : '–';
    drawBars($('breakdown'), ranked, 'Nothing to show yet.');

    renderBudget(month || thisMonth);
  }

  // Budget of one month (the selected one, or the current month when showing all months).
  function renderBudget(month) {
    const budget = Number(state.budgets[month]) || 0;
    if (document.activeElement !== $('budget')) $('budget').value = budget || '';

    const spent = state.expenses.filter(e => e.date.startsWith(month)).reduce((sum, e) => sum + e.amount, 0);
    const msg = $('budgetMsg'), bar = $('budgetBar');
    bar.classList.toggle('over', budget > 0 && spent > budget);

    if (!budget) {
      msg.textContent = 'Set a budget for ' + month + ' to track it.';
      msg.className = 'budget-msg';
      bar.style.width = '0';
    } else if (spent > budget) {
      msg.textContent = 'Over budget by ' + money(spent - budget) + ' (spent ' + money(spent) + ')';
      msg.className = 'budget-msg warn';
      bar.style.width = '100%';
    } else {
      msg.textContent = money(budget - spent) + ' left (spent ' + money(spent) + ' of ' + money(budget) + ')';
      msg.className = 'budget-msg good';
      bar.style.width = (spent / budget * 100) + '%';
    }
  }

  $('expenseForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const amount = parseFloat($('amount').value), date = $('date').value;
    if (!date || !(amount > 0)) {
      $('err').textContent = 'Please enter a date and an amount greater than 0.';
      return;
    }
    $('err').textContent = '';
    state.expenses.push({ id: Date.now(), date, amount, cat: $('cat').value, note: $('note').value.trim() });
    save();
    $('amount').value = '';
    $('note').value = '';
    // jump to the month of the new expense so it is visible
    if ($('month').value && !date.startsWith($('month').value)) $('month').value = date.slice(0, 7);
    render();
  });

  $('budget').addEventListener('input', () => {
    state.budgets[$('month').value || thisMonth] = $('budget').value;
    save();
    render();
  });
  $('month').addEventListener('input', render);
  $('q').addEventListener('input', render);
  $('allMonths').addEventListener('click', () => { $('month').value = ''; render(); });

  render();
})();
