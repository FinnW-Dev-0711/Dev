const rowsContainer = document.getElementById('rows');
const template = document.getElementById('row-template');
const form = document.getElementById('subscription-form');
const result = document.getElementById('result');

const CATEGORY_KEYWORDS = {
  'Filme & Serien': ['film', 'serie', 'stream', 'video on demand', 'cinema', 'tv', 'anime'],
  'Musik & Audio': ['musik', 'audio', 'podcast', 'hörbuch', 'music', 'radio'],
  Gaming: ['spiel', 'gaming', 'game', 'xbox', 'playstation', 'nintendo', 'esports'],
  'Produktivität & Cloud': ['cloud', 'storage', 'produktiv', 'office', 'software', 'notiz', 'projekt', 'backup'],
  'Fitness & Gesundheit': ['fitness', 'gesund', 'meditation', 'wellness', 'sport', 'training'],
  'Shopping & Lieferung': ['liefer', 'shopping', 'e-commerce', 'versand', 'retail'],
};

function addRow(name = '', price = '') {
  const clone = template.content.cloneNode(true);
  const row = clone.querySelector('.row');
  const [nameInput, priceInput] = row.querySelectorAll('input');
  nameInput.value = name;
  priceInput.value = price;

  row.querySelector('.delete').addEventListener('click', () => {
    row.remove();
    if (!rowsContainer.children.length) addRow();
  });

  rowsContainer.appendChild(row);
}

function money(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

async function fetchSubscriptionContext(name) {
  const query = new URLSearchParams({
    action: 'query',
    format: 'json',
    list: 'search',
    utf8: '1',
    srlimit: '1',
    srsearch: name,
    origin: '*',
  });

  try {
    const response = await fetch(`https://de.wikipedia.org/w/api.php?${query.toString()}`);
    if (!response.ok) return '';

    const data = await response.json();
    const firstHit = data?.query?.search?.[0];
    if (!firstHit) return '';

    return `${firstHit.title ?? ''} ${firstHit.snippet ?? ''}`.toLowerCase();
  } catch {
    return '';
  }
}

function classifySubscription(name, webContext) {
  const text = `${name} ${webContext}`.toLowerCase();

  let bestCategory = 'Sonstiges';
  let bestScore = 0;

  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    const score = keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  });

  return bestCategory;
}

async function analyzeSubscriptions(subscriptions) {
  const grouped = {};
  const totals = {};
  let grandTotal = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      const context = await fetchSubscriptionContext(sub.name);
      const category = classifySubscription(sub.name, context);

      if (!grouped[category]) grouped[category] = [];
      grouped[category].push({ ...sub, contextUsed: Boolean(context) });

      totals[category] = Number(((totals[category] ?? 0) + sub.price).toFixed(2));
      grandTotal += sub.price;
    })
  );

  const sortedCategories = Object.keys(grouped).sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));

  return {
    categories: sortedCategories.map((category) => ({
      name: category,
      items: grouped[category],
      total: totals[category],
    })),
    grandTotal: Number(grandTotal.toFixed(2)),
  };
}

function renderResult(data) {
  if (!data.categories.length) {
    result.innerHTML = '<h3>Keine gültigen Abos gefunden.</h3>';
    result.classList.remove('hidden');
    return;
  }

  const groups = data.categories
    .map(
      (group) => `
      <div class="group">
        <div class="group-header">
          <h4>${group.name}</h4>
          <span class="price">${money(group.total)}</span>
        </div>
        <ul class="item-list">
          ${group.items
            .map((item) => `<li>${item.name}: ${money(item.price)}${item.contextUsed ? ' · mit Web-Kontext' : ''}</li>`)
            .join('')}
        </ul>
      </div>
    `
    )
    .join('');

  result.innerHTML = `
    <h3>Deine Abo-Auswertung</h3>
    ${groups}
    <div class="grand-total">Gesamt: ${money(data.grandTotal)} / Monat</div>
  `;
  result.classList.remove('hidden');
}

document.getElementById('add-row').addEventListener('click', () => addRow());

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const subscriptions = [...rowsContainer.querySelectorAll('.row')]
    .map((row) => {
      const [nameInput, priceInput] = row.querySelectorAll('input');
      return { name: nameInput.value.trim(), price: Number(priceInput.value) };
    })
    .filter((item) => item.name && Number.isFinite(item.price) && item.price >= 0);

  const submitButton = form.querySelector('.btn-primary');
  submitButton.disabled = true;
  submitButton.textContent = 'Analysiere ...';

  try {
    const data = await analyzeSubscriptions(subscriptions);
    renderResult(data);
  } catch {
    result.innerHTML = '<h3>Fehler bei der Analyse. Bitte erneut versuchen.</h3>';
    result.classList.remove('hidden');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Analyse starten';
  }
});

addRow('Netflix', '12.99');
addRow('Spotify', '10.99');
