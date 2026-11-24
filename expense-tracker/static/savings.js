/* Savings & Goals page: add / delete savings, goals with progress bars,
   and the "save what is left of today's limit" suggestion. */
(function () {
  'use strict';
  const { $, money, date, today, thisMonth, state, save, drawBars, addRow } = Tracker;

  $('date').value = today;
  $('month').value = thisMonth;

  const sumSaved = test => state.savings.filter(test).reduce((sum, s) => sum + s.amount, 0);

  function showProgress(prefix, saved, goal) {
    $(prefix + 'Txt').textContent = goal
      ? money(saved) + ' of ' + money(goal) + (saved >= goal ? ' ✓ Goal reached!' : '')
      : money(saved) + ' saved (no goal set)';
    $(prefix + 'Bar').style.width = goal ? Math.min(100, saved / goal * 100) + '%' : '0';
  }

  function render() {
    const month = $('month').value;                       // '' means "all months"
    const query = $('q').value.trim().toLowerCase();

    const shown = state.savings
      .filter(s => (!month || s.date.startsWith(month)) &&
                   (!query || (s.note || '').toLowerCase().includes(query)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    // table
    const body = $('rows');
    body.replaceChildren();
    for (const s of shown) {
      addRow(body, [[s.date], [s.note || '–', 'note']], s.amount, 'Delete saving', () => {
        state.savings = state.savings.filter(x => x.id !== s.id);
        save();
        render();
      });
    }
    $('empty').hidden = shown.length > 0;

    // totals of what is shown
    $('total').textContent = money(shown.reduce((sum, s) => sum + s.amount, 0));
    $('count').textContent = shown.length;
    $('top').textContent = shown.length ? money(Math.max(...shown.map(s => s.amount))) : '–';

    // savings per month (always all months, newest first)
    const byMonth = {};
    for (const s of state.savings) {
      const key = s.date.slice(0, 7);
      byMonth[key] = (byMonth[key] || 0) + s.amount;
    }
    const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0]));
    drawBars($('breakdown'), months, 'Nothing to show yet.');

    // goals (of the selected month, or the current month when showing all months)
    const goalMonth = month || thisMonth;
    const monthlyGoal = Number(state.goals[goalMonth]) || 0;
    const dailyGoal = Number(state.dailyGoal) || 0;
    if (document.activeElement !== $('goalDay')) $('goalDay').value = dailyGoal || '';
    if (document.activeElement !== $('goalMonth')) $('goalMonth').value = monthlyGoal || '';
    $('monLbl').textContent = 'Month ' + goalMonth;
    showProgress('day', sumSaved(s => s.date === today), dailyGoal);
    showProgress('mon', sumSaved(s => s.date.startsWith(goalMonth)), monthlyGoal);

    renderTip();
  }

  // Today's spending limit = what is left of this month's budget, shared over the days left.
  function renderTip() {
    const tip = $('saveTip'), button = $('saveSuggest');
    const budget = Number(state.budgets[thisMonth]) || 0;

    if (!budget) {
      tip.textContent = 'Set a monthly budget on the Expenses page to get a daily spending limit and a savings suggestion.';
      button.hidden = true;
      return;
    }

    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - date.getDate() + 1;
    const spentBefore = state.expenses
      .filter(e => e.date.startsWith(thisMonth) && e.date < today)
      .reduce((sum, e) => sum + e.amount, 0);
    const spentToday = state.expenses.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0);
    const leftToday = Math.floor((Math.max(0, (budget - spentBefore) / daysLeft) - spentToday) * 100) / 100;
    const room = leftToday - sumSaved(s => s.date === today);

    if (room > 0) {
      tip.textContent = 'You can still spend ' + money(leftToday) + ' today. Whatever is left at the end of the day, save it instead!';
      button.textContent = 'Save ' + money(room) + ' today';
      button.dataset.amount = room;
      button.hidden = false;
    } else {
      tip.textContent = leftToday < 0
        ? 'You are over today’s limit by ' + money(-leftToday) + '. Try a lighter day tomorrow.'
        : 'Nice work! Today’s leftover is already in your savings.';
      button.hidden = true;
    }
  }

  function addSaving(amount, day, note) {
    amount = Math.round(amount * 100) / 100;
    if (!(amount > 0)) return;
    state.savings.push({ id: Date.now(), date: day || today, amount, note: note || '' });
    save();
  }

  $('saveSuggest').addEventListener('click', () => {
    addSaving(Number($('saveSuggest').dataset.amount));
    render();
  });

  $('savingForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const amount = parseFloat($('amount').value), day = $('date').value;
    if (!day || !(amount > 0)) {
      $('err').textContent = 'Please enter a date and an amount greater than 0.';
      return;
    }
    $('err').textContent = '';
    addSaving(amount, day, $('note').value.trim());
    $('amount').value = '';
    $('note').value = '';
    // jump to the month of the new saving so it is visible
    if ($('month').value && !day.startsWith($('month').value)) $('month').value = day.slice(0, 7);
    render();
  });

  $('goalDay').addEventListener('input', () => {
    state.dailyGoal = $('goalDay').value;
    save();
    render();
  });
  $('goalMonth').addEventListener('input', () => {
    state.goals[$('month').value || thisMonth] = $('goalMonth').value;
    save();
    render();
  });
  $('month').addEventListener('input', render);
  $('q').addEventListener('input', render);
  $('allMonths').addEventListener('click', () => { $('month').value = ''; render(); });

  render();
})();
