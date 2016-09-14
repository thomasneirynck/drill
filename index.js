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
    for (let i = 0; i < this._e_listeners; i += 1) {
      this._e_listeners[i](event);
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


class Aggregator {

  constructor(xyValues, levels) {

    this._xyValues = xyValues.slice().sort((object1, object2) => {
      return object2.x - object1.x;
    });

    this._minX = Infinity;
    this._maxX = -Infinity;
    for (let i = 0; i < this._xyValues.length; i += 1) {
      this._minX = Math.min(this._minX, this._xyValues[i].x);
      this._maxX = Math.max(this._maxX, this._xyValues[i].x);
    }


    console.log('levels', levels);
    this._buckets = new Array(2 * Math.pow(2, levels - 1) - 1); //1st value is number of items, second value is aggregation
    this._initializeLevelMeta(levels);


    for (let level = 0; level < this._levelMeta.length; level += 1) {
      this._initializeBucketsForLevel(level);
    }

    this._level = levels - 1;
    this._seed(this._level);//seed with most detailed level

    this._tmpPoint = {x: 0, y: 0};

  }


  _initializeLevelMeta(levels) {
    this._levelMeta = new Array(levels);
    let startIndex = 0;
    let numberOfBuckets = 1;
    for (let level = 0; level < this._levelMeta.length; level += 1) {
      this._levelMeta[level] = {
        startIndex: startIndex,
        numberOfBuckets: numberOfBuckets,
        bucketWidth: (this._maxX - this._minX) / numberOfBuckets
      };
      startIndex = startIndex + numberOfBuckets;
      numberOfBuckets *= 2;
    }
  }

  _initializeBucketsForLevel(level) {
    for (let i = 0; i < this._levelMeta[level].numberOfBuckets; i += 1) {
      this._buckets[this._levelMeta[level].startIndex + i] = {
        count: 0,
        aggregation: undefined,
        xStart: this._minX + this._levelMeta[level].bucketWidth * i
      };
    }
  }

  _seed(level) {

    let bucket = this._levelMeta[level].startIndex;
    let bucketEnd = this._minX + this._levelMeta[level].bucketWidth;
    for (let i = 0; i < this._xyValues.length; i += 1) {
      if (this._xyValues[i].x > bucketEnd) {
        bucketEnd += this._levelMeta[level].bucketWidth;
        bucket += 1;
      }
      this._seedBucket(this._buckets[bucket], this._xyValues[i].y);
    }
  }

  _seedBucket(bucket, value) {
    if (typeof bucket.aggregation === 'undefined') {
      bucket.aggregation = -Infinity;
    }
    this._accumulateIntoBucket(bucket, 1, value);
  }


  _accumulateIntoBucket(bucket, countOther, aggregationOther) {
    bucket.count += countOther;
    bucket.aggregation = Math.max(aggregationOther, bucket.aggregation);
  }

  setLevel(level) {
    this._level = level;
  }

  paint(context, transformation) {

    const levelMeta = this._levelMeta[this._level];
    if (!this._buckets[levelMeta.startIndex]) {
      console.log("aggregation not calculated");
      return;
    }

    let bucket = this._buckets[levelMeta.startIndex];
    context.beginPath();
    transformation.forwardXY(bucket.xStart, bucket.aggregation, this._tmpPoint);


    context.moveTo(this._tmpPoint.x, this._tmpPoint.y);
    for (let i = 1; i < levelMeta.numberOfBuckets; i += 1) {
      bucket = this._buckets[levelMeta.startIndex + i];
      transformation.forwardXY(bucket.xStart, bucket.aggregation, this._tmpPoint);
      context.lineTo(this._tmpPoint.x, this._tmpPoint.y);
    }
    context.stroke();


  }
}


class Histogram extends Evented {

  constructor(size) {
    super();
    this._sampleData = new Array(size);
    for (let i = 0; i < this._sampleData.length; i += 1) {
      this._sampleData[i] = {
        x: i,
        y: Math.random()
      };
    }
    this._tmpPoint = {x: 0, y: 0};


    this._minX = Infinity;
    this._maxX = -Infinity;
    for (let i = 0; i < this._sampleData.length; i += 1) {
      this._minX = Math.min(this._minX, this._sampleData[i].x);
      this._maxX = Math.max(this._maxX, this._sampleData[i].x);
    }


    const levelsOfDetailBasedOnAll = Math.ceil(Math.log(this._maxX - this._minX) / Math.log(2));
    const levelsOfDetailBasedOnPixels = Math.log(1024) / Math.log(2);//assume 1024 pixels

    const levels = Math.min(levelsOfDetailBasedOnAll, levelsOfDetailBasedOnPixels);
    this._aggregator = new Aggregator(this._sampleData, levels);


  }


  paint(context, transformation) {


    context.strokeStyle = 'rgb(0,0,0)';
    for (let i = 0; i < this._sampleData.length; i += 1) {
      transformation.forwardXY(this._sampleData[i].x, this._sampleData[i].y, this._tmpPoint);
      context.strokeRect(this._tmpPoint.x, this._tmpPoint.y, 10, 10);
    }


    context.strokeStyle = 'rgb(255,0,0)';
    this._aggregator.paint(context, transformation);
  }

}


/************************************************************************************************************************/

const map = new Map("map");

const items = 512;
const histogram = new Histogram(items);
map.setTransformation(map.getWidth() / items, map.getHeight(), 0, 0);


window.histo = histogram;
map.addLayer(histogram);











