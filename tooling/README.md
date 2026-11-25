# Migration tooling (WordPress → Next.js)

Two tools, used once at cutover (architecture §5.2–5.3):

| File | What |
| --- | --- |
| `wp-export.php` | Read-only export of the 10 enrollment tables as one JSON snapshot. **Not** the Zeffy table, **not** `ip_address`, `user_agent`, `fbp`, `fbc`. |
| `npm run migrate:wp` (`scripts/migrate-wp.ts`) | Imports a snapshot into Neon (`DATABASE_URL`) or a local PGlite folder (`--pglite <dir>`), with a reconcile report. |
| `import-students-sample.csv` | The bulk-import sample, byte for byte the plugin's. The admin upload page arrives in P3 (`src/lib/server/import/students.ts` holds its logic). |

**A snapshot holds family data.**
- Keep it out of the repository. `.gitignore` refuses `*snapshot*.json` and `/migration/`.
- Delete it after the switch.

## Migration day

1. **Freeze the WordPress form:** "Enroll for Free payment" off, plus the notice on the form pages (§5.3).
2. **Export:**
   - In Novamira, run `execute-php` with the content of `wp-export.php` (without the opening tag).
   - Save the returned JSON as `migration/wp-snapshot.json` on the machine that runs the import.
   - Paste it into a file, not into a chat.
3. **Dry run on a fresh Neon branch.** The import refuses ids that the new system already used.

   ```sh
   NEXT_PUBLIC_SITE_ENV=production DATABASE_URL=… npm run migrate:wp -- --file migration/wp-snapshot.json --dry-run
   ```

   Every row count and money line must show ✓, and the run must end with "OK". Read the warnings: countries with no code, phone numbers kept in the note, actions with no reason.
4. **Import:** the same command without `--dry-run`. A re-run is safe: unchanged rows stay as they are, and a row changed in WordPress is updated.
5. **Check the next ids** in the report: the first Next enrollment gets the IQU number after the highest imported one.

**Outside production** (`NEXT_PUBLIC_SITE_ENV` other than `production`), live Stripe ids are stripped, so a rehearsal on staging never holds a live id:
- customer, subscription, item, session and link-token values are emptied;
- invoice and event ids become `in_stripped…` / `evt_stripped…`.

**Local rehearsal** without Neon: `npm run migrate:wp -- --file <snapshot> --dry-run --pglite ./migration/rehearsal-db`.
