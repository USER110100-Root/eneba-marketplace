const copy = {
  en: ['AI shopping assistant', 'Ask about products, prices or activation.', 'Your question', 'Send', 'Close', 'AI chat is currently unavailable.'],
  lt: ['DI apsipirkimo asistentas', 'Klauskite apie prekes, kainas ar aktyvinimą.', 'Jūsų klausimas', 'Siųsti', 'Uždaryti', 'DI pokalbis šiuo metu nepasiekiamas.'],
};
const widget = document.createElement('aside');
widget.className = 'market-chat';
widget.innerHTML = '<button class="market-chat-trigger" type="button" aria-controls="market-chat-panel" aria-expanded="false"><span class="market-chat-icon" aria-hidden="true"></span></button><section id="market-chat-panel" hidden aria-labelledby="market-chat-title"><header><strong id="market-chat-title"></strong><button type="button" class="market-chat-close">×</button></header><p></p><div class="market-chat-log" role="log" aria-live="polite"></div><form><input required maxlength="500" autocomplete="off"><button type="submit">Send</button></form></section>';
document.body.append(widget);
const trigger = widget.querySelector('.market-chat-trigger');
const panel = widget.querySelector('section');
const close = widget.querySelector('.market-chat-close');
const form = widget.querySelector('form');
const input = form.querySelector('input');
const send = form.querySelector('button');
const log = widget.querySelector('.market-chat-log');
const history = [];
const locale = () => document.documentElement.lang === 'lt' ? 'lt' : 'en';
function updateCopy() {
  const [title, intro, label, submit, dismiss] = copy[locale()];
  trigger.setAttribute('aria-label', title);
  trigger.title = title;
  panel.querySelector('strong').textContent = title;
  panel.querySelector('p').textContent = intro;
  input.placeholder = label;
  input.setAttribute('aria-label', label);
  send.textContent = submit;
  close.setAttribute('aria-label', dismiss);
}
function toggle(open) {
  panel.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
  (open ? input : trigger).focus();
}
function appendMessage(content, role) {
  const item = document.createElement('p');
  item.className = 'chat-' + role;
  item.textContent = content;
  log.append(item);
  log.scrollTop = log.scrollHeight;
}
trigger.addEventListener('click', () => toggle(panel.hidden));
close.addEventListener('click', () => toggle(false));
widget.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !panel.hidden) toggle(false);
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || send.disabled) return;
  const language = locale();
  appendMessage(message, 'user');
  input.value = '';
  send.disabled = true;
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message, locale: language, history: history.slice(-6)}),
    });
    const data = await response.json();
    if (!response.ok) {
      appendMessage(language === 'en' && typeof data.error === 'string' ? data.error : copy[language][5], 'assistant');
      return;
    }
    if (typeof data.reply !== 'string') throw new Error();
    appendMessage(data.reply, 'assistant');
    history.push({role: 'user', content: message}, {role: 'assistant', content: data.reply});
    if (history.length > 6) history.splice(0, history.length - 6);
  } catch {
    appendMessage(copy[language][5], 'assistant');
  } finally {
    send.disabled = false;
  }
});
updateCopy();
new MutationObserver(updateCopy).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
