/*
 * Fragment Loader
*/

import Event from '../../core/events';
import EventHandler from '../../core/event-handler';
import {ErrorTypes, ErrorDetails} from '../../core/errors';
import {logger} from '../../utils/logger';

class FragmentLoader extends EventHandler {

  constructor(AVPLAYER) {
    super(AVPLAYER, Event.FRAG_LOADING);
    this.loaders = {};
  }

  destroy() {
    let loaders = this.loaders;
    for (let loaderName in loaders) {
      let loader = loaders[loaderName];
      if (loader) {
        loader.destroy();
      }
    }
    this.loaders = {};
    EventHandler.prototype.destroy.call(this);
  }

  onFragLoading(data) {
    let frag = data.frag,
        type = frag.type,
        loader = this.loaders[type],
        config = this.AVPLAYER.config;

    frag.loaded = 0;
    if (loader) {
      logger.warn(`abort previous fragment loader for type:${type}`);
      loader.abort();
    }
    loader  = this.loaders[type] = frag.loader = typeof(config.fLoader) !== 'undefined' ? new config.fLoader(config) : new config.loader(config);

    let loaderContext, loaderConfig, loaderCallbacks;
    loaderContext = { url : frag.url, frag : frag, responseType : 'arraybuffer', progressData : false};
    let start = frag.byteRangeStartOffset, end = frag.byteRangeEndOffset;
    if (!isNaN(start) && !isNaN(end)) {
      loaderContext.rangeStart = start;
      loaderContext.rangeEnd = end;
    }
    loaderConfig = { timeout : config.fragLoadingTimeOut, maxRetry : 0 , retryDelay : 0, maxRetryDelay : config.fragLoadingMaxRetryTimeout};
    loaderCallbacks = { onSuccess : this.loadsuccess.bind(this), onError :this.loaderror.bind(this), onTimeout : this.loadtimeout.bind(this), onProgress: this.loadprogress.bind(this)};
    loader.load(loaderContext,loaderConfig,loaderCallbacks);
  }

  loadsuccess(response, stats, context) {
    if (this.AVPLAYER.customEncryptionInfo.flag) {
      let tempUint8Array = new Uint8Array(response.data);
      let len = tempUint8Array.length;
      for (let i=0; i<len; i++) {
        tempUint8Array[i] ^= this.AVPLAYER.customEncryptionInfo.seed;
      }
    }
    let payload = response.data, frag = context.frag;
    // detach fragment loader on load success
    frag.loader = undefined;
    this.loaders[frag.type] = undefined;
    this.AVPLAYER.trigger(Event.FRAG_LOADED, {payload: payload, frag: frag, stats: stats});
  }

  loaderror(response, context) {
    let loader = context.loader;
    if (loader) {
      loader.abort();
    }
    this.loaders[context.type] = undefined;
    this.AVPLAYER.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: context.frag, response: response});
  }

  loadtimeout(stats, context) {
    let loader = context.loader;
    if (loader) {
      loader.abort();
    }
    this.loaders[context.type] = undefined;
    this.AVPLAYER.trigger(Event.ERROR, {type: ErrorTypes.NETWORK_ERROR, details: ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: context.frag});
  }

  // data will be used for progressive parsing
  loadprogress(stats, context, data) { // jshint ignore:line
    let frag = context.frag;
    frag.loaded = stats.loaded;
    this.AVPLAYER.trigger(Event.FRAG_LOAD_PROGRESS, {frag: frag, stats: stats});
  }
}

export default FragmentLoader;
