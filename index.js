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

  setTransformation(scaleX, scaleY, translateX, translateY) {
    this._scaleX = scaleX;
    this._scaleY = scaleY;
    this._translateX = translateX;
    this._translateY = translateY;
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
      self._context.clearRect(0, 0, self._context.canvas.width, self._context.canvas.height);
      self._paint();
    };
    this.resize();

    this._transformation = new AffineTransformation();

    this._layers = [];
    window.addEventListener('resize', this.resize.bind(this));
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
      this._layers[i].paint(this._context, this._transformation);
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
      console.log('got results of creation', response);
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

    this.setLevel(0);

  }


  paint(context, transformation) {

    if (!this._results || this._farked) {
      return
    }

    context.strokeStyle = 'rgb(255,0,0)';


    const levelMeta = this._results.levelMeta;
    const buckets = this._results.buckets;


    let bucket = buckets[0];
    context.beginPath();
    transformation.forwardXY(bucket.xStart + levelMeta.bucketWidth / 2, bucket.aggregation, this._tmpPoint);

    context.moveTo(this._tmpPoint.x, this._tmpPoint.y);
    for (let i = 1; i < levelMeta.numberOfBuckets; i += 1) {
      bucket = buckets[i];
      transformation.forwardXY(bucket.xStart + levelMeta.bucketWidth / 2, bucket.aggregation, this._tmpPoint);
      context.lineTo(this._tmpPoint.x, this._tmpPoint.y);
    }
    context.stroke();

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
      level: this._level
    }).then(response => {
      this._results = response.results;
      this.emitEvent('invalidate', this);
    }).catch(error => {
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

  histogram.setLevel(1);

  document.getElementById("detail").addEventListener("input", function (target) {

    const levels = histogram.getLevels();
    if (levels === null) {
      return;
    }

    const level = Math.max(1,Math.min(Math.round(event.target.value * levels), levels - 1));
    histogram.setLevel(level);

  });





}());



