class Aggregator {

  constructor(xyValues, levels) {

    this._xyValues = xyValues.slice().sort((object1, object2) => {
      return object1.x - object2.x;
    });

    this._minX = Infinity;
    this._maxX = -Infinity;
    this._minY = -Infinity;
    this._maxY = -Infinity;
    for (let i = 0; i < this._xyValues.length; i += 1) {
      this._minX = Math.min(this._minX, this._xyValues[i].x);
      this._maxX = Math.max(this._maxX, this._xyValues[i].x);

      this._minY = Math.min(this._minY, this._xyValues[i].y);
      this._maxY = Math.max(this._maxY, this._xyValues[i].y);
    }

    this._initializeLevelMeta(levels);
    this._level = levels - 1;


    this._buckets = new Array(2 * Math.pow(2, levels - 1) - 1); //1st value is number of items, second value is aggregation
    console.log('nr of buckets', this._buckets.length);
    this._initializeBucketsForLevel(this._level);
    this._seed(this._level);//seed with most detailed level

    this._tmpPoint = {x: 0, y: 0};

  }


  aggregate() {

    const levelMeta = this._levelMeta[this._level];
    if (!this._buckets[levelMeta.startIndex]) {
      this._initializeBucketsForLevel(this._level);
      this._seed(this._level);
    }

    let buckets = [];
    for (let i = 0; i < levelMeta.numberOfBuckets; i += 1) {
      buckets.push(this._buckets[levelMeta.startIndex + i]);
    }

    return {
      minX: this._minX,
      maxX: this._maxX,
      minY: this._minY,
      maxY: this._maxY,
      levelMeta: levelMeta,
      buckets: buckets
    };

  }


  _initializeLevelMeta(totalLevels) {
    this._levelMeta = new Array(totalLevels);
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
    console.log('LevelMeta', this._levelMeta);
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

  _seed(level, todoMinX, todoMaxX) {
    let bucketIndex = this._levelMeta[level].startIndex;
    let bucketEnd = this._minX + this._levelMeta[level].bucketWidth;

    //do binary search to data:
    for (let i = 0; i < this._xyValues.length; i += 1) {
      if (this._xyValues[i].x > bucketEnd) {
        bucketEnd += this._levelMeta[level].bucketWidth;
        bucketIndex += 1;
      }
      this._seedBucket(this._buckets[bucketIndex], this._xyValues[i].y);
    }
  }

  _seedBucket(bucket, value) {
    if (bucket.aggregation === null) {
      bucket.aggregation = value;
    }
    this._accumulateIntoBucket(bucket, 1, value);
  }


  _accumulateIntoBucket(bucket, countOther, aggregationOther) {
    //calculates an average
    bucket.aggregation = (bucket.count * bucket.aggregation + countOther * aggregationOther) / (bucket.count + countOther);
    bucket.count += countOther;
  }

  setLevel(level) {
    this._level = level;
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
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < size; i += 1) {
    minX = Math.min(minX, sampleData[i].x);
    maxX = Math.max(maxX, sampleData[i].x);
  }


  const levelsOfDetailBasedOnAll = Math.ceil(Math.log(maxX - minX) / Math.log(2));
  console.log('levels of detail for the data', levelsOfDetailBasedOnAll);


  // const levelsOfDetailBasedOnPixels = Math.log(1024) / Math.log(2);//assume 1024 pixels
  // const levels = Math.min(levelsOfDetailBasedOnAll, levelsOfDetailBasedOnPixels);
  const levels = levelsOfDetailBasedOnAll;
  console.debug('actual selected levels', levels);


  console.log("should calculate start offset of course!!!!");

  return {
    levels: levels,
    minX: minX,
    maxX: maxX,
    sampleData:sampleData
  };

};


this.Aggregator = Aggregator;