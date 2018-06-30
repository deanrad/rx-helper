const clocks = "🕛🕐🕑🕒🕓🕔🕕🕖🕗🕘🕙🕚".split("")
module.exports = ({ AntaresProtocol, config = {}, log, append, interactive = false }) => {
  const sessionOutput = `
Press a key five times in a second to get a star (✨🌟✨), or 'x' to eXit:
🕛
🕐
🕑
🕒
🕓
🕕 🕕 🕕 🕕 🕕
✨🌟✨
 *You got it!*

 Bye
`
  log(sessionOutput, config)
}
