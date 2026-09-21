# RCA — Deploy run d8dbdeab-2d73-4e1c-b993-3d3d1a7e1cfe (immo-traeum-preview)

## Outcome
Deploy **failed at `build_image`** (Cloud/CodeBuild). Backend compiled fine; the failure is in the **frontend build** (`yarn build`). This is a **source-level CSS fault** — NOT a deployment/manifest problem. It must be fixed in the app source, then redeployed.

## Failure signature (from build logs)
```
Failed to compile.
static/css/main.00c6faab.css from Css Minimizer plugin
Error: Unexpected '/'. Escaping special characters with \ may help.
error Command failed with exit code 1.
```
(The later `ERROR: ...customers-app:<tag>: not found` line is just a downstream symptom — the image was never pushed because the build had already failed.)

## Root cause
`frontend/src/index.css` contains light-mode override selectors that target Tailwind opacity-modifier classes (e.g. `text-white/80`). The escape for the `/` in these selectors is written with **two backslashes** (`\\/`) when it must be **one** (`\/`).

In CSS, `\\` is an *escaped literal backslash*, which leaves the following `/` **unescaped**. The production CSS minimizer (css-minimizer-webpack-plugin → cssnano → postcss-selector-parser) then hits the bare `/` and throws `Unexpected '/'`. (The dev server / craco start does not minify, which is why it only breaks on a production build.)

Example of the broken source (line 175):
```
body[data-theme="light"] .text-white\\/80,
```
`.text-white\\/80` → parser sees literal `\` + unescaped `/` → error.

## Affected lines (all in `frontend/src/index.css`)
175, 176, 177, 178, 179, 180, 181, 183, 184, 186, 187, 203, 204, 206, 207
(selectors: `.text-white\\/NN`, `.text-gold-light\\/NN`, `.border-gold\\/NN`)

## Fix (exact)
In `frontend/src/index.css`, replace every `\\/` with `\/` (double-backslash-slash → single-backslash-slash). One-liner:
```
sed -i 's#\\\\/#\\/#g' frontend/src/index.css
```
Result e.g. line 175 becomes:
```
body[data-theme="light"] .text-white\/80,
```

## Verification (performed in the eph sandbox)
Reproduced against the real generated CSS (the sandbox full `yarn install` OOM-kills, so I isolated the exact stage):
1. Compiled the project's Tailwind output using its own `tailwind.config.js` + source — reproduced the identical `duration-[900ms]` warning seen in the real build, confirming matching output.
2. Ran cssnano on that generated CSS → **`MINIFY THREW: Unexpected '/'. Escaping special characters with \ may help.`** (exact match to the build failure).
3. Bisected with postcss-selector-parser → the 6 `\\/` selector blocks above are the ONLY invalid selectors.
4. Applied the `\\/`→`\/` fix to a copy, regenerated, re-ran cssnano → **`MINIFY OK, length 67405`** — the failure no longer reproduces.

## Next step for E1
Apply the fix above in the source environment (`frontend/src/index.css`), then re-trigger the deploy. No manifest or tier change is needed.
