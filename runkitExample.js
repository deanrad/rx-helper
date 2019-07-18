const { interval } = require('rxjs')
const { Agent, after } = require("rx-helper")

const agent = new Agent()
const log = (...args) => console.log(...args)

// 1. Filters - Synchronous functions driven by events
agent.addFilter(({ event }) => {
  console.log('Saw: ' + JSON.stringify(event).replace(/"/g, "'"))
})

// 2. Handlers - Do some work, often async; Return an Observable that the agent can subscribe to.
agent.on('hello', () => after(50, () => {
  log('- Hello World!')
  return 'Zzz'
}), { type: 'fallAsleep', name: 'narcolepsy' });

// 3. You can query all the agent sees, using getNextEvent and allActionsOfType,
// which return Observable<Action> and Promise<Action>, respectively..
agent.getNextEvent('fallAsleep').then(event => {
 console.log('- Current status: ' + event.payload);
})

// 4. Tell the agent things to do (events) by
// calling agent.process(event)
const result = agent.process({ type: 'hello' })

// 5. The result can get a Promise for all handlers that run on account of this event.
result.completed.narcolepsy.then(sound => log('- Good night.' + sound))

// 6. If you have an Observable (such as mouse clicks, or ticks
// of time, its values can be processed in events of a given type.
const sub = agent.subscribe(interval(1000), { type: 'tick' })
sub.add(() => {console.log('Wake up!')})
await after(3500, () => sub.unsubscribe()).toPromise()

/*
Extended Comments

1. Filters run first - You can set up a filter to show all events the agent sees, before they are further processed. If they throw an exception, no handlers are run.
2. Handlers are functions which fire upon events of a certain type, in this case 'hello'.  Its return value, the return value of `after`,
will be an Observable of 'Zzz' after 50 milliseconds. The agent will subscribe to this, and further process these value in the payload of event(s) of type 'snore'
5. result.completed is an aggregate Promise:
result.completed.then(({ narcolepsy }) => ).then(r => log(`Good night. ${narcolepsy}`))
while each handler is available under their name: result.completed.narcolepsy.then(...)

6. If you have an Observable, and you want to process an event for each notification, simply give it to agent.subscribe,
and specify a type argument. End the subscription by calling unsubscribe()
*/
