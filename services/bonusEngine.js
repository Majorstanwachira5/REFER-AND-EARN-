const db = require('../config/database');

/**
 * Process referral bonuses after a user successfully completes the ₦250 payment
 * @param {number} newUserId - The ID of the newly paid user (referee)
 */
async function processReferralBonus(newUserId) {
  try {
    const newUser = await db.get('SELECT * FROM users WHERE id = ?', [newUserId]);
    if (!newUser) {
      console.error(`[BonusEngine] User ${newUserId} not found.`);
      return { success: false, message: 'User not found' };
    }

    // Check if user is already marked paid
    if (Number(newUser.paid_status) === 1) {
      console.log(`[BonusEngine] User ${newUserId} is already activated.`);
    } else {
      // Mark user as paid
      await db.run('UPDATE users SET paid_status = 1 WHERE id = ?', [newUserId]);
      console.log(`[BonusEngine] User ${newUserId} (${newUser.name}) activated paid_status = 1`);
    }

    // Check if user has a referrer (Level 1)
    if (!newUser.referred_by) {
      console.log(`[BonusEngine] User ${newUserId} signed up directly without a referral code.`);
      return { success: true, message: 'User activated (Direct signup, no commissions)' };
    }

    const level1ReferrerId = newUser.referred_by;
    const level1Referrer = await db.get('SELECT * FROM users WHERE id = ?', [level1ReferrerId]);

    if (!level1Referrer) {
      console.warn(`[BonusEngine] Referrer ID ${level1ReferrerId} not found.`);
      return { success: true, message: 'User activated (Referrer missing)' };
    }

    // Check if Level 1 referral has already been processed for this referee
    const existingL1 = await db.get(
      'SELECT id FROM referrals WHERE referee_id = ? AND level = 1',
      [newUserId]
    );

    if (!existingL1) {
      // Credit Level 1 (Direct) - ₦100
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

    // Check for Level 2 (Indirect) - Referrer's referrer
    if (level1Referrer.referred_by) {
      const level2ReferrerId = level1Referrer.referred_by;
      const level2Referrer = await db.get('SELECT * FROM users WHERE id = ?', [level2ReferrerId]);

      if (level2Referrer) {
        const existingL2 = await db.get(
          'SELECT id FROM referrals WHERE referee_id = ? AND level = 2',
          [newUserId]
        );

        if (!existingL2) {
          // Credit Level 2 (Indirect) - ₦50
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

    return {
      success: true,
      message: 'Referral bonuses processed successfully'
    };
  } catch (error) {
    console.error('[BonusEngine] Error processing referral bonus:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  processReferralBonus
};
