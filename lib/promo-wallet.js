const { isControlPlayerRole } = require('./control-player');

function isPromoUser(user) {
  return isControlPlayerRole(user?.role);
}

function walletBalance(user) {
  if (!user) return 0;
  if (isPromoUser(user)) return Number(user.promo_balance ?? 0);
  return Number(user.balance ?? 0);
}

function walletField(user) {
  return isPromoUser(user) ? 'promo_balance' : 'balance';
}

function applyPublicBalance(out, user) {
  out.balance = walletBalance(user);
  if (isPromoUser(user)) out.promoWallet = true;
  return out;
}

function isBetPromo(bet, user) {
  if (bet.is_promo === true) return true;
  return isPromoUser(user);
}

function splitRoundTotals(roundBetsAll, usersMap, winner, payoutMult = 5) {
  let realStake = 0;
  let realPayout = 0;
  let promoStake = 0;
  let promoPayout = 0;

  for (const bet of roundBetsAll || []) {
    const amt = Number(bet.amount);
    const u = usersMap.get(bet.user_id);
    const promo = isBetPromo(bet, u);
    const won = bet.number === winner;
    const payout = won ? amt * payoutMult : 0;

    if (promo) {
      promoStake += amt;
      promoPayout += payout;
    } else {
      realStake += amt;
      realPayout += payout;
    }
  }

  return {
    realStake,
    realPayout,
    realHousePL: realStake - realPayout,
    promoStake,
    promoPayout,
    promoNet: promoStake - promoPayout
  };
}

module.exports = {
  isPromoUser,
  walletBalance,
  walletField,
  applyPublicBalance,
  splitRoundTotals
};
