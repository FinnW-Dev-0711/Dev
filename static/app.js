const rowsContainer = document.getElementById('rows');
const template = document.getElementById('row-template');
const form = document.getElementById('subscription-form');
const result = document.getElementById('result');

function addRow(name = '', price = '') {
  const clone = template.content.cloneNode(true);
  const row = clone.querySelector('.row');
  const [nameInput, priceInput] = row.querySelectorAll('input');
  nameInput.value = name;
  priceInput.value = price;

  row.querySelector('.delete').addEventListener('click', () => {
    row.remove();
    if (!rowsContainer.children.length) {
      addRow();
    }
  });

  rowsContainer.appendChild(row);
}

function money(value) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}

function renderResult(data) {
  if (!data.categories?.length) {
    result.innerHTML = '<h3>Keine gültigen Abos gefunden.</h3>';
    result.classList.remove('hidden');
    return;
  }

  const groups = data.categories.map(group => `
    <div class="group">
      <div class="group-header">
        <h4>${group.name}</h4>
        <span class="price">${money(group.total)}</span>
      </div>
      <ul class="item-list">
        ${group.items.map(item => `<li>${item.name}: ${money(item.price)}</li>`).join('')}
      </ul>
    </div>
  `).join('');

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

  const subscriptions = [...rowsContainer.querySelectorAll('.row')].map(row => {
    const [name, price] = row.querySelectorAll('input');
    return { name: name.value.trim(), price: Number(price.value) };
  }).filter(item => item.name && Number.isFinite(item.price) && item.price >= 0);

  const button = form.querySelector('.btn-primary');
  button.disabled = true;
  button.textContent = 'Analysiere ...';

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptions }),
    });

    if (!response.ok) {
      throw new Error('Analyse fehlgeschlagen');
    }

    const data = await response.json();
    renderResult(data);
  } catch (error) {
    result.innerHTML = '<h3>Fehler bei der Analyse. Bitte erneut versuchen.</h3>';
    result.classList.remove('hidden');
  } finally {
    button.disabled = false;
    button.textContent = 'Analyse starten';
  }
});

addRow('Netflix', '12.99');
addRow('Spotify', '10.99');
