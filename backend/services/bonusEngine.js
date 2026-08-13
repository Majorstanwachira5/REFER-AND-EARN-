const db = require('../config/database');

async function processReferralBonus(newUserId) {
  try {
    const newUser = await db.get('SELECT * FROM users WHERE id = ?', [newUserId]);
    if (!newUser) {
      return { success: false, message: 'User not found' };
    }

    if (Number(newUser.paid_status) !== 1) {
      await db.run('UPDATE users SET paid_status = 1 WHERE id = ?', [newUserId]);
      console.log(`[BonusEngine] User ${newUserId} (${newUser.name}) activated paid_status = 1`);
    }

    if (!newUser.referred_by) {
      return { success: true, message: 'User activated (Direct signup, no referral commissions)' };
    }

    const level1ReferrerId = newUser.referred_by;
    const level1Referrer = await db.get('SELECT * FROM users WHERE id = ?', [level1ReferrerId]);

    if (!level1Referrer) {
      return { success: true, message: 'User activated (Referrer missing)' };
    }

    // Check Level 1 existing
    const existingL1 = await db.get(
      'SELECT id FROM referrals WHERE referee_id = ? AND level = 1',
      [newUserId]
    );

    if (!existingL1) {
      const L1_COMMISSION = 100.00;
      await db.run(
        'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
        [L1_COMMISSION, level1ReferrerId]
      );

      await db.run(
        'INSERT INTO transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
        [
          level1ReferrerId,
          L1_COMMISSION,
          'credit',
          `Direct Referral Bonus (Level 1) from ${newUser.name}`
        ]
      );

      await db.run(
        'INSERT INTO referrals (referrer_id, referee_id, level, commission_earned) VALUES (?, ?, ?, ?)',
        [level1ReferrerId, newUserId, 1, L1_COMMISSION]
      );

      console.log(`[BonusEngine] Credited ₦100 Level 1 Bonus to User ${level1ReferrerId} (${level1Referrer.name})`);
    }

    // Check Level 2 (Indirect)
    if (level1Referrer.referred_by) {
      const level2ReferrerId = level1Referrer.referred_by;
      const level2Referrer = await db.get('SELECT * FROM users WHERE id = ?', [level2ReferrerId]);

      if (level2Referrer) {
        const existingL2 = await db.get(
          'SELECT id FROM referrals WHERE referee_id = ? AND level = 2',
          [newUserId]
        );

        if (!existingL2) {
          const L2_COMMISSION = 50.00;
          await db.run(
            'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
            [L2_COMMISSION, level2ReferrerId]
          );

          await db.run(
            'INSERT INTO transactions (user_id, amount, type, description) VALUES (?, ?, ?, ?)',
            [
              level2ReferrerId,
              L2_COMMISSION,
              'credit',
              `Indirect Referral Bonus (Level 2) from ${newUser.name}`
            ]
          );

          await db.run(
            'INSERT INTO referrals (referrer_id, referee_id, level, commission_earned) VALUES (?, ?, ?, ?)',
            [level2ReferrerId, newUserId, 2, L2_COMMISSION]
          );

          console.log(`[BonusEngine] Credited ₦50 Level 2 Bonus to User ${level2ReferrerId} (${level2Referrer.name})`);
        }
      }
    }

    return { success: true, message: 'Referral commissions distributed successfully' };
  } catch (error) {
    console.error('[BonusEngine Error]', error);
    return { success: false, error: error.message };
  }
}

module.exports = { processReferralBonus };
