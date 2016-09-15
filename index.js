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
      const beforeFrame = Date.now();
      self._context.clearRect(0, 0, self._context.canvas.width, self._context.canvas.height);
      self._paint();
      console.debug('frame time', Date.now() - beforeFrame);
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

    console.log('posting');

    this._workerHandle.postMessage({
      type: 'create',
      nrOfItems: number
    }).then(reponse => {
      console.log('shit created....', reponse);
      this.emitEvent('invalidate');
    })


  }


  paint(context, transformation) {
    context.strokeStyle = 'rgb(255,0,0)';
    // this._aggregator.paint(context, transformation);
  }

  getLevels(level) {
    return this._levels;
  }

  setLevel(level) {
    this._aggregator.setLevel(level);
    this.emitEvent("invalidate", this);
  }

}


/**
 * only works if worker posts reponse for each request in order they were received.
 */
function promisifyWorker(worker) {

  return {

    postMessage: function (message) {
      return new Promise((resolve, reject) => {
        worker.addEventListener('message', function onMessage(workerMessage) {
          worker.removeEventListener('message', onMessage);
          resolve(workerMessage.data);
        });
        worker.postMessage(message);

      });
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


  document.getElementById("detail").addEventListener("input", function (target) {

    const level = Math.min(Math.round(event.target.value * histo.getLevels()), histo.getLevels() - 1);
    histo.setLevel(level);


  });





}());



