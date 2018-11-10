## ![Antares](http://www.deanius.com/AntaresLogo.png)

Antares is an architecture for real-time web apps. <a href="https://s3.amazonaws.com/www.deanius.com/antares-tag.m4a" target="_blank">🔊</a>

![ES 2015](https://img.shields.io/badge/ES-2015-brightgreen.svg)
[![npm version](https://badge.fury.io/js/antares-protocol.svg)](https://badge.fury.io/js/antares-protocol)
[![<22 kb](https://img.shields.io/badge/gzip%20size-%3C22%20kB-brightgreen.svg)](https://www.npmjs.com/package/antares-protocol)
[![Travis](https://img.shields.io/travis/deanius/antares-ts.svg)](https://travis-ci.org/deanius/antares)
[![Appveyor for Windows](https://ci.appveyor.com/api/projects/status/udjy5549kiy5sk4a/branch/master?svg=true)](https://ci.appveyor.com/project/deanius/antares/branch/master)
[![Greenkeeper badge](https://badges.greenkeeper.io/deanius/antares-ts.svg)](https://greenkeeper.io/)

[![Dev Dependencies](https://david-dm.org/deanius/antares-ts/dev-status.svg)](https://david-dm.org/deanius/antares?type=dev)
![npm type definitions](https://img.shields.io/npm/types/chalk.svg)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![try on runkit](https://badge.runkitcdn.com/antares-protocol.svg)](https://npm.runkit.com/antares-protocol)
![twitter link](https://img.shields.io/badge/twitter-@deaniusaur-55acee.svg)

## What Exactly Is Antares?

An Architecture for assigning Consequences to Events.

## What kinds of apps can I build with it?

Web Browser, Console, Web Socket, REST, Server - you name it.

## Testing? Yes, please!

Antares is highly tested. And since testing async is hard, some integration level tests run a bunch of complex stuff (our [demos](#demos)), and simply assert on the console output. The slightest change in behavior can thus be visible in the output of the demo as a large change. This, with Jest Snapshot testing makes asserting on our output a piece of cake.

For unit tests, check out [what the unit test suite looks like](https://travis-ci.org/deanius/antares-ts/jobs/403257425#L139) on a recent CI build. (Thanks to Dan Abromov for illustrating in his 2015 `react-dnd/dnd-core` project what a nicely formatted test suite output can be)

## Demos!

Antares has demos whose output is tested in CI on MacOS, Linux, and Windows. Because concurrency must be interacted with to truly be understood, many of the demos support you interacting with them in a console, or at least changing their parameters in config (`demos/config.js`)

```
> git clone https://github.com/deanius/antares-ts antares
> cd antares; npm i
> npm run demos                         # run 'em all
```

See the output of a run of all demos on [Travis CI](https://travis-ci.org/deanius/antares-ts/jobs/402981544#L681), and if you run them locally, make sure you have sound turned on! (It's a core principle of Antares that not all renders are to a DOM)

Here are some more ways you can run demos, including using [`cross-env`](https://www.npmjs.com/package/cross-env) on windows

```
> DEMO=muteFruit INTERACTIVE=1 node demos/index
> DEMO=muteFruit inner=100 outer=100 node demos/index
> cross-env DEMO=muteFruit inner= node demos/index
```

## Show your love!

- Display a badge on your project: ![I ♥️ Antares](https://img.shields.io/badge/built--with-antares-blue.svg)
- Donate to the project [![to the project](https://img.shields.io/badge/donate-paypal-blue.svg)](https://paypal.me/deanius), or somewhere you think you can pay it forward, even if not here!

## Gratitude, Props, Thanks To

- Dan Abramov - [Redux](https://redux.js.org) ![twitter](https://img.shields.io/badge/twitter-@dan_abramov-55acee.svg)
- Martin Kleppmann - [Turning the Database Inside Out](https://www.confluent.io/blog/turning-the-database-inside-out-with-apache-samza/) ![twitter](https://img.shields.io/badge/twitter-@martinkl-55acee.svg)
- Alex Jover Morales - [Typescript Library Starter](https://github.com/alexjoverm/typescript-library-starter) ![twitter](https://img.shields.io/badge/twitter-@alexjoverm-55acee.svg)
- All who worked on [RxJS](https://github.com/ReactiveX/rxjs), [Redux Observable](https://redux-observable.js.org/)
- Bob Martin - [Clean Architecture](https://8thlight.com/blog/uncle-bob/2012/08/13/the-clean-architecture.html)<img src="https://8thlight.com/blog/assets/posts/2012-08-13-the-clean-architecture/CleanArchitecture-8d1fe066e8f7fa9c7d8e84c1a6b0e2b74b2c670ff8052828f4a7e73fcbbc698c.jpg"/>

---

![Antares](http://www.deanius.com/AntaresLogo.png)
