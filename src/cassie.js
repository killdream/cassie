/******************************************************************************
 *                                  ~cassie~                                  *
 *                                ‾‾‾‾‾‾‾‾‾‾‾‾                                *
 * Simple future library for JS. Ready to be violently raped by Ajax!         *
 *     _________________________________________________________________      *
 *        Copyright (c) 2011 Quildreen Motta // Licenced under MIT/X11        *
 ******************************************************************************/

//// Module Cassie /////////////////////////////////////////////////////////////
//
// Cassie (short for lil' Cassandra) is a deliciously short future
// library for JavaScript. It provides a simple Promise object that can
// be used as the return value of any asynchronous call.
//
// The idea behind promises is that you can manipulate the return value
// of an asynchronous function before the function has been
// resolved. This allows you to write in a clear chaining DSL rather
// than using a clusterfuck of callbacks.
//
// Take an Ajax request, for example. The usual way::
//
//     var req = ajax.get('data.json'
//               , function (resp) { /* success */
//                   req.update('#data', JSON.parse(resp.responseText))
//               }
//               , function (resp) { /* fail */
//                   req.show_error()
//               })
//     setTimeout(req.fail, 10000)
//
// With promises, you could get this::
//
//     var req = ajax.get('data.json')
//                   .ok().update('#data')
//                   .failed().show_error()
//                   .timeout(10)
//
// You can pass this ``req`` object around, and other functions can add
// their own manipulations to the object as well::
//
//     function log_it(req) {
//         return req.ok(log('success'))
//                   .failed(log('failed'))
//                   .clear_timer() /* disables the timeout */
//     }
//     var req = log_it(ajax.get('data.json').timeout(10))
//

'@cassie',
function (root) {
    __old_cassie = root.cassie
    if (typeof exports == 'undefined')
        mod = root.cassie = root.cassie || {}
    else
        mod = exports


    var mod, __old_cassie
      , slice = Array.prototype.slice

      // Constants with values for errors
      , forgotten = {}
      , timeouted = {}

      // Error objects
      , EFulfilled   = new Error('Promise already fulfilled.')
      , EUnfulfilled = new Error('Promise not fulfilled.')



    ////// ~Method clean ///////////////////////////////////////////////////////
    // ::
    //     clean() → Obj cassie
    // 
    // Gives back control of the global `cassie' property to the value
    // it had before the module has been required/executed.
    //
    // Returns the main cassie object.
    //
    mod.clean = function () {
        root.cassie = __old_cassie
        return mod
    }



    ///// Object Promise ///////////////////////////////////////////////////////
    //
    // Creates a deferred object, that can be manipulated before the
    // value is actually resolved. As soon as it is fulfilled, this
    // promise will apply the pending actions.
    //
    // You can either return the promise directly, or take full
    // advantage of it by inheriting the ``Promise``'s prototoype and
    // adding your own custom methods.
    //
    function Promise () {
        this.callbacks = {}
        this.value     = null
        this.timer     = null
        this.defaultev = 'done'
    }
    Promise.prototype = function() {
        return { add:         add
               , flush:       flush
               , done:        done
               , bind:        bind
               , fail:        fail
               , timeout:     timeout
               , clear_timer: clear_timer
               , forget:      forget

               // Shortcuts for add(event[, callback])
               , ok:          ok
               , failed:      failed
               , timeouted:   _timeouted
               , forgotten:   _forgotten }



        ////// Function add_callback ///////////////////////////////////////////
        // ::
        //     add_callback(Obj promise, Str event, Fn callback) → Fn
        //
        // Adds a callback to a ``Promise``.
        //
        // The callback will be called whenever the given event happens
        // within the given promise, in the context of the promise (ie.:
        // ``this`` inside the callback will refer to the given promise)
        // and the arguments provided when the promise was fulfilled.
        //
        // Returns the given callback function.
        //
        function add_callback(promise, event, callback) {
            if (!promise.callbacks[event]) promise.callbacks[event] = []
            promise.callbacks[event].push(callback)
            return callback
        }


        ////// Function resolve ////////////////////////////////////////////////
        // ::
        //     resolve(Obj promise, ArrayLike value) → ArrayLike
        //
        // Resolves the value of the given promise.
        //
        // The given value array is cloned, then assigned to the
        // promise. This makes it easier for caller functions to just
        // pass the ``arguments`` object straight up to this function.
        //
        // If the promise's value has already been resolved, we throw an
        // error, since a promise can only be resolved once.
        //
        function resolve(promise, value) {
            if (promise.value) throw EFulfilled
            promise.clear_timer()
            return promise.value = slice.call(value)
        }


        ////// Method add //////////////////////////////////////////////////////
        // ::
        //     add(Str event[, Fn callback]) → Promise
        //
        // Adds a callback to the ``Promise``.
        //
        // Passing a callback directly to the add method is optional, to
        // leverage more specialized promises, Cassie supports defining
        // a default event to which callbacks are bound.
        // 
        // For example, instead of writting the following::
        // 
        //     promise.add('ok', foo).add('ok', bar)
        // 
        // You could go with::
        // 
        //     promise.add('ok').foo().bar()
        // 
        // Of course, given you have a specialized promise implementing
        // `foo` and `bar`.
        // 
        // The default event persists until another `add` call with an
        // explicit event is issued.
        // 
        // See :fn:`add_callback` for more information.
        //
        function add(event, callback) {
            if (arguments.length > 1)
                this.defaultev = event
            else {
                callback = event
                event    = this.defaultev }

            if (this.value && callback) callback.apply(this, this.value)
            else                        add_callback(this, event, callback)

            return this
        }


        ////// Method flush ////////////////////////////////////////////////////
        // ::
        //     flush(Str event) → Promise
        //
        // Calls all callbacks associated with the given event.
        //
        // The callbacks are called in the context of this ``Promise``
        // (ie.: ``this`` inside such callback will refer to this
        // ``Promise``), and with any arguments that have been passed to
        // the promise when it was fulfilled.
        //
        function flush(event) {
            var callbacks = this.callbacks[event] || []
              , current

            if (this.value === null) throw EUnfulfilled
            while (current = callbacks.shift())
                current.apply(this, this.value)

            return this
        }


        ////// Method done /////////////////////////////////////////////////////
        // ::
        //     done(Str status, ArrayLike values) → Promise
        //
        // Resolves the promise to the given values and call both the
        // callbacks defined for the ``status`` to which the promise has
        // been resolved, and the ``done`` callbacks.
        //
        // See :fn:`resolve` for more information on how all this stuff
        // is resolved.
        //
        function done(status, values) {
            resolve(this, values)
            return this.flush(status).flush('done')
        }


        ////// Method fail /////////////////////////////////////////////////////
        // ::
        //     fail(Obj error) → Promise
        //
        // Fails to fulfill the promise, and calls all the ``fail``
        // callbacks passing the error as parameter.
        //
        // See :fn:`done` for more information.
        //
        function fail() {
            return this.done('fail', arguments)
        }


        ////// Method bind /////////////////////////////////////////////////////
        // ::
        //     bind(values...) → Promise
        //
        // Successfully fulfills the promise, and calls the ``bind``
        // callbacks passing the values as parameter.
        //
        // See :fn:`resolve` for more information.
        //
        function bind() {
            return this.done('ok', arguments)
        }


        ////// Method timeout //////////////////////////////////////////////////
        // ::
        //     timeout(Num delay) → Promise
        //
        // Fails to fulfill the promise after the given number of
        // seconds.
        //
        // The promise fails with the value of ``timeouted``.
        //
        function timeout(delay) {
            var promise = this
            this.timer = setTimeout(function(){
                promise.fail(timeouted)
                promise.flush('timeouted')
            }, delay * 1000)
            return this
        }


        ////// Method clear_timer //////////////////////////////////////////////
        // ::
        //     clear_timer() → Promise
        //
        // Clears any timer that may exist for this promise.
        //
        function clear_timer() {
            clearTimeout(this.timer)
            return this
        }


        ////// Method forget ///////////////////////////////////////////////////
        // ::
        //     forget() → Promise
        //
        // Cancels the promise, and fails with the value of ``forgotten``.
        //
        function forget() {
            this.fail(forgotten)
            return this.flush('forgotten')
        }


        ////// -Shortcuts for add(event[, callback]) //////////////////////////
        function ok(fn)         { return this.add('ok',        fn) }
        function failed(fn)     { return this.add('fail',      fn) }
        function _timeouted(fn) { return this.add('timeouted', fn) }
        function _forgotten(fn) { return this.add('forgotten', fn) }
    }()


    ///// Exṕorts //////////////////////////////////////////////////////////////
    mod.Promise      = Promise
    mod.forgotten    = forgotten
    mod.timeouted    = timeouted
    mod.EFulfilled   = EFulfilled
    mod.EUnfulfilled = EUnfulfilled
}(this)