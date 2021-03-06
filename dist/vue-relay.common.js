/**
 * vue-relay v1.6.0
 * (c) 2018 なつき
 * @license BSD-2-Clause
 */
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};

var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var invariant = require('fbjs/lib/invariant');

var VueRelayQueryFetcher = function () {
  function VueRelayQueryFetcher() {
    classCallCheck(this, VueRelayQueryFetcher);

    // this._fetchOptions
    // this._pendingRequest
    // this._rootSubscription
    this._selectionReferences = [];
    // this._snapshot
    // this._error
    // this._cacheSelectionReference
    this._callOnDataChangeWhenSet = false;
  }

  createClass(VueRelayQueryFetcher, [{
    key: 'lookupInStore',
    value: function lookupInStore(environment, operation) {
      if (environment.check(operation.root)) {
        this._retainCachedOperation(environment, operation);
        return environment.lookup(operation.fragment);
      }
      return null;
    }
  }, {
    key: 'execute',
    value: function execute(_ref) {
      var _this = this;

      var environment = _ref.environment,
          operation = _ref.operation,
          cacheConfig = _ref.cacheConfig,
          _ref$preservePrevious = _ref.preservePreviousReferences,
          preservePreviousReferences = _ref$preservePrevious === undefined ? false : _ref$preservePrevious;
      var createOperationSelector = environment.unstable_internal.createOperationSelector;

      var nextReferences = [];

      return environment.execute({ operation: operation, cacheConfig: cacheConfig }).map(function (payload) {
        var operationForPayload = createOperationSelector(operation.node, payload.variables, payload.operation);
        nextReferences.push(environment.retain(operationForPayload.root));
        return payload;
      }).do({
        error: function error() {
          // We may have partially fulfilled the request, so let the next request
          // or the unmount dispose of the references.
          _this._selectionReferences = _this._selectionReferences.concat(nextReferences);
        },
        complete: function complete() {
          if (!preservePreviousReferences) {
            _this._disposeSelectionReferences();
          }
          _this._selectionReferences = _this._selectionReferences.concat(nextReferences);
        },
        unsubscribe: function unsubscribe() {
          // Let the next request or the unmount code dispose of the references.
          // We may have partially fulfilled the request.
          _this._selectionReferences = _this._selectionReferences.concat(nextReferences);
        }
      });
    }
  }, {
    key: 'setOnDataChange',
    value: function setOnDataChange(onDataChange) {
      invariant(this._fetchOptions, 'RelayQueryFetcher: `setOnDataChange` should have been called after having called `fetch`');

      // Mutate the most recent fetchOptions in place,
      // So that in-progress requests can access the updated callback.
      this._fetchOptions.onDataChange = onDataChange;

      if (this._callOnDataChangeWhenSet && typeof onDataChange === 'function') {
        this._callOnDataChangeWhenSet = false;
        if (this._error != null) {
          onDataChange({ error: this._error });
        } else if (this._snapshot != null) {
          onDataChange({ snapshot: this._snapshot });
        }
      }
    }

    /**
     * `fetch` fetches the data for the given operation.
     * If a result is immediately available synchronously, it will be synchronously
     * returned by this function.
     *
     * Otherwise, the fetched result will be communicated via the `onDataChange` callback.
     * `onDataChange` will be called with the first result (**if it wasn't returned synchronously**),
     * and then subsequently whenever the data changes.
     */

  }, {
    key: 'fetch',
    value: function fetch(fetchOptions) {
      var _this2 = this;

      var cacheConfig = fetchOptions.cacheConfig,
          environment = fetchOptions.environment,
          operation = fetchOptions.operation;

      var fetchHasReturned = false;
      var _error = void 0;

      this._disposeRequest();
      this._fetchOptions = fetchOptions;

      var request = this.execute({
        environment: environment,
        operation: operation,
        cacheConfig: cacheConfig
      }).finally(function () {
        _this2._pendingRequest = null;
      }).subscribe({
        next: function next() {
          var onDataChange = _this2._fetchOptions ? _this2._fetchOptions.onDataChange : null;

          // If we received a response when we didn't have a change callback,
          // Make a note that to notify the callback when it's later added.
          _this2._callOnDataChangeWhenSet = typeof onDataChange !== 'function';
          _this2._error = null;

          // Only notify of the first result if `next` is being called **asynchronously**
          // (i.e. after `fetch` has returned).
          _this2._onQueryDataAvailable({ notifyFirstResult: fetchHasReturned });
        },
        error: function error(err) {
          var onDataChange = _this2._fetchOptions ? _this2._fetchOptions.onDataChange : null;

          // If we received a response when we didn't have a change callback,
          // Make a note that to notify the callback when it's later added.
          _this2._callOnDataChangeWhenSet = typeof onDataChange !== 'function';
          _this2._error = err;
          _this2._snapshot = null;

          // Only notify of error if `error` is being called **asynchronously**
          // (i.e. after `fetch` has returned).
          if (fetchHasReturned) {
            if (typeof onDataChange === 'function') {
              onDataChange({ error: err });
            }
          } else {
            _error = err;
          }
        }
      });

      this._pendingRequest = {
        dispose: function dispose() {
          request.unsubscribe();
        }
      };

      fetchHasReturned = true;

      if (_error) {
        throw _error;
      }

      return this._snapshot;
    }
  }, {
    key: 'retry',
    value: function retry() {
      invariant(this._fetchOptions, 'RelayQueryFetcher: `retry` should be called after having called `fetch`');
      return this.fetch(this._fetchOptions);
    }
  }, {
    key: 'dispose',
    value: function dispose() {
      this._disposeRequest();
      this._disposeSelectionReferences();
    }
  }, {
    key: '_disposeRequest',
    value: function _disposeRequest() {
      this._error = null;
      this._snapshot = null;

      // order is important, dispose of pendingFetch before selectionReferences
      if (this._pendingRequest) {
        this._pendingRequest.dispose();
      }
      if (this._rootSubscription) {
        this._rootSubscription.dispose();
        this._rootSubscription = null;
      }
    }
  }, {
    key: '_retainCachedOperation',
    value: function _retainCachedOperation(environment, operation) {
      this._disposeCacheSelectionReference();
      this._cacheSelectionReference = environment.retain(operation.root);
    }
  }, {
    key: '_disposeCacheSelectionReference',
    value: function _disposeCacheSelectionReference() {
      this._cacheSelectionReference && this._cacheSelectionReference.dispose();
      this._cacheSelectionReference = null;
    }
  }, {
    key: '_disposeSelectionReferences',
    value: function _disposeSelectionReferences() {
      this._disposeCacheSelectionReference();
      this._selectionReferences.forEach(function (r) {
        return r.dispose();
      });
      this._selectionReferences = [];
    }
  }, {
    key: '_onQueryDataAvailable',
    value: function _onQueryDataAvailable(_ref2) {
      var _this3 = this;

      var notifyFirstResult = _ref2.notifyFirstResult;

      invariant(this._fetchOptions, 'RelayQueryFetcher: `_onQueryDataAvailable` should have been called after having called `fetch`');
      var _fetchOptions = this._fetchOptions,
          environment = _fetchOptions.environment,
          onDataChange = _fetchOptions.onDataChange,
          operation = _fetchOptions.operation;

      // `_onQueryDataAvailable` can be called synchronously the first time and can be called
      // multiple times by network layers that support data subscriptions.
      // Wait until the first payload to call `onDataChange` and subscribe for data updates.

      if (this._snapshot) {
        return;
      }

      this._snapshot = environment.lookup(operation.fragment);

      // Subscribe to changes in the data of the root fragment
      this._rootSubscription = environment.subscribe(this._snapshot, function (snapshot) {
        // Read from this._fetchOptions in case onDataChange() was lazily added.
        if (_this3._fetchOptions != null) {
          var maybeNewOnDataChange = _this3._fetchOptions.onDataChange;
          if (typeof maybeNewOnDataChange === 'function') {
            maybeNewOnDataChange({ snapshot: snapshot });
          }
        }
      });

      if (this._snapshot && notifyFirstResult && typeof onDataChange === 'function') {
        onDataChange({ snapshot: this._snapshot });
      }
    }
  }]);
  return VueRelayQueryFetcher;
}();

var areEqual = require('fbjs/lib/areEqual');
var STORE_THEN_NETWORK = 'STORE_THEN_NETWORK';

var QueryRenderer = {
  name: 'relay-query-renderer',
  props: {
    cacheConfig: {},
    dataFrom: {},
    environment: {
      required: true
    },
    query: {},
    variables: {
      type: Object,
      default: function _default() {
        return {};
      }
    }
  },
  data: function data() {
    // Callbacks are attached to the current instance and shared with static
    // lifecyles by bundling with state. This is okay to do because the
    // callbacks don't change in reaction to props. However we should not
    // "leak" them before mounting (since we would be unable to clean up). For
    // that reason, we define them as null initially and fill them in after
    // mounting to avoid leaking memory.
    var retryCallbacks = {
      handleDataChange: null,
      handleRetryAfterError: null
    };

    var queryFetcher = new VueRelayQueryFetcher();

    var state = fetchQueryAndComputeStateFromProps(this.$props, queryFetcher, retryCallbacks);

    return {
      // React's getChildContext() is dynamically resolved,
      // Vue does not have this feature, instead, we `inject` a static reference.
      // `context` is frozen to prevent reference changes to `context.relay`.
      // `context.relay` itself is not frozen and should be updated accordingly.
      context: Object.freeze({
        relay: {
          environment: state.relayContextEnvironment,
          variables: state.relayContextVariables
        }
      }),
      state: Object.freeze(_extends({
        prevPropsEnvironment: this.environment,
        prevPropsVariables: this.variables,
        prevQuery: this.query,
        queryFetcher: queryFetcher,
        retryCallbacks: retryCallbacks
      }, state)),
      switch: true
    };
  },

  computed: {
    props: function props() {
      var _this = this;

      Object.keys(this.$props).forEach(function (key) {
        return _this[key];
      });
      return this.switch = !this.switch;
    }
  },
  methods: {
    setState: function setState(state) {
      this.state = Object.freeze(_extends({}, this.state, state));
    }
  },
  watch: {
    props: function props() {
      if (this.state.prevQuery !== this.query || this.state.prevPropsEnvironment !== this.environment || !areEqual(this.state.prevPropsVariables, this.variables)) {
        var state = fetchQueryAndComputeStateFromProps(this.$props, this.state.queryFetcher, this.state.retryCallbacks);

        // React getDerivedStateFromProps is static method.
        // Vue beforeUpdate is instance method.
        // Thus updaing relayContext here instead of in render.
        this.context.relay.environment = state.relayContextEnvironment;
        this.context.relay.variables = state.relayContextVariables;

        this.setState(_extends({
          prevQuery: this.query,
          prevPropsEnvironment: this.environment,
          prevPropsVariables: this.variables
        }, state));
      }
    }
  },
  render: function render(h) {
    if (process.env.NODE_ENV !== 'production') {
      require('relay-runtime/lib/deepFreeze')(this.state.renderProps);
    }
    return h(this.component);
  },
  created: function created() {
    var _this2 = this;

    this.component = {
      name: 'relay-context-provider',
      provide: {
        relay: this.context.relay
      },
      render: function render(h) {
        return h('keep-alive', {
          props: {
            include: []
          }
        }, _this2.$scopedSlots.default(_this2.state.renderProps));
      }
    };
  },
  mounted: function mounted() {
    var _this3 = this;

    var _state = this.state,
        retryCallbacks = _state.retryCallbacks,
        queryFetcher = _state.queryFetcher;


    retryCallbacks.handleDataChange = function (params) {
      var error = params.error == null ? null : params.error;
      var snapshot = params.snapshot == null ? null : params.snapshot;

      // Don't update state if nothing has changed.
      if (snapshot !== _this3.state.snapshot || error !== _this3.state.error) {
        _this3.setState({
          renderProps: getRenderProps(error, snapshot, queryFetcher, retryCallbacks),
          snapshot: snapshot
        });
      }
    };

    retryCallbacks.handleRetryAfterError = function (_) {
      return _this3.setState({ renderProps: getLoadingRenderProps() });
    };

    // Re-initialize the ReactRelayQueryFetcher with callbacks.
    // If data has changed since constructions, this will re-render.
    if (this.query) {
      queryFetcher.setOnDataChange(retryCallbacks.handleDataChange);
    }
  },
  beforeDestroy: function beforeDestroy() {
    this.state.queryFetcher.dispose();
  }
};

var getLoadingRenderProps = function getLoadingRenderProps() {
  return {
    error: null,
    props: null, // `props: null` indicates that the data is being fetched (i.e. loading)
    retry: null
  };
};

var getEmptyRenderProps = function getEmptyRenderProps() {
  return {
    error: null,
    props: {}, // `props: {}` indicates no data available
    retry: null
  };
};

var getRenderProps = function getRenderProps(error, snapshot, queryFetcher, retryCallbacks) {
  return {
    error: error || null,
    props: snapshot ? snapshot.data : null,
    retry: function retry() {
      var syncSnapshot = queryFetcher.retry();
      if (syncSnapshot && typeof retryCallbacks.handleDataChange === 'function') {
        retryCallbacks.handleDataChange({ snapshot: syncSnapshot });
      } else if (error && typeof retryCallbacks.handleRetryAfterError === 'function') {
        // If retrying after an error and no synchronous result available,
        // reset the render props
        retryCallbacks.handleRetryAfterError(error);
      }
    }
  };
};

var fetchQueryAndComputeStateFromProps = function fetchQueryAndComputeStateFromProps(props, queryFetcher, retryCallbacks) {
  var environment = props.environment,
      query = props.query,
      variables = props.variables;

  if (query) {
    var genericEnvironment = environment;

    var _genericEnvironment$u = genericEnvironment.unstable_internal,
        createOperationSelector = _genericEnvironment$u.createOperationSelector,
        getRequest = _genericEnvironment$u.getRequest;

    var request = getRequest(query);
    var operation = createOperationSelector(request, variables);

    try {
      var storeSnapshot = props.dataFrom === STORE_THEN_NETWORK ? queryFetcher.lookupInStore(genericEnvironment, operation) : null;
      var querySnapshot = queryFetcher.fetch({
        cacheConfig: props.cacheConfig,
        dataFrom: props.dataFrom,
        environment: genericEnvironment,
        onDataChange: retryCallbacks.handleDataChange,
        operation: operation
      });
      // Use network data first, since it may be fresher
      var snapshot = querySnapshot || storeSnapshot;
      if (!snapshot) {
        return {
          error: null,
          relayContextEnvironment: environment,
          relayContextVariables: operation.variables,
          renderProps: getLoadingRenderProps(),
          snapshot: null
        };
      }

      return {
        error: null,
        relayContextEnvironment: environment,
        relayContextVariables: operation.variables,
        renderProps: getRenderProps(null, snapshot, queryFetcher, retryCallbacks),
        snapshot: snapshot
      };
    } catch (error) {
      return {
        error: error,
        relayContextEnvironment: environment,
        relayContextVariables: operation.variables,
        renderProps: getRenderProps(error, null, queryFetcher, retryCallbacks),
        snapshot: null
      };
    }
  } else {
    queryFetcher.dispose();

    return {
      error: null,
      relayContextEnvironment: environment,
      relayContextVariables: variables,
      renderProps: getEmptyRenderProps()
    };
  }
};

var isRelayEnvironment = function isRelayEnvironment(environment) {
  return (typeof environment === 'undefined' ? 'undefined' : _typeof(environment)) === 'object' && environment !== null && typeof environment.applyMutation === 'function' && typeof environment.check === 'function' && typeof environment.check === 'function' && typeof environment.lookup === 'function' && typeof environment.retain === 'function' && typeof environment.sendMutation === 'function' && typeof environment.sendQuery === 'function' && typeof environment.execute === 'function' && typeof environment.subscribe === 'function';
};

var isRelayVariables = function isRelayVariables(variables) {
  return (typeof variables === 'undefined' ? 'undefined' : _typeof(variables)) === 'object' && variables !== null && !Array.isArray(variables);
};

var isRelayContext = function isRelayContext(context) {
  return (typeof context === 'undefined' ? 'undefined' : _typeof(context)) === 'object' && context !== null && !Array.isArray(context) && isRelayEnvironment(context.environment) && isRelayVariables(context.variables);
};

var invariant$1 = require('fbjs/lib/invariant');
var mapObject = require('fbjs/lib/mapObject');

var assertRelayContext = function assertRelayContext(relay) {
  invariant$1(isRelayContext(relay), 'RelayContextConsumer: Expected `relayContext` to be an object ' + 'conforming to the `RelayContext` interface, got `%s`.', relay);
  return relay;
};

var buildVueRelayContainer = function buildVueRelayContainer(component, fragmentSpec, createContainerWithFragments) {
  return {
    name: 'relay-context-consumer',
    inject: ['relay'],
    render: function render(h) {
      return h(this.component, {
        props: this.$attrs
      });
    },
    created: function created() {
      var relay = assertRelayContext(this.relay);
      var getFragmentFromTag = relay.environment.unstable_internal.getFragment;

      var fragments = mapObject(fragmentSpec, getFragmentFromTag);

      var context = this;

      this.component = {
        extends: createContainerWithFragments.call(this, fragments),
        props: Object.keys(fragments),
        render: function render(h) {
          if (this.context) {
            return h(this.component);
          }
          return this.component.render(h);
        },
        created: function created() {
          var _this = this;

          this.component = {
            name: 'relay-context-provider',
            provide: {
              relay: (this.context || context).relay
            },
            render: function render(h) {
              if (component != null) {
                return h(component, {
                  props: _extends({}, _this.$attrs, _this.state.data, {
                    relay: _this.state.relayProp
                  })
                });
              }
              return h('keep-alive', {
                props: {
                  include: []
                }
              }, context.$scopedSlots.default(_extends({}, _this.state.data, {
                relay: _this.state.relayProp
              })));
            }
          };
        }
      };
    }
  };
};

var areEqual$1 = require('fbjs/lib/areEqual');
var invariant$2 = require('fbjs/lib/invariant');

var _require = require('relay-runtime'),
    Observable = _require.Observable;

var createContainerWithFragments = function createContainerWithFragments(_fragments, taggedNode) {
  var relay = this.relay;

  return {
    name: 'relay-refetch-container',
    data: function data() {
      var createFragmentSpecResolver = relay.environment.unstable_internal.createFragmentSpecResolver;
      // Do not provide a subscription/callback here.
      // It is possible for this render to be interrupted or aborted,
      // In which case the subscription would cause a leak.
      // We will add the subscription in componentDidMount().

      var resolver = createFragmentSpecResolver(relay, this.$options.name, _fragments, this.$props);

      return {
        // a.k.a this._relayContext in react-relay
        context: Object.freeze({
          relay: {
            environment: relay.environment,
            variables: relay.variables
          }
        }),
        prevState: Object.freeze({
          resolver: resolver
        }),
        state: Object.freeze({
          data: resolver.resolve(),
          prevProps: this.$props,
          relayEnvironment: relay.environment,
          relayVariables: relay.variables,
          relayProp: {
            environment: relay.environment,
            refetch: this._refetch
          },
          localVariables: null,
          refetchSubscription: null,
          resolver: resolver
        }),
        switch: true
      };
    },

    computed: {
      fragments: function fragments() {
        var _this = this;

        Object.keys(_fragments).forEach(function (key) {
          return _this[key];
        });
        return this.switch = !this.switch;
      }
    },
    methods: {
      setState: function setState(state) {
        this.state = Object.freeze(_extends({}, this.state, state));
      },
      _subscribeToNewResolver: function _subscribeToNewResolver() {
        var _state = this.state,
            data = _state.data,
            resolver = _state.resolver;

        // Event listeners are only safe to add during the commit phase,
        // So they won't leak if render is interrupted or errors.

        resolver.setCallback(this._handleFragmentDataUpdate);

        // External values could change between render and commit.
        // Check for this case, even though it requires an extra store read.
        var maybeNewData = resolver.resolve();
        if (data !== maybeNewData) {
          this.setState({ data: maybeNewData });
        }
      },
      _handleFragmentDataUpdate: function _handleFragmentDataUpdate() {
        if (this.state.resolver === this.prevState.resolver) {
          this.setState({
            data: this.state.resolver.resolve()
          });
        }
      },
      _getFragmentVariables: function _getFragmentVariables() {
        var getVariablesFromObject = relay.environment.unstable_internal.getVariablesFromObject;

        return getVariablesFromObject(relay.variables, _fragments, this.$props);
      },
      _getQueryFetcher: function _getQueryFetcher() {
        if (!this.state.queryFetcher) {
          this.setState({ queryFetcher: new VueRelayQueryFetcher() });
        }
        return this.state.queryFetcher;
      },
      _refetch: function _refetch(refetchVariables, renderVariables, observerOrCallback, options) {
        var _this2 = this;

        var environment = relay.environment,
            rootVariables = relay.variables;

        var fetchVariables = typeof refetchVariables === 'function' ? refetchVariables(this._getFragmentVariables()) : refetchVariables;
        fetchVariables = _extends({}, rootVariables, fetchVariables);
        var fragmentVariables = renderVariables ? _extends({}, rootVariables, renderVariables) : fetchVariables;
        var cacheConfig = options ? { force: !!options.force } : undefined;

        var observer = typeof observerOrCallback === 'function' ? {
          // callback is not exectued on complete or unsubscribe
          // for backward compatibility
          next: observerOrCallback,
          error: observerOrCallback
        } : observerOrCallback || {};

        var _relay$environment$un = relay.environment.unstable_internal,
            createOperationSelector = _relay$environment$un.createOperationSelector,
            getRequest = _relay$environment$un.getRequest;

        var query = getRequest(taggedNode);
        var operation = createOperationSelector(query, fetchVariables);

        // TODO: T26288752 find a better way
        this.setState({ localVariables: fetchVariables });

        // Cancel any previously running refetch.
        this.state.refetchSubscription && this.state.refetchSubscription.unsubscribe();

        // Declare refetchSubscription before assigning it in .start(), since
        // synchronous completion may call callbacks .subscribe() returns.
        var refetchSubscription = void 0;
        this._getQueryFetcher().execute({
          environment: environment,
          operation: operation,
          cacheConfig: cacheConfig,
          // TODO (T26430099): Cleanup old references
          preservePreviousReferences: true
        }).mergeMap(function (response) {
          // Child containers rely on context.relay being mutated (for gDSFP).
          // TODO: T26288752 find a better way
          _this2.context.relay.environment = relay.environment;
          _this2.context.relay.variables = fragmentVariables;
          _this2.state.resolver.setVariables(fragmentVariables);
          return Observable.create(function (sink) {
            _this2.setState({ data: _this2.state.resolver.resolve() });
            sink.next();
            sink.complete();
          });
        }).finally(function () {
          // Finalizing a refetch should only clear this._refetchSubscription
          // if the finizing subscription is the most recent call.
          if (_this2.state.refetchSubscription === refetchSubscription) {
            _this2.setState({
              refetchSubscription: null
            });
          }
        }).subscribe(_extends({}, observer, {
          start: function start(subscription) {
            refetchSubscription = subscription;
            _this2.setState({
              refetchSubscription: subscription
            });
            observer.start && observer.start(subscription);
          }
        }));

        return {
          dispose: function dispose() {
            refetchSubscription && refetchSubscription.unsubscribe();
          }
        };
      }
    },
    watch: {
      fragments: function fragments() {
        var _relay$environment$un2 = relay.environment.unstable_internal,
            createFragmentSpecResolver = _relay$environment$un2.createFragmentSpecResolver,
            getDataIDsFromObject = _relay$environment$un2.getDataIDsFromObject;


        var prevIDs = getDataIDsFromObject(_fragments, this.state.prevProps);
        var nextIDs = getDataIDsFromObject(_fragments, this.$props);

        var resolver = this.state.resolver;

        // If the environment has changed or props point to new records then
        // previously fetched data and any pending fetches no longer apply:
        // - Existing references are on the old environment.
        // - Existing references are based on old variables.
        // - Pending fetches are for the previous records.
        if (this.state.relayEnvironment !== relay.environment || this.state.relayVariables !== relay.variables || !areEqual$1(prevIDs, nextIDs)) {
          this.prevState = Object.freeze({ resolver: resolver });

          // Child containers rely on context.relay being mutated (for gDSFP).
          this.context.relay.environment = relay.environment;
          this.context.relay.variables = relay.variables;

          resolver = createFragmentSpecResolver(relay, this.$options.name, _fragments, this.$props, this._handleFragmentDataUpdate);

          this.setState({
            prevProps: this.$props,
            relayEnvironment: relay.environment,
            relayVariables: relay.variables,
            relayProp: {
              environment: relay.environment,
              refetch: this._refetch
            },
            localVariables: null,
            resolver: resolver
          });
        } else if (!this.state.localVariables) {
          resolver.setProps(this.$props);
        }
        var data = resolver.resolve();
        if (data !== this.state.data) {
          this.setState({ data: data });
        }
      }
    },
    mounted: function mounted() {
      this._subscribeToNewResolver();
    },
    updated: function updated() {
      if (this.state.resolver !== this.prevState.resolver) {
        this.prevState.resolver.dispose();
        this.prevState = Object.freeze({ resolver: this.state.resolver });
        this.state.queryFetcher && this.state.queryFetcher.dispose();
        this.state.refetchSubscription && this.state.refetchSubscription.unsubscribe();

        this._subscribeToNewResolver();
      }
    },
    beforeDestroy: function beforeDestroy() {
      this.state.resolver.dispose();
      this.state.queryFetcher && this.state.queryFetcher.dispose();
      this.state.refetchSubscription && this.state.refetchSubscription.unsubscribe();
    }
  };
};

var createRefetchContainer = function createRefetchContainer() {
  invariant$2(arguments.length === 2 || arguments.length === 3, 'createRefetchContainer: Expected `arguments.length` to be 2 or 3, got `%s`.', arguments);
  if (arguments.length === 2) {
    [].unshift.call(arguments, null);
  }

  var _arguments = Array.prototype.slice.call(arguments),
      component = _arguments[0],
      fragmentSpec = _arguments[1],
      taggedNode = _arguments[2];

  return buildVueRelayContainer(component, fragmentSpec, function (fragments) {
    return createContainerWithFragments.call(this, fragments, taggedNode);
  });
};

var areEqual$2 = require('fbjs/lib/areEqual');
var invariant$3 = require('fbjs/lib/invariant');
var warning = require('fbjs/lib/warning');

var _require$1 = require('relay-runtime'),
    ConnectionInterface = _require$1.ConnectionInterface,
    Observable$1 = _require$1.Observable;

var FORWARD = 'forward';

var createGetConnectionFromProps = function createGetConnectionFromProps(metadata) {
  var path = metadata.path;
  invariant$3(path, 'RelayPaginationContainer: Unable to synthesize a ' + 'getConnectionFromProps function.');
  return function (props) {
    var data = props[metadata.fragmentName];
    for (var i = 0; i < path.length; i++) {
      if (!data || (typeof data === 'undefined' ? 'undefined' : _typeof(data)) !== 'object') {
        return null;
      }
      data = data[path[i]];
    }
    return data;
  };
};

var createGetFragmentVariables = function createGetFragmentVariables(metadata) {
  var countVariable = metadata.count;
  invariant$3(countVariable, 'RelayPaginationContainer: Unable to synthesize a ' + 'getFragmentVariables function.');
  return function (prevVars, totalCount) {
    return _extends({}, prevVars, defineProperty({}, countVariable, totalCount));
  };
};

var findConnectionMetadata = function findConnectionMetadata(fragments) {
  var foundConnectionMetadata = null;
  var isRelayModern = false;
  for (var fragmentName in fragments) {
    var fragment = fragments[fragmentName];
    var connectionMetadata = fragment.metadata && fragment.metadata.connection;
    // HACK: metadata is always set to `undefined` in classic. In modern, even
    // if empty, it is set to null (never undefined). We use that knowlege to
    // check if we're dealing with classic or modern
    if (fragment.metadata !== undefined) {
      isRelayModern = true;
    }
    if (connectionMetadata) {
      invariant$3(connectionMetadata.length === 1, 'RelayPaginationContainer: Only a single @connection is ' + 'supported, `%s` has %s.', fragmentName, connectionMetadata.length);
      invariant$3(!foundConnectionMetadata, 'RelayPaginationContainer: Only a single fragment with ' + '@connection is supported.');
      foundConnectionMetadata = _extends({}, connectionMetadata[0], {
        fragmentName: fragmentName
      });
    }
  }
  invariant$3(!isRelayModern || foundConnectionMetadata !== null, 'RelayPaginationContainer: A @connection directive must be present.');
  return foundConnectionMetadata || {};
};

var toObserver = function toObserver(observerOrCallback) {
  return typeof observerOrCallback === 'function' ? {
    error: observerOrCallback,
    complete: observerOrCallback,
    unsubscribe: function unsubscribe(subscription) {
      typeof observerOrCallback === 'function' && observerOrCallback();
    }
  } : observerOrCallback || {};
};

var createContainerWithFragments$1 = function createContainerWithFragments(_fragments, connectionConfig) {
  var relay = this.relay;

  var metadata = findConnectionMetadata(_fragments);

  var getConnectionFromProps = connectionConfig.getConnectionFromProps || createGetConnectionFromProps(metadata);

  var direction = connectionConfig.direction || metadata.direction;
  invariant$3(direction, 'RelayPaginationContainer: Unable to infer direction of the ' + 'connection, possibly because both first and last are provided.');

  var getFragmentVariables = connectionConfig.getFragmentVariables || createGetFragmentVariables(metadata);

  return {
    name: 'relay-pagination-container',
    data: function data() {
      var createFragmentSpecResolver = relay.environment.unstable_internal.createFragmentSpecResolver;

      var resolver = createFragmentSpecResolver(relay, this.$options.name, _fragments, this.$props, this._handleFragmentDataUpdate);

      return {
        // a.k.a this._relayContext in react-relay
        context: Object.freeze({
          relay: {
            environment: relay.environment,
            variables: relay.variables
          }
        }),
        state: Object.freeze({
          data: resolver.resolve(),
          prevProps: this.$props,
          relayEnvironment: relay.environment,
          relayVariables: relay.variables,
          relayProp: this._buildRelayProp(relay),
          isARequestInFlight: false,
          localVariables: null,
          refetchSubscription: null,
          resolver: resolver
        }),
        switch: true
      };
    },

    computed: {
      fragments: function fragments() {
        var _this = this;

        Object.keys(_fragments).forEach(function (key) {
          return _this[key];
        });
        return this.switch = !this.switch;
      }
    },
    methods: {
      setState: function setState(state) {
        this.state = Object.freeze(_extends({}, this.state, state));
      },
      _buildRelayProp: function _buildRelayProp(relay) {
        return {
          hasMore: this._hasMore,
          isLoading: this._isLoading,
          loadMore: this._loadMore,
          refetchConnection: this._refetchConnection,
          environment: relay.environment
        };
      },
      _handleFragmentDataUpdate: function _handleFragmentDataUpdate() {
        this.setState({
          data: this.state.resolver.resolve()
        });
      },
      _getConnectionData: function _getConnectionData() {
        // Extract connection data and verify there are more edges to fetch
        var props = _extends({}, this.$props, this.state.data);
        var connectionData = getConnectionFromProps(props);
        if (connectionData == null) {
          return null;
        }

        var _ConnectionInterface$ = ConnectionInterface.get(),
            EDGES = _ConnectionInterface$.EDGES,
            PAGE_INFO = _ConnectionInterface$.PAGE_INFO,
            HAS_NEXT_PAGE = _ConnectionInterface$.HAS_NEXT_PAGE,
            HAS_PREV_PAGE = _ConnectionInterface$.HAS_PREV_PAGE,
            END_CURSOR = _ConnectionInterface$.END_CURSOR,
            START_CURSOR = _ConnectionInterface$.START_CURSOR;

        invariant$3((typeof connectionData === 'undefined' ? 'undefined' : _typeof(connectionData)) === 'object', 'RelayPaginationContainer: Expected `getConnectionFromProps()` in `%s`' + 'to return `null` or a plain object with %s and %s properties, got `%s`.', this.$options.name, EDGES, PAGE_INFO, connectionData);
        var edges = connectionData[EDGES];
        var pageInfo = connectionData[PAGE_INFO];
        if (edges == null || pageInfo == null) {
          return null;
        }
        invariant$3(Array.isArray(edges), 'RelayPaginationContainer: Expected `getConnectionFromProps()` in `%s`' + 'to return an object with %s: Array, got `%s`.', this.$options.name, EDGES, edges);
        invariant$3((typeof pageInfo === 'undefined' ? 'undefined' : _typeof(pageInfo)) === 'object', 'RelayPaginationContainer: Expected `getConnectionFromProps()` in `%s`' + 'to return an object with %s: Object, got `%s`.', this.$options.name, PAGE_INFO, pageInfo);
        var hasMore = direction === FORWARD ? pageInfo[HAS_NEXT_PAGE] : pageInfo[HAS_PREV_PAGE];
        var cursor = direction === FORWARD ? pageInfo[END_CURSOR] : pageInfo[START_CURSOR];
        if (typeof hasMore !== 'boolean' || edges.length !== 0 && typeof cursor === 'undefined') {
          warning(false, 'RelayPaginationContainer: Cannot paginate without %s fields in `%s`. ' + 'Be sure to fetch %s (got `%s`) and %s (got `%s`).', PAGE_INFO, this.$options.name, direction === FORWARD ? HAS_NEXT_PAGE : HAS_PREV_PAGE, hasMore, direction === FORWARD ? END_CURSOR : START_CURSOR, cursor);
          return null;
        }
        return {
          cursor: cursor,
          edgeCount: edges.length,
          hasMore: hasMore
        };
      },
      _hasMore: function _hasMore() {
        var connectionData = this._getConnectionData();
        return !!(connectionData && connectionData.hasMore && connectionData.cursor);
      },
      _isLoading: function _isLoading() {
        return !!this.state.refetchSubscription;
      },
      _refetchConnection: function _refetchConnection(totalCount, observerOrCallback, refetchVariables) {
        var paginatingVariables = {
          count: totalCount,
          cursor: null,
          totalCount: totalCount
        };
        var fetch = this._fetchPage(paginatingVariables, toObserver(observerOrCallback), { force: true }, refetchVariables);

        return { dispose: fetch.unsubscribe };
      },
      _loadMore: function _loadMore(pageSize, observerOrCallback, options) {
        var observer = toObserver(observerOrCallback);
        var connectionData = this._getConnectionData();
        if (!connectionData) {
          Observable$1.create(function (sink) {
            return sink.complete();
          }).subscribe(observer);
          return null;
        }
        var totalCount = connectionData.edgeCount + pageSize;
        if (options && options.force) {
          return this._refetchConnection(totalCount, observerOrCallback);
        }

        var _ConnectionInterface$2 = ConnectionInterface.get(),
            END_CURSOR = _ConnectionInterface$2.END_CURSOR,
            START_CURSOR = _ConnectionInterface$2.START_CURSOR;

        var cursor = connectionData.cursor;
        warning(cursor, 'RelayPaginationContainer: Cannot `loadMore` without valid `%s` (got `%s`)', direction === FORWARD ? END_CURSOR : START_CURSOR, cursor);
        var paginatingVariables = {
          count: pageSize,
          cursor: cursor,
          totalCount: totalCount
        };
        var fetch = this._fetchPage(paginatingVariables, observer, options);
        return { dispose: fetch.unsubscribe };
      },
      _getQueryFetcher: function _getQueryFetcher() {
        if (!this.state.queryFetcher) {
          this.setState({ queryFetcher: new VueRelayQueryFetcher() });
        }
        return this.state.queryFetcher;
      },
      _fetchPage: function _fetchPage(paginatingVariables, observer, options, refetchVariables) {
        var _this2 = this;

        var environment = relay.environment;
        var _environment$unstable = environment.unstable_internal,
            createOperationSelector = _environment$unstable.createOperationSelector,
            getRequest = _environment$unstable.getRequest,
            getVariablesFromObject = _environment$unstable.getVariablesFromObject;

        var props = _extends({}, this.$props, this.state.data);
        var fragmentVariables = getVariablesFromObject(this.context.relay.variables, _fragments, this.$props);
        fragmentVariables = _extends({}, fragmentVariables, refetchVariables);
        var fetchVariables = connectionConfig.getVariables(props, {
          count: paginatingVariables.count,
          cursor: paginatingVariables.cursor
        },
        // Pass the variables used to fetch the fragments initially
        fragmentVariables);
        invariant$3((typeof fetchVariables === 'undefined' ? 'undefined' : _typeof(fetchVariables)) === 'object' && fetchVariables !== null, 'RelayPaginationContainer: Expected `getVariables()` to ' + 'return an object, got `%s` in `%s`.', fetchVariables, this.$options.name);
        fetchVariables = _extends({}, fetchVariables, refetchVariables);
        this.setState({ localVariables: fetchVariables });

        var cacheConfig = options ? { force: !!options.force } : undefined;
        if (cacheConfig && options && options.rerunParamExperimental) {
          cacheConfig.rerunParamExperimental = options.rerunParamExperimental;
        }
        var request = getRequest(connectionConfig.query);
        var operation = createOperationSelector(request, fetchVariables);

        var refetchSubscription = null;

        if (this.state.refetchSubscription) {
          this.state.refetchSubscription.unsubscribe();
        }

        var onNext = function onNext(payload, complete) {
          // Child containers rely on context.relay being mutated (for gDSFP).
          _this2.context.relay.environment = relay.environment;
          _this2.context.relay.variables = _extends({}, relay.variables, fragmentVariables);
          var prevData = _this2.state.resolver.resolve();
          _this2.state.resolver.setVariables(getFragmentVariables(fragmentVariables, paginatingVariables.totalCount));
          var nextData = _this2.state.resolver.resolve();

          // Workaround slightly different handling for connection in different
          // core implementations:
          // - Classic core requires the count to be explicitly incremented
          // - Modern core automatically appends new items, updating the count
          //   isn't required to see new data.
          //
          // `setState` is only required if changing the variables would change the
          // resolved data.
          // TODO #14894725: remove PaginationContainer equal check
          if (!areEqual$2(prevData, nextData)) {
            _this2.setState({ data: nextData });
          }
          complete();
        };

        var cleanup = function cleanup() {
          if (_this2.state.refetchSubscription === refetchSubscription) {
            _this2.setState({
              refetchSubscription: null,
              isARequestInFlight: false
            });
          }
        };

        this.setState({ isARequestInFlight: true });
        refetchSubscription = this._getQueryFetcher().execute({
          environment: environment,
          operation: operation,
          cacheConfig: cacheConfig,
          preservePreviousReferences: true
        }).mergeMap(function (payload) {
          return Observable$1.create(function (sink) {
            onNext(payload, function () {
              sink.next(); // pass void to public observer's `next`
              sink.complete();
            });
          });
        })
        // use do instead of finally so that observer's `complete` fires after cleanup
        .do({
          error: cleanup,
          complete: cleanup,
          unsubscribe: cleanup
        }).subscribe(observer || {});

        this.setState({ refetchSubscription: this.state.isARequestInFlight ? refetchSubscription : null
        });

        return refetchSubscription;
      },
      _release: function _release() {
        this.state.resolver.dispose();
        if (this.state.refetchSubscription) {
          this.state.refetchSubscription.unsubscribe();
          this.setState({
            refetchSubscription: null,
            isARequestInFlight: false
          });
        }
        if (this.state.queryFetcher) {
          this.state.queryFetcher.dispose();
        }
      }
    },
    watch: {
      fragments: function fragments() {
        var _relay$environment$un = relay.environment.unstable_internal,
            createFragmentSpecResolver = _relay$environment$un.createFragmentSpecResolver,
            getDataIDsFromObject = _relay$environment$un.getDataIDsFromObject;


        var prevIDs = getDataIDsFromObject(_fragments, this.state.prevProps);
        var nextIDs = getDataIDsFromObject(_fragments, this.$props);

        // If the environment has changed or props point to new records then
        // previously fetched data and any pending fetches no longer apply:
        // - Existing references are on the old environment.
        // - Existing references are based on old variables.
        // - Pending fetches are for the previous records.
        if (this.state.relayEnvironment !== relay.environment || this.state.relayVariables !== relay.variables || !areEqual$2(prevIDs, nextIDs)) {
          this._release();

          this.context.relay.environment = relay.environment;
          this.context.relay.variables = relay.variables;

          var resolver = createFragmentSpecResolver(relay, this.$options.name, _fragments, this.$props, this._handleFragmentDataUpdate);

          this.setState({
            prevProps: this.$props,
            relayEnvironment: relay.environment,
            relayVariables: relay.variables,
            relayProp: this._buildRelayProp(relay),
            localVariables: null,
            resolver: resolver
          });
        } else if (!this.state.localVariables) {
          this.state.resolver.setProps(this.$props);
        }
        var data = this.state.resolver.resolve();
        if (data !== this.state.data) {
          this.setState({ data: data });
        }
      }
    },
    beforeDestroy: function beforeDestroy() {
      this._release();
    }
  };
};

var createPaginationContainer = function createPaginationContainer() {
  invariant$3(arguments.length === 2 || arguments.length === 3, 'createPaginationContainer: Expected `arguments.length` to be 2 or 3, got `%s`.', arguments);
  if (arguments.length === 2) {
    [].unshift.call(arguments, null);
  }

  var _arguments = Array.prototype.slice.call(arguments),
      component = _arguments[0],
      fragmentSpec = _arguments[1],
      connectionConfig = _arguments[2];

  return buildVueRelayContainer(component, fragmentSpec, function (fragments) {
    return createContainerWithFragments$1.call(this, fragments, connectionConfig);
  });
};

var areEqual$3 = require('fbjs/lib/areEqual');
var invariant$4 = require('fbjs/lib/invariant');

var createContainerWithFragments$2 = function createContainerWithFragments(_fragments) {
  var relay = this.relay;

  return {
    name: 'relay-fragment-container',
    data: function data() {
      var createFragmentSpecResolver = relay.environment.unstable_internal.createFragmentSpecResolver;
      // Do not provide a subscription/callback here.
      // It is possible for this render to be interrupted or aborted,
      // In which case the subscription would cause a leak.
      // We will add the subscription in componentDidMount().

      var resolver = createFragmentSpecResolver(relay, this.$options.name, _fragments, this.$props);

      return {
        prevState: Object.freeze({
          resolver: resolver
        }),
        state: Object.freeze({
          data: resolver.resolve(),
          prevProps: this.$props,
          relayEnvironment: relay.environment,
          relayVariables: relay.variables,
          relayProp: {
            isLoading: resolver.isLoading(),
            environment: relay.environment
          },
          resolver: resolver
        }),
        switch: true
      };
    },

    computed: {
      fragments: function fragments() {
        var _this = this;

        Object.keys(_fragments).forEach(function (key) {
          return _this[key];
        });
        return this.switch = !this.switch;
      }
    },
    methods: {
      setState: function setState(state) {
        this.state = Object.freeze(_extends({}, this.state, state));
      },
      _handleFragmentDataUpdate: function _handleFragmentDataUpdate() {
        // If this event belongs to the current data source, update.
        // Otherwise we should ignore it.
        if (this.state.resolver === this.prevState.resolver) {
          this.setState({
            data: this.state.resolver.resolve(),
            relayProp: {
              isLoading: this.state.resolver.isLoading(),
              environment: this.state.relayProp.environment
            }
          });
        }
      },
      _subscribeToNewResolver: function _subscribeToNewResolver() {
        var _state = this.state,
            data = _state.data,
            resolver = _state.resolver;

        // Event listeners are only safe to add during the commit phase,
        // So they won't leak if render is interrupted or errors.

        resolver.setCallback(this._handleFragmentDataUpdate);

        // External values could change between render and commit.
        // Check for this case, even though it requires an extra store read.
        var maybeNewData = resolver.resolve();
        if (data !== maybeNewData) {
          this.setState({ data: maybeNewData });
        }
      }
    },
    watch: {
      fragments: function fragments() {
        var _relay$environment$un = relay.environment.unstable_internal,
            createFragmentSpecResolver = _relay$environment$un.createFragmentSpecResolver,
            getDataIDsFromObject = _relay$environment$un.getDataIDsFromObject;


        var prevIDs = getDataIDsFromObject(_fragments, this.state.prevProps);
        var nextIDs = getDataIDsFromObject(_fragments, this.$props);

        var resolver = this.state.resolver;

        // If the environment has changed or props point to new records then
        // previously fetched data and any pending fetches no longer apply:
        // - Existing references are on the old environment.
        // - Existing references are based on old variables.
        // - Pending fetches are for the previous records.
        if (this.state.relayEnvironment !== relay.environment || this.state.relayVariables !== relay.variables || !areEqual$3(prevIDs, nextIDs)) {
          this.prevState = Object.freeze({ resolver: resolver });

          // Do not provide a subscription/callback here.
          // It is possible for this render to be interrupted or aborted,
          // In which case the subscription would cause a leak.
          // We will add the subscription in componentDidUpdate().
          resolver = createFragmentSpecResolver(relay, this.$options.name, _fragments, this.$props);

          this.setState({
            data: resolver.resolve(),
            prevProps: this.$props,
            relayEnvironment: relay.environment,
            relayVariables: relay.variables,
            relayProp: {
              isLoading: resolver.isLoading(),
              environment: relay.environment
            },
            resolver: resolver
          });
        } else {
          resolver.setProps(this.$props);

          var data = resolver.resolve();
          if (data !== this.state.data) {
            this.setState({
              data: data,
              prevProps: this.$props,
              relayEnvironment: relay.environment,
              relayVariables: relay.variables,
              relayProp: {
                isLoading: resolver.isLoading(),
                environment: relay.environment
              }
            });
          }
        }
      }
    },
    mounted: function mounted() {
      this._subscribeToNewResolver();
    },
    updated: function updated() {
      if (this.state.resolver !== this.prevState.resolver) {
        this.prevState.resolver.dispose();
        this.prevState = Object.freeze({ resolver: this.state.resolver });

        this._subscribeToNewResolver();
      }
    },
    beforeDestroy: function beforeDestroy() {
      this.state.resolver.dispose();
    }
  };
};

var createFragmentContainer = function createFragmentContainer() {
  invariant$4(arguments.length === 1 || arguments.length === 2, 'createFragmentContainer: Expected `arguments.length` to be 1 or 2, got `%s`.', arguments);
  if (arguments.length === 1) {
    [].unshift.call(arguments, null);
  }

  var _arguments = Array.prototype.slice.call(arguments),
      component = _arguments[0],
      fragmentSpec = _arguments[1];

  return buildVueRelayContainer(component, fragmentSpec, createContainerWithFragments$2);
};

var _require$2 = require('relay-runtime'),
    MutationTypes = _require$2.MutationTypes,
    RangeOperations = _require$2.RangeOperations,
    commitLocalUpdate = _require$2.commitLocalUpdate,
    commitMutation = _require$2.commitMutation,
    fetchQuery = _require$2.fetchQuery,
    graphql = _require$2.graphql,
    requestSubscription = _require$2.requestSubscription;

var index = {
  QueryRenderer: QueryRenderer,

  MutationTypes: MutationTypes,
  RangeOperations: RangeOperations,

  commitLocalUpdate: commitLocalUpdate,
  commitMutation: commitMutation,
  createRefetchContainer: createRefetchContainer,
  createPaginationContainer: createPaginationContainer,
  createFragmentContainer: createFragmentContainer,
  fetchQuery: fetchQuery,
  graphql: graphql,
  requestSubscription: requestSubscription
};

module.exports = index;
