YUI.add('promise-tests', function (Y) {

    var Assert = Y.Assert,
        ArrayAssert = Y.Test.ArrayAssert,
        wait = Y.fulfilledAfter,
        rejectedAfter = Y.rejectedAfter,
        dummy = {dummy: 'dummy'};


    // -- Suite --------------------------------------------------------------------
    var suite = new Y.Test.Suite({
        name: 'Promise tests'
    });

    // -- Lifecycle ----------------------------------------------------------------
    suite.add(new Y.Test.Case({
        name: 'Basic promise behavior',

        // At some point this should be enabled
        /*_should: {
            error: {
                'calling Promise as a function should throw': true
            }
        },

        'calling Promise as a function should throw': function () {
            Promise(function () {});
        },*/

        'promise.then returns a promise': function () {
            var promise = new Promise(function (resolve) {
                resolve(5);
            });

            Assert.isInstanceOf(Promise, promise.then(), 'promise.then returns a promise');
        },

        'fulfilling more than once should not change the promise value': function () {
            var promise = new Promise(function (resolve) {
                resolve(true);
                resolve(5);
            });

            this.isFulfilled(promise, function (value) {
                Assert.areSame(true, value, 'value should remain the same');
            });
        },

        'rejecting more than once should not change the rejection reason': function () {
            var promise = new Promise(function (resolve, reject) {
                reject(new Error('foo'));
                reject(new Error('bar'));
            });

            this.isRejected(promise, function (reason) {
                Assert.areEqual('foo', reason.message, 'reason should remain the same');
            });
        },

        'correct value for `this` inside the promise init function': function () {
            var promise = new Promise(function () {
                Assert.isUndefined(this, '`this` should be a undefined');
            });
        },

        'callbacks passed to then should be called asynchronously': function () {
            var test = this;

            var foo = false;

            var promise = new Promise(function (resolve) {
                resolve();
            }).then(function () {
                foo = true;
                test.resume();
            });

            Assert.areEqual(false, foo, 'callback should not modify local variable in this turn of the event loop');

            test.wait();
        },

        'correct return value for subclasses of Promise': function () {
            function Subclass() {
                Subclass.superclass.constructor.apply(this, arguments);
            }
            Y.extend(Subclass, Promise);
            Subclass._defer = Promise._defer;

            var promise = new Subclass(function () {}).then();

            Assert.isInstanceOf(Promise, promise, 'then() return value should be an instance of Promise');
            Assert.isInstanceOf(Subclass, promise, 'then() return value should be an instance of Subclass');
        }

    }));

    suite.add(new Y.Test.Case({
        name: 'Behavior of the then() callbacks',

        _should: {
            ignore: {
                '`this` inside a callback must be undefined in strict mode': (function () {
                    'use strict';
                    return typeof this !== 'undefined';
                }()),
                '`this` inside a callback must be the global object': (function () {
                    return typeof this === 'undefined';
                }())
            }
        },

        'throwing inside a callback should turn into a rejection': function () {
            var error = new Error('Arbitrary error');

            var promise = new Promise(function (resolve) {
                resolve(5);
            }).then(function (value) {
                throw error;
            });

            this.isRejected(promise, function (reason) {
                Assert.areSame(error, reason, 'thrown error should become the rejection reason');
            });
        },

        'returning a promise from a callback should link both promises': function () {
            var promise = new Promise(function (resolve) {
                resolve('placeholder');
            }).then(function () {
                return new Promise(function (resolve) {
                    resolve(5);
                });
            });

            this.isFulfilled(promise, function (value) {
                Assert.areEqual(5, value, 'new value should be the value from the returned promise');
            });
        },

        // This test is run only when not in strict mode
        '`this` inside a callback must be the global object': function () {
            var test = this,
                fulfilled, rejected,
                resolvedThis, rejectedThis;

            fulfilled = new Promise(function (resolve) {
                resolve('value');
            });
            rejected = new Promise(function (resolve, reject) {
                reject('reason');
            });

            fulfilled.then(function () {
                resolvedThis = this;
                rejected.then(null, function () {
                    rejectedThis = this;
                    test.resume(function () {
                        Assert.areSame(Y.config.global, resolvedThis, 'when not in strict mode `this` in the success callback must be the global object');
                        Assert.areSame(Y.config.global, rejectedThis, 'when not in strict mode `this` in the failure callback must be the global object');
                    });
                });
            });

            test.wait();
        },

        // This test is run only in strict mode
        '`this` inside a callback must be undefined in strict mode': function () {
            'use strict';

            var test = this,
                fulfilled, rejected,
                resolvedThis, rejectedThis;

            fulfilled = new Promise(function (resolve) {
                resolve('value');
            });
            rejected = new Promise(function (resolve, reject) {
                reject('reason');
            });

            fulfilled.then(function () {
                resolvedThis = this;
                rejected.then(null, function () {
                    rejectedThis = this;
                    test.resume(function () {
                        Assert.isUndefined(resolvedThis, 'in strict mode `this` in the success callback must be undefined');
                        Assert.isUndefined(rejectedThis, 'in strict mode `this` in the failure callback must be undefined');
                    });
                });
            });

            test.wait();
        },

        'resolution of a thenable for a thenable that fulfills twice': function () {
            var dummy = { dummy: "dummy" };
            var value = {foo: 'bar'},
                other = {};

            var promise = Promise.resolve(dummy).then(function () {
                return {
                    then: function (resolvePromise) {
                        resolvePromise({
                            then: function (onFulfilled) {
                                onFulfilled({
                                    then: function (onFulfilled) {
                                        setTimeout(function () {
                                            onFulfilled(value);
                                        }, 0);
                                    }
                                });
                                onFulfilled(other);
                            }
                        });
                    }
                };
            });

            this.isFulfilled(promise, function (result) {
                Assert.areSame(value, result);
            });
        },

        'resolution of a thenable for a thenable that fulfills and then throws': function () {
            var value = {foo: 'bar'};

            var promise = Promise.resolve(dummy).then(function () {
                return {
                    then: function (resolvePromise) {
                        resolvePromise({
                            then: function (onFulfilled) {
                                onFulfilled({
                                    then: function (onFulfilled) {
                                        setTimeout(function () {
                                            onFulfilled(value);
                                        }, 0);
                                    }
                                });
                                throw new Error('foo');
                            }
                        });
                    }
                };
            });

            this.isFulfilled(promise, function (result) {
                Assert.areSame(value, result);
            });
        },

        'resolution of a thenable that both fulfills and rejects': function () {
            var value = {foo:'bar'};

            var p1 = new Promise(function (resolve) {
                setTimeout(function () {
                    resolve(value);
                }, 0);
            });

            var p2 = Promise.resolve(dummy).then(function () {
                return {
                    then: function (onFulfilled, onRejected) {
                        onFulfilled(p1);
                        onRejected(new Error('foo'));
                    }
                };
            });

            this.isFulfilled(p2, function (result) {
                Assert.areSame(value, result);
            });
        }
    }));

    suite.add(new Y.Test.Case({
        name: 'control flow with catch()',

        'promises have a catch() method': function () {
            var promise = new Promise(function () {});

            Assert.isFunction(promise['catch'], 'promises should have a `catch` method');
        },

        'catch(fn) does nothing to resolved promises': function () {
            var value = {foo:'bar'},
                resolved = new Promise(function (resolve) {
                    resolve(value);
                }),
                next;

            next = resolved['catch'](function (err) {
                return err;
            });

            Assert.isObject(next, 'catch() should return an object');
            Assert.isInstanceOf(Promise, next, 'catch() should return a promise');

            this.isFulfilled(next, function (val) {
                Assert.areSame(value, val, 'promise fulfilled value should remain the same');
            });
        },

        'catch(fn) is equivalent to then(undefined, fn)': function () {
            var reason = new Error('some error'),
                rejected = new Promise(function (resolve, reject) {
                    reject(reason);
                }),
                next;

            next = rejected['catch'](function (err) {
                return err;
            });

            this.isFulfilled(next, function (value) {
                Assert.areSame(reason, value, 'returning an error in catch() should cause the next promise to be fulfilled');
            });
        }
    }));

    suite.add(new Y.Test.Case({
        name: 'Promise factories tests',

        'Promise constructor has the correct methods': function () {
            Assert.isFunction(Promise.reject, 'Promise.reject should be a function');
            Assert.isFunction(Promise.resolve, 'Promise.resolve should be a function');
        },

        'Promise.reject() returns an rejected promise': function () {
            var test = this,
                value = new Error('foo'),
                promise = Promise.reject(value);

            Assert.isInstanceOf(Promise, promise, 'Promise.reject() should return a promise');

            this.isRejected(promise, function next(result) {
                Assert.areSame(value, result, 'Promise.reject() should respect the passed value');
            });
        },

        'Promise.reject() should wrap fulfilled promises': function () {
            var value = new Promise(function (resolve) {
                    resolve('foo');
                }),
                promise = Promise.reject(value);

            this.isRejected(promise, function (result) {
                Assert.areSame(value, result, 'Promise.reject() should wrap fulfilled promises');
            });
        },

        'Promise.reject() should wrap rejected promises': function () {
            var value = new Promise(function (resolve, reject) {
                    reject('foo');
                }),
                promise = Promise.reject(value);

            this.isRejected(promise, function (result) {
                Assert.areSame(value, result, 'Promise.reject() should wrap rejected promises');
            });
        },

        'Promise.reject() should preserve the constructor when using inheritance': function () {
            function Subpromise() {
                Subpromise.superclass.constructor.apply(this, arguments);
            }
            Y.extend(Subpromise, Promise, null, {
                _defer: Promise._defer,
                reject: Promise.reject
            });

            var promise = Subpromise.reject('foo');

            Assert.isInstanceOf(Subpromise, promise, 'rejected promise should be an instance of the subclass');

            this.isRejected(promise, function (reason) {
                Assert.areSame('foo', reason, 'subpromise should have the correct rejection reason');
            });
        },

        'Promise.resolve() is fulfilled when passed a regular value': function () {
            var value = {},
                promise = Promise.resolve(value);

            this.isFulfilled(promise, function (result) {
                Assert.areSame(value, result, 'resolved promise should respect the value passed to it');
            });
        },

        'Promise.resolve() adopts the state of an fulfilled promise': function () {
            var value = {},
                fulfilled = Promise.resolve(value),
                promise = Promise.resolve(fulfilled);

            this.isFulfilled(promise, function (result) {
                Assert.areSame(value, result, 'resolved promise should take the value of the provided promise');
            });
        },

        'Promise.resolve() adopts the state of a rejected promise': function () {
            var value = {},
                fulfilled = Promise.reject(value),
                promise = Promise.resolve(fulfilled);

            this.isRejected(promise, function (result) {
                Assert.areSame(value, result, 'resolved promise should take the value of the provided promise');
            });
        },

        'Promise.resolve() should preserve the constructor when using inheritance': function () {
            function Subpromise() {
                Subpromise.superclass.constructor.apply(this, arguments);
            }
            Y.extend(Subpromise, Promise, null, {
                _defer: Promise._defer,
                resolve: Promise.resolve
            });

            var promise = Subpromise.resolve('foo');

            Assert.isInstanceOf(Subpromise, promise, 'resolved promise should be an instance of the subclass');

            this.isFulfilled(promise, function (value) {
                Assert.areSame('foo', value, 'subpromise should have the correct fulfilled value');
            });
        },

        'Promise.resolve() should not modify promises': function () {
            var promise = Promise.resolve(),
                wrapped = Promise.resolve(promise);

            Assert.isInstanceOf(Promise, promise, 'Promise.resolve should always return a promise');
            Assert.areSame(promise, wrapped, 'Promise.resolve should not modify a promise');
        },

        'Promise.resolve() should wrap values in a promise': function () {
            // truthy values
            Assert.isInstanceOf(Promise, Promise.resolve(5), 'numbers should be wrapped in a promise');
            Assert.isInstanceOf(Promise, Promise.resolve('foo'), 'strings should be wrapped in a promise');
            Assert.isInstanceOf(Promise, Promise.resolve(true), 'booleans should be wrapped in a promise');
            Assert.isInstanceOf(Promise, Promise.resolve(function () {}), 'functions should be wrapped in a promise');
            Assert.isInstanceOf(Promise, Promise.resolve({}), 'objects should be wrapped in a promise');

            // falsy values
            Assert.isInstanceOf(Promise, Promise.resolve(0), 'zero should be wrapped in a promise');
            Assert.isInstanceOf(Promise, Promise.resolve(''), 'empty strings should be wrapped in a promise');
            Assert.isInstanceOf(Promise, Promise.resolve(false), 'false should be wrapped in a promise');
            Assert.isInstanceOf(Promise, Promise.resolve(null), 'null should be wrapped in a promise');
            Assert.isInstanceOf(Promise, Promise.resolve(undefined), 'undefined should be wrapped in a promise');
            Assert.isInstanceOf(Promise, Promise.resolve(), 'undefined (empty parameters) should be wrapped in a promise');

            // almost promises
            Assert.isInstanceOf(Promise, Promise.resolve({then: 5}), 'promise-like objects should be wrapped in a promise');
        }
    }));

    suite.add(new Y.Test.Case({
        name: 'Promise.all() tests',

        'Promise.all() should return a promise': function () {
            var somePromise = new Promise(function () {});

            Assert.isInstanceOf(Promise, Promise.all([5]), 'when passed a value, Promise.all() should return a promise');
            Assert.isInstanceOf(Promise, Promise.all([new Promise(function () {})]), 'when passed a promise, Promise.all() should return a promise');
            Assert.isInstanceOf(Promise, Promise.all([]), 'with an empty list Promise.all() should still return a promise');
            Assert.areNotSame(somePromise, Promise.all([somePromise]), 'when passed a promise, Promise.all() should return a new promise');
        },

        'a non array argument should turn into a rejected promise': function () {
            this.isRejected(Promise.all('foo'), function (error) {
                Assert.isInstanceOf(TypeError, error, 'rejection reason should be a TypeError');
            });
        },

        'order of promises should be preserved': function () {
            var promise = Promise.all([wait(20), wait(10), wait(15)]);

            this.isFulfilled(promise, function (result) {
                ArrayAssert.itemsAreSame([20, 10, 15], result, 'order of returned values should be the same as the parameter list');
            });
        },

        'values should be wrapped in a promise': function () {
            var obj = {
                    hello: 'world'
                },
                promise = Promise.all(['foo', 5, obj]);

            this.isFulfilled(promise, function (result) {
                ArrayAssert.itemsAreSame(['foo', 5, obj], result, 'values passed to Promise.all() should be wrapped in promises, not ignored');
            });
        },

        'correct handling of function parameters': function () {
            function testFn() {}

            this.isFulfilled(Promise.all([testFn]), function (values) {
                Assert.isFunction(values[0], 'promise value should be a function');
                Assert.areSame(testFn, values[0], 'promise value should be the passed function');
            });
        },

        'Promise.all() should fail as fast as possible': function () {
            var promise = Promise.all([rejectedAfter(20), rejectedAfter(10), rejectedAfter(15)]);

            this.isRejected(promise, function (reason) {
                Assert.areEqual(10, reason, 'reason should be the one from the first promise to be rejected');
            });
        }

    }));

    suite.add(new Y.Test.Case({
        name: 'Promise.race() tests',

        'a non array argument should turn into a rejected promise': function () {
            this.isRejected(Promise.race('foo'), function (error) {
                Assert.isInstanceOf(TypeError, error, 'rejection reason should be a TypeError');
            });
        },

        'Promise.race() should fulfill when passed a fulfilled promise': function () {
            this.isFulfilled(Promise.race([wait(10)]), function (result) {
                Assert.areEqual(10, result, 'Promise.race() should fulfill when passed a fulfilled promise');
            });
        },

        'Promise.race() should reject when passed a rejected promise': function () {
            this.isRejected(Promise.race([rejectedAfter(10)]), function (result) {
                Assert.areEqual(10, result, 'Promise.race() should reject when passed a rejected promise');
            });
        },

        'Promise.race() should fulfill to the value of the first promise to be fulfilled': function () {
            var promise = Promise.race([wait(10), wait(100)]);

            this.isFulfilled(promise, function (result) {
                Assert.areEqual(10, result, 'Promise.race() should fulfill to the value of the first promise to be fulfilled');
            });
        },

        'Promise.race() should reject with the reason of the first promise to be rejected': function () {
            var promise = Promise.race([rejectedAfter(10), rejectedAfter(100)]);

            this.isRejected(promise, function (result) {
                Assert.areEqual(10, result, 'Promise.race() should reject with the reason of the first promise to be rejected');
            });
        }
    }));

    Y.Test.Runner.add(suite);

}, '@VERSION@', {
    requires: [
        'tests-promise-utils'
    ]
});
