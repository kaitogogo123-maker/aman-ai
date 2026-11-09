import type { TranslateInput, TranslateOutput, Translator } from './types';

const MOCK_TRANSLATIONS: Record<string, string> = {
  ru: 'Vodonepronicaemaya turisticheskaya palatka dlya 3 chelovek. Bystraia sborka, ustoichivaya rama, kompaktnaya sumka.',
  kk: '3 adamga arnalgan su otkizbeitin turisttik shatyr. Tez quralady, berik qanga, yqsham somke.',
  en: 'Waterproof outdoor tent for 3 people. Fast setup, wind-resistant frame, compact travel bag.',
  zh: '三人防水户外帐篷，快速搭建，抗风支架，便携收纳袋。',
  ja: '3人用の防水アウトドアテント。素早く設営でき、耐風フレームとコンパクトな収納バッグ付き。',
  it: 'Tenda outdoor impermeabile per 3 persone, montaggio rapido, telaio resistente al vento, borsa compatta.',
  fr: 'Tente de plein air impermeable pour 3 personnes, montage rapide, armature resistante au vent, sac compact.',
  es: 'Tienda impermeable para 3 personas, montaje rapido, estructura resistente al viento y bolsa compacta.',
  de: 'Wasserdichtes Outdoor-Zelt fuer 3 Personen, schneller Aufbau, windfester Rahmen, kompakte Tasche.'
};

export class MockTranslator implements Translator {
  async translate(input: TranslateInput): Promise<TranslateOutput> {
    return {
      translated: MOCK_TRANSLATIONS[input.targetLang],
      provider: 'mock',
      cacheHit: false
    };
  }
}
