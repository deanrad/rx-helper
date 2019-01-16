## Rx-Helper

Rx-Helper is a way to construct real-time web apps - web apps that have
essentially banished the notion of stale data from their repertoire,
and are configured to share and respond with data at the speed modern
users expect.

![ES 2015](https://img.shields.io/badge/ES-2015-brightgreen.svg)
[![npm version](https://badge.fury.io/js/rx-helper.svg)](https://badge.fury.io/js/rx-helper)
[![<22 kb](https://img.shields.io/badge/gzip%20size-%3C22%20kB-brightgreen.svg)](https://www.npmjs.com/package/rx-helper)
[![Travis](https://img.shields.io/travis/deanius/antares.svg)](https://travis-ci.org/deanius/antares)
[![Appveyor for Windows](https://ci.appveyor.com/api/projects/status/udjy5549kiy5sk4a/branch/master?svg=true)](https://ci.appveyor.com/project/deanius/antares/branch/master)
[![Greenkeeper badge](https://badges.greenkeeper.io/deanius/antares.svg)](https://greenkeeper.io/)

[![Dev Dependencies](https://david-dm.org/deanius/antares/dev-status.svg)](https://david-dm.org/deanius/antares?type=dev)
![npm type definitions](https://img.shields.io/npm/types/chalk.svg)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![try on runkit](https://badge.runkitcdn.com/rx-helper.svg)](https://npm.runkit.com/rx-helper)
![twitter link](https://img.shields.io/badge/twitter-@deaniusol-55acee.svg)

```
npm install -S rxjs rx-helper
```

## What Is Rx-Helper?

A library to help you use the power of RxJS to:

- Modularize your apps, building out from a core of framework-independent logic
- Stub out unknowns so you can get right to work on the essence of your application
- Have a clean architecture that allows you to swap out UI frameworks, persistence tiers, or _any other component_ while leaving most of your program unchanged.

Like JQuery enabled a boom in productivity by paving over differences between browsers, Rx-Helper allows you to pave over differences between:

- Client/server programming style
- One UI framework and another
- Data that's available now, and data that's available later

This last point is very powerful - and if you've already hit up against the many limitations of `async`/`await` and Promises, this can help you stay clear of them.

## What Benefits Can I Get By Using It?

- A [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) of code with a high degree of decoupling and fault-tolerance.
- A clean, cancelable model of async effects, not dependent on a component toolkit like React
- Kickstart your apps' development by building abstractions that simulate input or output, allowing you to focus on the core functionality, of your app
- Understand and use the Observable datatype - a type that is a superset of Promise, and which can stand in for processes that feed your app data, or processes that cause consequences to the outside world.
- Drive your app during testing with 'simulated user interaction' to see more of its functionality without clicking around.
- Use snapshot testing to verify your app's behavior, whether or not it uses React or even has a UI.

## What kinds of apps can I build with it?

Rx-Helper, with RxJS, manages consequences, which any app has, so it's not limited to client or server, or even Web Apps.

There are many demo apps included in this project that show what you can build.

- A console app that speaks names and writes to a file
- A utility that turns all-at-the-end AJAX requests for arrays into streaming Observables (eg `/users/`)
- A Web Server in [demos/express/index.js](//github.com/deanius/antares/blob/master/demos/express/index.js)
- A Canvas-based requestAnimationFrame animation.
- A Console app that detects a cheat-code of 5 clicks in a short interval.
- A Web Audio app that streams and queues up music from attachments in your Inbox.
- An IOT application interfacing with Raspberry Pi GPIO _(Coming Soon)_

## OK, but where should I start?

The [Wiki](https://github.com/deanius/rx-helper/wiki/Rx-Helper:-An-Introduction) is a great place and has some case-studies.

If you're interested in learning more, or updating me on your progress, [tweet me](//twitter.com/deaniusol)!

## What's the TL;DR?

The 4 Principles:

1.  An `agent` processes Flux Standard Actions given it through either `agent.process` or `agent.subscribe`
1.  Actions are synchronously processed through functions given to `agent.filter` or `addFilter`
1.  ...and asynchronously processed through functions known as renderers, configured via `agent.on`.
1.  Renderer functions may produce consequences (i.e. effects, or side-effects) return [Observables](https://github.com/tc39/proposal-observable) of new actions to be processed, specify a concurrency mode and be run with other [options](https://deanius.github.io/antares/docs/interfaces/subscriberconfig.html)

## Testing? Yes, please!

Rx-Helper is highly tested. And since testing async is hard, some integration level tests run a bunch of complex stuff (our [demos](#demos)), and simply assert on the console output. The slightest change in behavior can thus be visible in the output of the demo as a large change. This, with Jest Snapshot testing makes asserting on our output a piece of cake.

For unit tests, check out [what the unit test suite looks like](https://travis-ci.org/deanius/antares-ts/jobs/403257425#L139) on a recent CI build. (Thanks to Dan Abromov for illustrating in his 2015 `react-dnd/dnd-core` project what a nicely formatted test suite output can be)

Rx-Helper has unit tests, and demos whose output is tested in CI on MacOS, Linux, and Windows. See the output of a run of all demos on [Travis CI](https://travis-ci.org/deanius/antares-ts/jobs/402981544#L681), and if you run them locally, make sure you have sound turned on!

## Show your love!

- Display a badge on your project: ![I ♥️ Rx-Helper](https://img.shields.io/badge/built%20with-rx--helper-blue.svg)

## Gratitude, Props, Thanks To

- Dan Abramov - [Redux](https://redux.js.org) ![twitter](https://img.shields.io/badge/twitter-@dan_abramov-55acee.svg)
- Martin Kleppmann - [Turning the Database Inside Out](https://www.confluent.io/blog/turning-the-database-inside-out-with-apache-samza/) ![twitter](https://img.shields.io/badge/twitter-@martinkl-55acee.svg)
- Alex Jover Morales - [Typescript Library Starter](https://github.com/alexjoverm/typescript-library-starter) ![twitter](https://img.shields.io/badge/twitter-@alexjoverm-55acee.svg)
- All who worked on [RxJS](https://github.com/ReactiveX/rxjs), [Redux Observable](https://redux-observable.js.org/)
- Bob Martin - [Clean Architecture](https://8thlight.com/blog/uncle-bob/2012/08/13/the-clean-architecture.html)<img src="https://8thlight.com/blog/assets/posts/2012-08-13-the-clean-architecture/CleanArchitecture-8d1fe066e8f7fa9c7d8e84c1a6b0e2b74b2c670ff8052828f4a7e73fcbbc698c.jpg"/>

---
