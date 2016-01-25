import EventEmitter from 'eventemitter3';


/**
 * Extension of a regular EventEmitter that provides a method
 * that returns a Promise then resolved when all listeners of the event
 * will be resolved.
 */
/* istanbul ignore next */
export default class AsyncEventEmitter extends EventEmitter {

  /**
   * Emit an event and return a Promise that will be resolved
   * when all listeren's Promises will be resolved.
   * @param  {String} event
   * @return {Promise}
   */
  emitAsync(event, a1, a2, a3, a4, a5) {
    const prefix = EventEmitter.prefixed;
    const evt = prefix ? prefix + event : event;

    if (!this._events || !this._events[evt]) {
      return Promise.resolve();
    }

    let i;
    const listeners = this._events[evt];
    const len = arguments.length;
    let args;

    if ('function' === typeof listeners.fn) {
      if (listeners.once) {
        this.removeListener(event, listeners.fn, undefined, true);
      }

      switch (len) {
        case 1: return Promise.resolve(listeners.fn.call(listeners.context));
        case 2: return Promise.resolve(listeners.fn.call(listeners.context, a1));
        case 3: return Promise.resolve(listeners.fn.call(listeners.context, a1, a2));
        case 4: return Promise.resolve(listeners.fn.call(listeners.context, a1, a2, a3));
        case 5: return Promise.resolve(listeners.fn.call(listeners.context, a1, a2, a3, a4));
        case 6: return Promise.resolve(listeners.fn.call(listeners.context, a1, a2, a3, a4, a5));
      }

      for (i = 1, args = new Array(len -1); i < len; i++) {
        args[i - 1] = arguments[i];
      }

      return Promise.resolve(listeners.fn.apply(listeners.context, args));
    } else {
      const promises = [];
      const length = listeners.length;
      let j;

      for (i = 0; i < length; i++) {
        if (listeners[i].once) {
          this.removeListener(event, listeners[i].fn, undefined, true);
        }

        switch (len) {
          case 1: promises.push(Promise.resolve(listeners[i].fn.call(listeners[i].context))); break;
          case 2: promises.push(Promise.resolve(listeners[i].fn.call(listeners[i].context, a1))); break;
          case 3: promises.push(Promise.resolve(listeners[i].fn.call(listeners[i].context, a1, a2))); break;
          default:
            if (!args) {
              for (j = 1, args = new Array(len -1); j < len; j++) {
                args[j - 1] = arguments[j];
              }
            }
            promises.push(Promise.resolve(listeners[i].fn.apply(listeners[i].context, args)));
        }
      }

      return Promise.all(promises);
    }
  }
}
