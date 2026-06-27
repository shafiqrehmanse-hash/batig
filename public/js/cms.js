/* BATIG CMS — theme + game config from Supabase */
const CMS = {
  _channel: null,

  async load() {
    if (!window.BATIG_CONFIG?.supabaseUrl) return;
    const db = DirectAuth.db();
    const { data, error } = await db.from('cms_settings').select('*');
    if (error || !data) return;

    const settings = {};
    data.forEach(s => { settings[s.setting_key] = s.setting_value; });

    let styleTag = document.getElementById('cms-theme');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'cms-theme';
      document.head.appendChild(styleTag);
    }

    styleTag.textContent = `
      :root {
        --brand-primary: ${settings['theme.color.brand_primary'] || '#f4d03f'};
        --brand-secondary: ${settings['theme.color.brand_secondary'] || '#00e676'};
        --bg-base: ${settings['theme.color.bg_base'] || '#030508'};
        --brand-accent: ${settings['theme.color.brand_accent'] || '#7c3aed'};
        --gold: var(--brand-primary);
        --gold2: var(--brand-primary);
        --green: var(--brand-secondary);
      }
    `;

    window.GAME_CONFIG = {
      odds: parseFloat(settings['game.odds_multiplier'] || 5),
      minBet: parseInt(settings['game.min_bet'] || 50, 10),
      maxBet: parseInt(settings['game.max_bet'] || 10000, 10),
      welcomeBonus: parseInt(settings['game.welcome_bonus'] || 500, 10),
      referralBonus: parseInt(settings['game.referral_bonus'] || 100, 10),
      maxExposure: parseInt(settings['limits.max_exposure_per_number'] || 50000, 10),
      maintenanceMode: settings['limits.maintenance_mode'] === 'true',
      bettingOpen: settings['limits.betting_open'] !== 'false',
      siteName: settings['content.site_name'] || 'BATIG',
      tagline: settings['content.tagline'] || 'Premium Dice Betting',
      depositContact: settings['content.deposit_contact'] || '',
      withdrawInfo: settings['content.withdraw_info'] || '',
      easypaisaName: settings['payment.easypaisa_name'] || '',
      easypaisaNumber: settings['payment.easypaisa_number'] || '',
      jazzcashName: settings['payment.jazzcash_name'] || '',
      jazzcashNumber: settings['payment.jazzcash_number'] || ''
    };

    document.querySelectorAll('[data-cms]').forEach(el => {
      const key = el.dataset.cms;
      if (settings[key]) el.textContent = settings[key];
    });

    const odds = window.GAME_CONFIG.odds;
    ['slip-odds', 'slip-odds-display'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = odds;
    });

    const brandEls = document.querySelectorAll('.header-brand span[data-cms], .loader-brand');
    brandEls.forEach(el => {
      if (el.dataset.cms === 'content.site_name') el.textContent = window.GAME_CONFIG.siteName;
      else if (el.classList.contains('loader-brand')) el.textContent = window.GAME_CONFIG.siteName;
    });

    this.subscribe(db);
  },

  subscribe(db) {
    if (this._channel) db.removeChannel(this._channel);
    this._channel = db.channel('cms_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cms_settings' }, () => this.load())
      .subscribe();
  },

  async save(key, value, updatedBy) {
    const db = DirectAuth.db();
    const { error } = await db.from('cms_settings').upsert({
      setting_key: key,
      setting_value: String(value),
      updated_by: updatedBy || 'owner',
      updated_at: new Date().toISOString()
    }, { onConflict: 'setting_key' });
    if (error) throw new Error(error.message);
    await this.load();
  }
};
