# VINISWIM — latest deployment build
Build: success
Source commit: b04db52292f2f599e60c64dfcebbfa80ef1f1fcd
~~~
npm warn deprecated whatwg-encoding@3.1.1: Use @exodus/bytes instead for a more spec-conformant and faster implementation
npm warn deprecated recharts@2.15.4: 1.x and 2.x branches are no longer active. Bump to Recharts v3 to receive latest features and bugfixes. See https://github.com/recharts/recharts/wiki/3.0-migration-guide

added 242 packages in 12s

> @viniswim/shared@0.1.0 build
> tsc -p tsconfig.json


> @viniswim/web@0.1.0 build
> tsc -b && vite build --base=./

[36mvite v7.1.7 [32mbuilding for production...[36m[39m
transforming...
[32m✓[39m 2066 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                 [39m[1m[2m  0.85 kB[22m[1m[22m[2m │ gzip:   0.42 kB[22m
[2mdist/[22m[2massets/[22m[35mindex-CWAe71Xx.css  [39m[1m[2m 34.73 kB[22m[1m[22m[2m │ gzip:   7.56 kB[22m
[2mdist/[22m[2massets/[22m[36mindex-BBo1-WgR.js   [39m[1m[33m861.25 kB[39m[22m[2m │ gzip: 239.49 kB[22m
[33m
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.[39m
[32m✓ built in 3.13s[39m
~~~
