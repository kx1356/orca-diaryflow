# Vendor: siyuan-diaryflow

Snapshot of the upstream SiYuan Moments plugin used as the build base for `orca-diaryflow`.

- `index.js` / `index.css` / `icon.png` — copied from a local SiYuan install
- Build reads this directory by default (`build.mjs`)
- Override with env: `SIYUAN_DIARYFLOW_SRC=/path/to/siyuan-diaryflow`

Do not edit these files in place for Orca adaptations — use `patches/` instead.
