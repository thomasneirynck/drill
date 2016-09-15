importScripts('PapaParse-4.1.2/papaparse.min.js');
importScripts('api.js');


let dataLoaded = false;
let sampleDataMeta;
let aggregator;

self.onmessage = function (event) {






  if (dataLoaded) {
    console.log('data loaded');
  } else {

    if (event.data.type === 'create') {

      sampleDataMeta = self.createSampleData(event.data.nrOfItems);
      aggregator = new self.Aggregator(sampleDataMeta.sampleData, sampleDataMeta.levels);

      self.postMessage({
        type: 'createSuccess'
      });


    } else {
      throw new Error('barf');
    }


  }

};