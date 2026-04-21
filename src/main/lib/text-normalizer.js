const WORD_MAP = new Map([
  ['sînt', 'sunt'],
  ['îs', 'îs'],
  ['romania', 'România'],
  ['bucuresti', 'București'],
  ['iasi', 'Iași'],
  ['constanta', 'Constanța'],
  ['brasov', 'Brașov'],
  ['targu', 'Târgu'],
  ['tehnoredactare', 'tehnoredactare']
]);

function applyConservativeDiacritics(text) {
  return text.replace(/\b([A-Za-zĂÂÎȘȚăâîșț]+)\b/g, (token) => {
    const key = token.toLowerCase();
    const replacement = WORD_MAP.get(key);
    if (!replacement) {
      return token;
    }
    if (token[0] === token[0].toUpperCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}

function applyCustomGlossary(text, glossaryMap) {
  if (!glossaryMap || glossaryMap.size === 0) {
    return text;
  }
  return text.replace(/\b([A-Za-zĂÂÎȘȚăâîșț]+)\b/g, (token) => {
    const replacement = glossaryMap.get(token.toLowerCase());
    if (!replacement) {
      return token;
    }
    if (token[0] === token[0].toUpperCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });
}

function normalizeRomanianText(rawInput, options = {}) {
  const { glossaryMap = null } = options;
  if (!rawInput || !rawInput.trim()) {
    return '';
  }

  let text = rawInput
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])(\S)/g, '$1 $2')
    .trim();

  text = applyConservativeDiacritics(text);
  text = applyCustomGlossary(text, glossaryMap);

  if (/^[a-zăâîșț]/.test(text)) {
    text = text[0].toUpperCase() + text.slice(1);
  }

  if (!/[.!?]$/.test(text)) {
    text += '.';
  }

  return text;
}

module.exports = {
  normalizeRomanianText
};
