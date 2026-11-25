<?php
/**
 * Ilm-Ul-Quran USA — WordPress → Next.js migration: READ-ONLY snapshot export.
 *
 * Run ONCE, on migration day only, through Novamira `execute-php` (paste this file's
 * content without the opening tag). It returns one JSON string: the snapshot that
 * `npm run migrate:wp -- --file <snapshot.json>` imports. Save the output straight
 * to the machine that runs the import; never commit it (it holds family data).
 *
 * What it reads (plugin iqu-registration 3.7.20, table prefix from $wpdb):
 *   iqu_registrations, iqu_billing_accounts, iqu_billing_members, iqu_billing_payments,
 *   iqu_billing_arrears, iqu_billing_actions, iqu_billing_events, iqu_coupons,
 *   iqu_discount_ledger, iqu_waitlist                                  (the 10 enrollment tables)
 *
 * What it never reads:
 *   - iqu_zeffy_payments: donations stay on WordPress (owner Q14);
 *   - iqu_registrations.ip_address: never copied (owner decision 1);
 *   - iqu_registrations.user_agent, fbp, fbc: the new system never stores a user agent,
 *     and keeps Meta browser ids only with marketing consent (every live row is
 *     "unknown"), so there is no reason to copy them off WordPress.
 *
 * Safety:
 *   - SELECT and SHOW only, inside one READ ONLY transaction WITH CONSISTENT SNAPSHOT,
 *     so every table is read at the same moment and nothing can be written;
 *   - the `checks` block is computed by MySQL itself (counts, integer-cent sums, max ids),
 *     so the importer can reconcile against numbers that did not pass through the JSON rows.
 */

if (!function_exists('iqu_next_snapshot')) {
    function iqu_next_snapshot(): array
    {
        global $wpdb;
        $p = $wpdb->prefix;
        $tables = [
            'iqu_registrations', 'iqu_billing_accounts', 'iqu_billing_members', 'iqu_billing_payments',
            'iqu_billing_arrears', 'iqu_billing_actions', 'iqu_billing_events', 'iqu_coupons',
            'iqu_discount_ledger', 'iqu_waitlist',
        ];
        $exclude = ['iqu_registrations' => ['ip_address', 'user_agent', 'fbp', 'fbc']];

        $out = [
            'format'         => 'iqu-wp-snapshot',
            'version'        => 1,
            'exported_at'    => gmdate('Y-m-d\TH:i:s\Z'),
            'plugin_version' => defined('IQU_VERSION') ? IQU_VERSION : '',
            'site'           => home_url('/'),
            'timezone'       => wp_timezone_string(),
            'datetimes'      => 'UTC', // the plugin writes created_at etc. with gmdate()/current_time('mysql', true)
            'excluded'       => ['tables' => ['iqu_zeffy_payments'], 'columns' => $exclude],
            'tables'         => [],
            'checks'         => [],
        ];

        $wpdb->query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
        try {
            foreach ($tables as $t) {
                $name = $p . $t;
                $cols = $wpdb->get_col("SHOW COLUMNS FROM `{$name}`");
                if (!$cols) throw new RuntimeException("Table {$name} is missing.");
                $cols = array_values(array_diff($cols, $exclude[$t] ?? []));
                $list = implode(', ', array_map(fn($c) => "`{$c}`", $cols));
                $rows = $wpdb->get_results("SELECT {$list} FROM `{$name}` ORDER BY `id`", ARRAY_A);
                if (!is_array($rows)) throw new RuntimeException("Could not read {$name}.");
                $out['tables'][$t] = ['columns' => $cols, 'rows' => $rows];
                $out['checks']['count'][$t]  = (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$name}`");
                $out['checks']['max_id'][$t] = (int) $wpdb->get_var("SELECT COALESCE(MAX(`id`), 0) FROM `{$name}`");
            }

            // Money in integer cents, summed by MySQL from the DECIMAL columns (exact).
            $cents = fn(string $sql) => (int) $wpdb->get_var($sql);
            foreach ((array) $wpdb->get_results("SELECT kind, COUNT(*) n, COALESCE(SUM(ROUND(amount * 100)), 0) c FROM `{$p}iqu_discount_ledger` GROUP BY kind", ARRAY_A) as $r) {
                $out['checks']['ledger'][(string) $r['kind']] = ['rows' => (int) $r['n'], 'cents' => (int) $r['c']];
            }
            $out['checks']['payments'] = [
                'amount_paid_cents'     => $cents("SELECT COALESCE(SUM(ROUND(amount_paid * 100)), 0) FROM `{$p}iqu_billing_payments`"),
                'amount_due_cents'      => $cents("SELECT COALESCE(SUM(ROUND(amount_due * 100)), 0) FROM `{$p}iqu_billing_payments`"),
                'amount_cents'          => $cents("SELECT COALESCE(SUM(ROUND(amount * 100)), 0) FROM `{$p}iqu_billing_payments`"),
                'amount_refunded_cents' => $cents("SELECT COALESCE(SUM(ROUND(amount_refunded * 100)), 0) FROM `{$p}iqu_billing_payments`"),
            ];
            $out['checks']['registrations'] = [
                'payment_amount_cents'  => $cents("SELECT COALESCE(SUM(ROUND(payment_amount * 100)), 0) FROM `{$p}iqu_registrations`"),
                'discount_amount_cents' => $cents("SELECT COALESCE(SUM(ROUND(discount_amount * 100)), 0) FROM `{$p}iqu_registrations`"),
                'agreed_fee_cents'      => $cents("SELECT COALESCE(SUM(ROUND(agreed_fee * 100)), 0) FROM `{$p}iqu_registrations`"),
            ];
            $out['checks']['accounts'] = [
                'monthly_amount_cents' => $cents("SELECT COALESCE(SUM(ROUND(monthly_amount * 100)), 0) FROM `{$p}iqu_billing_accounts`"),
                'net_amount_cents'     => $cents("SELECT COALESCE(SUM(ROUND(net_amount * 100)), 0) FROM `{$p}iqu_billing_accounts`"),
            ];
            $out['checks']['arrears_cents'] = $cents("SELECT COALESCE(SUM(ROUND(amount * 100)), 0) FROM `{$p}iqu_billing_arrears`");
            $out['checks']['coupon_used_count'] = $cents("SELECT COALESCE(SUM(used_count), 0) FROM `{$p}iqu_coupons`");
        } finally {
            $wpdb->query('COMMIT');
        }
        return $out;
    }
}

return wp_json_encode(iqu_next_snapshot(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
