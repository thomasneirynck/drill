importScripts('PapaParse-4.1.2/papaparse.min.js');
importScripts('api.js');


let dataLoaded = false;
let sampleDataMeta;
let aggregator;

self.onmessage = function (event) {

  if (dataLoaded) {

    if (event.data.type === 'aggregate') {
      aggregator.setLevel(event.data.level);
      const results = aggregator.aggregate();
      self.postMessage({
        type: 'aggregateSuccess',
        results: results
      });
    } else if (event.data.type === "aggregateBestEffort") {

      //select level based on domain

      aggregator.setLevel(event.data.level);
      const results = aggregator.aggregate();
      self.postMessage({
        type: 'aggregateBestEffortSuccess',
        results: results
      });
    } else {
      throw new Error(`cannot support ${event.data.type} when data is loaded`);
    }



  } else {

    if (event.data.type === 'create') {
      sampleDataMeta = self.createSampleData(event.data.nrOfItems);
      aggregator = new self.Aggregator(sampleDataMeta.sampleData, sampleDataMeta.levels);
      dataLoaded = true;
      self.postMessage({
        type: 'createSuccess',
        levels: sampleDataMeta.levels,
        minX: sampleDataMeta.minX,
        maxX: sampleDataMeta.maxX
      });

    } else {
      throw new Error(`cannot support ${event.data.type} when no data is loaded`);
    }
  }

};