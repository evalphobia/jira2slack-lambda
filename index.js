/* jshint: indent:2 */
var config = require('./config.json'),
  notifier = require('./src/notifier');


/**
  main routine
*/
module.exports = {
  handler: function (event, context) {
    console.log("invoke App.handler")
    console.log("event: " + JSON.stringify(event));
    if (typeof event.body === 'string') {
      event.body = JSON.parse(event.body);
    }

    try {
      notifier.notify(context, event.user_key, event.body);
    } catch (e) {
      console.log('[exeption]');
      console.log(e);
    }
  }
}