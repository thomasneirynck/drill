class Aggregator {

  constructor(xyValues, levels) {

    this._xyValues = xyValues.slice().sort((object1, object2) => {
      return object1.x - object2.x;
    });

    this._minX = Infinity;
    this._maxX = -Infinity;
    for (let i = 0; i < this._xyValues.length; i += 1) {
      this._minX = Math.min(this._minX, this._xyValues[i].x);
      this._maxX = Math.max(this._maxX, this._xyValues[i].x);
    }

    this._buckets = new Array(2 * Math.pow(2, levels - 1) - 1); //1st value is number of items, second value is aggregation
    this._initializeLevelMeta(levels);


    this._level = levels - 1;
    this._initializeBucketsForLevel(this._level);

    const bef = Date.now();
    this._seed(this._level);//seed with most detailed level
    console.log('cost of seeding', Date.now() - bef);


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
        index: this._levelMeta[level].startIndex + i,
        level: level,
        count: 0,
        aggregation: null,
        xStart: this._minX + this._levelMeta[level].bucketWidth * i
      };
    }
  }

  _seed(level) {

    const b = Date.now();
    let bucketIndex = this._levelMeta[level].startIndex;
    let bucketEnd = this._minX + this._levelMeta[level].bucketWidth;
    for (let i = 0; i < this._xyValues.length; i += 1) {
      if (this._xyValues[i].x > bucketEnd) {
        bucketEnd += this._levelMeta[level].bucketWidth;
        bucketIndex += 1;
      }
      this._seedBucket(this._buckets[bucketIndex], this._xyValues[i].y);
    }
    console.log('seeding', Date.now() - b);
  }

  _seedBucket(bucket, value) {
    if (bucket.aggregation === null) {
      bucket.aggregation = value;
    }
    this._accumulateIntoBucket(bucket, 1, value);
  }


  _accumulateIntoBucket(bucket, countOther, aggregationOther) {
    bucket.aggregation = (bucket.count * bucket.aggregation + countOther * aggregationOther) / (bucket.count + countOther);
    bucket.count += countOther;
    // bucket.aggregation = Math.max(aggregationOther, bucket.aggregation);
  }

  setLevel(level) {
    this._level = level;
  }

  paint(context, transformation) {

    const levelMeta = this._levelMeta[this._level];
    if (!this._buckets[levelMeta.startIndex]) {
      console.log("aggregation not calculated");
      this._initializeBucketsForLevel(this._level);
      this._seed(this._level);
    }

    let bucket = this._buckets[levelMeta.startIndex];
    context.beginPath();
    transformation.forwardXY(bucket.xStart + levelMeta.bucketWidth / 2, bucket.aggregation, this._tmpPoint);

    context.moveTo(this._tmpPoint.x, this._tmpPoint.y);
    for (let i = 1; i < levelMeta.numberOfBuckets; i += 1) {
      bucket = this._buckets[levelMeta.startIndex + i];
      transformation.forwardXY(bucket.xStart + levelMeta.bucketWidth / 2, bucket.aggregation, this._tmpPoint);
      context.lineTo(this._tmpPoint.x, this._tmpPoint.y);
    }
    context.stroke();

  }
}


this.createSampleData = function (size) {
  const sampleData = new Array(size);
  for (let i = 0; i < sampleData.length; i += 1) {
    sampleData[i] = {
      x: i,
      y: Math.random()
    };
  }
  return sampleData;
};


this.Aggregator = Aggregator;