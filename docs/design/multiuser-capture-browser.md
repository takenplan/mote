# Scoped raw capture readers

This is a read projection over M02 records, M03 immutable originals and M06 published extraction. It keeps the original record timeline, albums, Session groups and central-derived OCR update reader. It does not restore the legacy Store, rewrite intake records, schedule processing, or authorize task replay.

## Routes

An ordinary M01 private client/Web session reads the existing paths:

- `GET /api/capture-browser`: existing date/device/app/source/collection/OCR filters, `limit` and signed `cursor`; filters and total count precede pagination.
- `GET /api/capture-browser/albums`, `/album-images`, `/sessions`: existing observed-time groups and member pages. Session grouping partitions devices before pagination, preserves app returns and gaps over five minutes.
- `GET /api/capture-browser/:id`: raw record plus a current, exactly linked completed M06 extraction for screen OCR. `/api/captures/:id` remains the unchanged intake reader.
- `GET /api/capture-browser/:id/image?thumbnail=1`: current M03 original or generated JPEG thumbnail; scope/source, original identity, current byte availability and original credential are checked before publishing bytes. No shared image cache.
- `GET /api/capture-browser/updates?deviceId=...&cursor=0&limit=20`: the original numeric central-derived OCR update shape.

A device-bound M01 credential remains forbidden from the private paths. Its narrow reader is `GET /api/ingress/devices/:id/updates?cursor=0&limit=20`, requiring Ingress 3 and its exact bound device. A direct account client may also use this ingress route. The response is `{items:[{id,ocr,textPreview,textLength}],nextCursor:number}`. Current source enablement, owner and record visibility still apply.

Only a current M06 publication with exact original membership and a matching `extraction:ready` artifact can supply completed OCR. Summary and image-understanding artifacts cannot replace it. Raw pending/failed/disabled states remain raw states; this increment does not synthesize pending/failed M06 task progress or add a deferred device OCR write endpoint.

## Persistent derived journal

Exact added SQLite schema:

```sql
CREATE TABLE ig_capture_update_sequences(
 user_id TEXT NOT NULL, device_id TEXT NOT NULL, next INTEGER NOT NULL,
 PRIMARY KEY(user_id,device_id)
);
CREATE TABLE ig_capture_updates(
 user_id TEXT NOT NULL, device_id TEXT NOT NULL, sequence INTEGER NOT NULL,
 capture_id TEXT NOT NULL, artifact_id TEXT NOT NULL,
 PRIMARY KEY(user_id,device_id,sequence),
 UNIQUE(user_id,device_id,capture_id,artifact_id),
 FOREIGN KEY(user_id,capture_id) REFERENCES pd_captures(user_id,id) ON DELETE CASCADE
);
```

A synchronous actual M06 publication appends its current extraction once. Allocation and insertion share the existing owner SQL transaction. Counters are scoped by owner and device and survive restart; deleting a capture never reduces the counter. M03 account deletion clears both tables. All `ig_state` writers use explicit `(user_id,deleted)` columns; this increment adds no column to that table.

Each updates read also reconciles at most its requested page size of currently visible exact extraction artifacts missing from the journal. This covers the first current-domain journal installation and same-owner canonical portable import without task admission or an asynchronous import callback. The counter itself is never rebuilt from remaining rows or reset. A cursor greater than the stored device counter returns HTTP409 `invalid_cursor`; a native consumer must re-confirm its current identity and restart that derived reader at zero. It must not keep a future cursor and silently miss later publications.

Personal portable3 excludes these derived tables as receipt/history state. An instance backup must preserve both tables and their columns exactly; permitting extra tables alone does not prove completeness. M16 owns required-schema admission and missing-table/column corruption tests after composing this freeze.

## Narrow evidence and remaining scope

The M13 actual backend suite uses generated M01 accounts, M03 intake/parts, M04 settings and a real M06 task with an external synthetic local HTTP worker. Six cases cover filter-before-LIMIT, signed owner/query pages, original grouping, equal IDs/different users, thumbnail retirement on disable/recreation/released bytes, unchanged intake, completed OCR reads, device-only access, revocation, restart, three-publication numeric pagination, persistent high cursor after delete and bounded reconciliation without readmission. Logs are recorded in `docs/validation/multiuser-m13-web.md`.

Original React timeline/Session renderer plus actual scoped backend has separate narrow evidence. Full image progress commands, historical-source navigation, full Web acceptance, final affected/build/IAB and M12 are not closed by this server freeze.
