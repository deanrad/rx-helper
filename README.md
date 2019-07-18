## Rx-Helper

![ES 2015](https://img.shields.io/badge/ES-2015-brightgreen.svg)
[![npm version](https://badge.fury.io/js/rx-helper.svg)](https://badge.fury.io/js/rx-helper)
[![<22 kb](https://img.shields.io/badge/gzip%20size-%3C22%20kB-brightgreen.svg)](https://www.npmjs.com/package/rx-helper)
[![Travis](https://img.shields.io/travis/deanius/rx-helper.svg)](https://travis-ci.org/deanius/rx-helper)
[![Appveyor for Windows](https://ci.appveyor.com/api/projects/status/udjy5549kiy5sk4a/branch/master?svg=true)](https://ci.appveyor.com/project/deanius/rx-helper/branch/master)
[![Greenkeeper badge](https://badges.greenkeeper.io/deanius/rx-helper.svg)](https://greenkeeper.io/)

[![Dev Dependencies](https://david-dm.org/deanius/rx-helper/dev-status.svg)](https://david-dm.org/deanius/rx-helper?type=dev)
![npm type definitions](https://img.shields.io/npm/types/chalk.svg)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![try on runkit](https://badge.runkitcdn.com/rx-helper.svg)](https://npm.runkit.com/rx-helper)
![twitter link](https://img.shields.io/badge/twitter-@deaniusol-55acee.svg)

```
npm install -S rxjs rx-helper
```

## What Is Rx-Helper?

Rx-Helper is a library to help you use the power of RxJS to:

- Modularize your apps, building out from a core of framework-independent logic
- Stub out unknowns so you can get right to work on the essence of your application
- Have a clean architecture that allows you to swap out UI frameworks, persistence tiers, or _any other component_ while leaving most of your program unchanged.

## What's the TL;DR?

Overview:

1.  An `app`, (instance of `Agent`) processes events with a `type` field (Flux Standard Actions) through either `process`/`trigger`, or `subscribe`, if the events are part of an Observable already.
1.  Events are synchronously processed through functions attached via `filter`, and asynchronously processed through listener functions, attached via `on`.
1.  Listeners specify a concurrency mode (`parallel`, `serial`, `cutoff`, `mute`) in case events come in while they are still running an async operations.
1.  Listener functions may in turn raise events, by returning [Observables](https://github.com/tc39/proposal-observable) of new events.

## What Benefits Can I Get By Using It?

- A [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) of code with a high degree of decoupling and fault-tolerance.
- A clean, cancelable model of async effects, compatible with, but not dependent on a component library like React or Angular.
- Faster prototyping by building abstrrctions that simulate input or output, allowing you to focus on the core functionality of your app.
- Familiarity with the Observable datatype - a type that is a superset of Promise, and which can stand in for users, databases, servers, or any number of .

## What kinds of apps can I build with it?

There are many demo apps included in this project that show what you can build.

- A console app that writes names to a file, and speaks them aloud
- A utility that turns all-at-the-end AJAX requests for arrays (eg `/users/`) into streaming Observables
- A [Web Server](//github.com/deanius/rx-helper/blob/master/demos/express/index.js)
- A Canvas-based requestAnimationFrame animation.
- A Console app that detects a cheat-code of 5 clicks in a short interval.
- A Web Audio app that streams and queues up music from attachments in your Inbox.
- An IOT application interfacing with Raspberry Pi GPIO

## OK, but where should I start?

The [Wiki](https://github.com/deanius/rx-helper/wiki/Rx-Helper:-An-Introduction) is a great place and has some case-studies.

If you're interested in learning more, or updating me on your progress, [tweet me](//twitter.com/deaniusol)!

## Testing? Yes, please!

Rx-Helper is highly tested. And since testing async is hard, some integration level tests run a bunch of complex stuff (our [demos](#demos)), and simply assert on the console output. The slightest change in behavior can thus be visible in the output of the demo as a large change. This, with Jest Snapshot testing makes asserting on our output a piece of cake.

## Show your love!

- Display a badge on your project: ![I ♥️ Rx-Helper](https://img.shields.io/badge/built%20with-rx--helper-blue.svg)

## Gratitude, Props, Thanks To

- Dan Abramov - [Redux](https://redux.js.org) ![twitter](https://img.shields.io/badge/twitter-@dan_abramov-55acee.svg)
- Martin Kleppmann - [Turning the Database Inside Out](https://www.confluent.io/blog/turning-the-database-inside-out-with-apache-samza/) ![twitter](https://img.shields.io/badge/twitter-@martinkl-55acee.svg)
- Alex Jover Morales - [Typescript Library Starter](https://github.com/alexjoverm/typescript-library-starter) ![twitter](https://img.shields.io/badge/twitter-@alexjoverm-55acee.svg)
- All who worked on [RxJS](https://github.com/ReactiveX/rxjs), [Redux Observable](https://redux-observable.js.org/)
- Bob Martin - [Clean Architecture](https://8thlight.com/blog/uncle-bob/2012/08/13/the-clean-architecture.html)<img src="https://8thlight.com/blog/assets/posts/2012-08-13-the-clean-architecture/CleanArchitecture-8d1fe066e8f7fa9c7d8e84c1a6b0e2b74b2c670ff8052828f4a7e73fcbbc698c.jpg"/>

---
