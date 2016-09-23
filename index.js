class Evented {
  constructor() {
    this._e_listeners = {};
  }

  addEventListener(name, callback) {
    if (!this._e_listeners[name]) {
      this._e_listeners[name] = [];
    }
    this._e_listeners[name].push(callback);
  }

  removeEventListener(name, callback) {
    if (!this._e_listeners[name]) {
      return;
    }

    const index = this._e_listeners[name].indexOf(callback);
    if (index >= 0) {
      this._e_listeners[name].splice(index, 1);
    }
  }

  emitEvent(name, event) {

    if (!this._e_listeners[name]) {
      return;
    }

    for (let i = 0; i < this._e_listeners[name].length; i += 1) {
      this._e_listeners[name][i](event);
    }
  }
}

class AffineTransformation {

  constructor() {
    this._scaleX = 1;
    this._scaleY = 1;
    this._translateX = 0;
    this._translateY = 0;
  }

  forwardXY(x, y, out) {
    out.x = x * this._scaleX + this._translateX;
    out.y = y * this._scaleY + this._translateY;
  }

  forwardX(x) {
    return x * this._scaleX + this._translateX;
  }

  getScaleX() {
    return this._scaleX;
  }

  inverseX(xP) {
    return (xP - this._translateX) / this._scaleX;
  }

  inverseXLength(xWidth) {
    return xWidth / this._scaleX;
  }

  scaleOnX(xP, scaleFactor) {
    const newScale = this._scaleX * scaleFactor;
    const x = this.inverseX(xP);
    const newTranslate = xP - newScale * x;
    this._scaleX = newScale;
    this._translateX = newTranslate;
  }

  setTransformation(scaleX, scaleY, translateX, translateY) {
    this._scaleX = scaleX;
    this._scaleY = scaleY;
    this._translateX = translateX;
    this._translateY = translateY;
  }

  scaleOnXRestrictByDomain(xP, scaleFactor, minX, maxX, pixelWidth) {


    //todo: this stinks! correction should be a lot better
    let newScale = this._scaleX * scaleFactor;
    const x = this.inverseX(xP);
    const minScale = pixelWidth / (maxX - minX);
    newScale = Math.max(minScale, newScale);
    const newTranslate = xP - newScale * x;


    this._scaleX = newScale;
    this._translateX = newTranslate;

  }
}

class Map extends Evented {


  constructor(container) {

    super();

    let containerNode = typeof container === 'string' ? document.getElementById(container) : container;
    this._context = document.createElement('canvas').getContext('2d');
    this._context.canvas.style.position = 'relative';
    this._context.canvas.style.left = 0;
    this._context.canvas.style.top = 0;
    containerNode.appendChild(this._context.canvas);

    let self = this;
    this._frameHandle = -1;
    this._render = function () {

      self._frameHandle = -1;
      const bef = Date.now();
      self._context.clearRect(0, 0, self._context.canvas.width, self._context.canvas.height);
      self._paint();
      console.debug('frame time: ', Date.now() - bef);
    };
    this._transformation = new AffineTransformation();
    this._layers = [];

    this._context.canvas.addEventListener('mousewheel', mousewheelEvent => {
      const step = 1.1;
      const scaleFactor = mousewheelEvent.wheelDelta > 0 ? step : 1 / step;
      this.zoomOnX(mousewheelEvent.offsetX, scaleFactor);
    });

    this._viewContext = {
      forwardXY: (x, y, out) => {
        return this._transformation.forwardXY(x, y, out);
      }
    };

    window.addEventListener('resize', this.resize.bind(this));
    this.resize();

  }

  getDomain() {
    //get min domain, max domain
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < this._layers.length; i += 1) {
      if (this._layers[i].hasDomain()) {
        minX = Math.min(minX, this._layers[i].getWorldMinX());
        maxX = Math.max(maxX, this._layers[i].getWorldMaxX());
      }
    }
    return (minX !== Infinity && maxX !== -Infinity) ? {min: minX, max: maxX} : {min: 0, max: 0};
  }

  zoomOnX(pixelX, factor) {

    const domain = this.getDomain();

    this._transformation.scaleOnXRestrictByDomain(pixelX, factor, domain.min, domain.max, this.getWidth());

    this._invalidate();
  }

  addLayer(layer) {
    layer.addEventListener("invalidate", this._invalidate.bind(this));
    this._layers.push(layer);
  }

  resize() {
    let style = window.getComputedStyle(this._context.canvas.parentElement, null);
    let width = parseInt(style.getPropertyValue('width'));
    let height = parseInt(style.getPropertyValue('height'));
    if (width !== this._context.canvas.width || height !== this._context.canvas.height) {
      this._context.canvas.width = width;
      this._context.canvas.height = height;
      this._invalidate();
    }
  }

  _paint() {
    for (let i = 0; i < this._layers.length; i += 1) {
      this._layers[i].paint(this._context, this._viewContext);
    }
  }

  _invalidate() {
    if (this._frameHandle !== -1) {
      return;
    }
    this._frameHandle = requestAnimationFrame(this._render);
  }

  setTransformation(scaleX, scaleY, translateX, translateY) {
    this._transformation.setTransformation(scaleX, scaleY, translateX, translateY);
    this._invalidate();
  }

  getWidth() {
    return this._context.canvas.width;
  }

  getHeight() {
    return this._context.canvas.height;
  }

  getWorldXFrom() {
    return this._transformation.inverseX(0);
  }

  getWorldXTo() {
    return this._transformation.inverseX(this.getWidth());
  }

}


class Histogram extends Evented {

  constructor(number) {

    super();

    this._workerHandle = promisifyWorker(new Worker('worker.js'));
    this._farked = false;

    this._workerHandle.postMessage({
      type: 'create',
      nrOfItems: number
    }).then(response => {
      this._levels = response.levels;
      this.emitEvent('invalidate');
    }).catch(error => {
      console.error(error);
      this._farked = true;
    });

    this._level = null;
    this._levels = null;
    this._results = null;
    this._tmpPoint = {x: 0, y: 0};

  }

  hasDomain() {
    return !!this._results;
  }

  getWorldMinX() {
    return (this._results) ? this._results.minX : -Infinity;
  }

  getWorldMaxX() {
    return (this._results) ? this._results.maxX : -Infinity;
  }

  paint(context2d, viewContext) {

    if (!this._results || this._farked) {
      return
    }

    const levelMeta = this._results.levelMeta;
    const buckets = this._results.buckets;
    let bucket = buckets[0];

    context2d.beginPath();
    viewContext.forwardXY(bucket.xStart + levelMeta.bucketWidth / 2, bucket.aggregation, this._tmpPoint);
    context2d.moveTo(this._tmpPoint.x, this._tmpPoint.y);

    for (let i = 1; i < levelMeta.numberOfBuckets; i += 1) {
      bucket = buckets[i];
      viewContext.forwardXY(bucket.xStart + levelMeta.bucketWidth / 2, bucket.aggregation, this._tmpPoint);
      context2d.lineTo(this._tmpPoint.x, this._tmpPoint.y);
    }
    context2d.strokeStyle = '#778899';
    context2d.stroke();

  }

  getLevels() {
    return this._levels;
  }

  setLevel(level) {

    if (level === this._level) {
      return;
    }

    this._level = level;
    this.emitEvent('invalidate', this);
    this._workerHandle.postMessage({
      type: 'aggregate',
      level: this._level,
      xFrom: null,
      xTo: null,
    }).then(response => {
      this._results = response.results;
      this.emitEvent('invalidate', this);

    }).catch(error => {
      console.error(error);
      this._results = null;
      this.emitEvent('invalidate', this);
    });
  }

}


/**
 * only works if worker posts reponse for each request in order they were received.
 */
function promisifyWorker(worker) {


  const requestQueue = [];
  let inFlight = null;

  worker.addEventListener('message', function onMessage(message) {
    inFlight.resolve(message.data);
    inFlight = null;
    doNext();
  });
  worker.addEventListener('error', function onError(error) {

    inFlight.reject(error.data);
    inFlight = null;
    doNext();
  });

  function doNext() {
    if (!requestQueue.length || inFlight) {
      return;
    }
    inFlight = requestQueue.pop();
    worker.postMessage(inFlight.message)
  }


  return {

    terminate(worker){
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      worker.terminate();
    },

    postMessage(message) {

      const queueItem = {message: message};

      const promise = new Promise((resolve, reject) => {
        queueItem.resolve = resolve;
        queueItem.reject = reject;
      });
      queueItem.promise = promise;
      requestQueue.unshift(queueItem);

      setTimeout(doNext, 0);
      return promise;

    }
  };
}


/************************************************************************************************************************/

(function () {

  const map = new Map("map");
  const nrOfItems = 100024;
  const histogram = new Histogram(nrOfItems);

  map.setTransformation(map.getWidth() / nrOfItems, map.getHeight() * -1, 0, map.getHeight());
  map.addLayer(histogram);

  function justifyLevel(value) {
    const levels = histogram.getLevels();
    return Math.max(1, Math.min(Math.round(value * levels), levels - 1));
  }

  const level = justifyLevel(document.getElementById("detail").value);
  histogram.setLevel(level, map.getWorldXFrom(), map.getWorldXTo());

  document.getElementById("detail").addEventListener("input", function (event) {
    const level = justifyLevel(event.target.value);
    histogram.setLevel(level, map.getWorldXFrom(), map.getWorldXTo());
  });

}());




