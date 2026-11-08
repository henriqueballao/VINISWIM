# VINISWIM — latest deployment build
Build: failure
Source commit: 84463a49ed9f27f82dbd06b51a58035670c99b14
~~~
npm warn deprecated whatwg-encoding@3.1.1: Use @exodus/bytes instead for a more spec-conformant and faster implementation
npm warn deprecated recharts@2.15.4: 1.x and 2.x branches are no longer active. Bump to Recharts v3 to receive latest features and bugfixes. See https://github.com/recharts/recharts/wiki/3.0-migration-guide

added 242 packages in 13s

> @viniswim/shared@0.1.0 build
> tsc -p tsconfig.json


> @viniswim/web@0.1.0 build
> tsc -b && vite build --base=./

src/ViniOriginalLayout.tsx(19,52): error TS2345: Argument of type 'string | null' is not assignable to parameter of type 'string'.
  Type 'null' is not assignable to type 'string'.
npm error Lifecycle script `build` failed with error:
npm error code 1
npm error path /home/runner/work/VINISWIM/VINISWIM/commercial/apps/web
npm error workspace @viniswim/web@0.1.0
npm error location /home/runner/work/VINISWIM/VINISWIM/commercial/apps/web
npm error command failed
npm error command sh -c tsc -b && vite build --base=./
~~~
