import en from './en.js';
import tr from './tr.js';
import ar from './ar.js';
import ckb from './ckb.js';

export const LANGS = {
  en: { label: 'English', dir: 'ltr', dict: en },
  tr: { label: 'Türkçe', dir: 'ltr', dict: tr },
  ar: { label: 'العربية', dir: 'rtl', dict: ar },
  ckb: { label: 'کوردی', dir: 'rtl', dict: ckb },
};

// Every translation must have exactly the keys of the English one, or a page would render with holes.
const shape = o => (o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, shape(v)])) : typeof o);
const reference = JSON.stringify(shape(en));
for (const [code, { dict }] of Object.entries(LANGS))
  if (JSON.stringify(shape(dict)) !== reference) throw new Error(`src/i18n/${code}.js does not have the same keys as src/i18n/en.js`);
