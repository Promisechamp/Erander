/**
 * Read-only verification of the security deposit attached to one errand.
 *
 * The public result intentionally contains status only. Wallet balances,
 * reservation amounts, account details and transaction identifiers remain
 * private to the financial system.
 */
export async function getErrandSecurityDepositVerification(client, errand) {
    if (!errand?.id || !errand?.assigned_erander_id || !errand?.accepted_offer_id) {
        return {
            status: "not_secured",
            secured: false,
            reason: "ASSIGNMENT_OR_ACCEPTED_OFFER_MISSING",
        };
    }

    const result = await client.query(
        `
            SELECT
                r.id,
                r.amount_minor,
                r.currency_code,
                r.status AS reservation_status,
                s.account_status,
                s.required_deposit_percent,
                s.deposit_requirement_waived,
                o.proposed_total,
                o.currency_code AS offer_currency_code,
                (r.amount_minor::numeric = o.proposed_total * 100) AS amount_matches_agreement,
                (
                    SELECT COUNT(*)::integer
                    FROM public.erander_security_deposit_transactions st
                    INNER JOIN public.wallet_transactions wt
                        ON wt.id = st.wallet_transaction_id
                    INNER JOIN public.wallets w
                        ON w.id = wt.wallet_id
                    WHERE st.reservation_id = r.id
                      AND st.security_account_id = s.id
                      AND st.erand_id = r.erand_id
                      AND st.transaction_type = 'reservation'
                      AND st.status = 'succeeded'
                      AND st.amount_minor = r.amount_minor
                      AND st.currency_code = r.currency_code
                      AND wt.type = 'reservation'
                      AND wt.status = 'successful'
                      AND wt.amount_minor = r.amount_minor
                      AND wt.currency_code = r.currency_code
                      AND wt.related_erand_id = r.erand_id
                      AND w.profile_id = s.erander_id
                      AND w.currency_code = r.currency_code
                      AND (
                          SELECT COUNT(*)
                          FROM public.wallet_ledger_entries le
                          WHERE le.transaction_id = wt.id
                      ) >= 2
                      AND (
                          SELECT COALESCE(SUM(le.amount_minor), 0)
                          FROM public.wallet_ledger_entries le
                          WHERE le.transaction_id = wt.id
                            AND le.entry_side = 'debit'
                      ) = r.amount_minor
                      AND (
                          SELECT COALESCE(SUM(le.amount_minor), 0)
                          FROM public.wallet_ledger_entries le
                          WHERE le.transaction_id = wt.id
                            AND le.entry_side = 'credit'
                      ) = r.amount_minor
                ) AS valid_reservation_transactions
            FROM public.erander_security_deposit_reservations r
            INNER JOIN public.erander_security_deposit_accounts s
                ON s.id = r.security_account_id
            INNER JOIN public.erand_offers o
                ON o.id = $2::uuid
               AND o.erand_id = r.erand_id
            WHERE r.erand_id = $1::uuid
              AND s.erander_id = $3::uuid
            ORDER BY r.created_at DESC, r.id DESC
        `,
        [errand.id, errand.accepted_offer_id, errand.assigned_erander_id],
    );

    if (result.rowCount === 0) {
        return {
            status: "not_secured",
            secured: false,
            reason: "RESERVATION_NOT_FOUND",
        };
    }

    // Multiple reservations for the same errand are ambiguous and must never
    // be treated as proof of a valid security deposit.
    if (result.rowCount !== 1) {
        return {
            status: "unsuccessful",
            secured: false,
            reason: "MULTIPLE_RESERVATIONS_FOUND",
        };
    }

    const reservation = result.rows[0];

    if (reservation.reservation_status === "pending") {
        return {
            status: "processing",
            secured: false,
            reason: "RESERVATION_PROCESSING",
        };
    }

    const isSecured =
        reservation.reservation_status === "reserved" &&
        reservation.account_status === "active" &&
        Number(reservation.required_deposit_percent) === 100 &&
        reservation.deposit_requirement_waived !== true &&
        reservation.currency_code === reservation.offer_currency_code &&
        reservation.amount_matches_agreement === true &&
        Number(reservation.valid_reservation_transactions) === 1;

    if (isSecured) {
        return {
            status: "secured",
            secured: true,
            reason: null,
        };
    }

    return {
        status: "unsuccessful",
        secured: false,
        reason: "RESERVATION_VERIFICATION_FAILED",
    };
}
