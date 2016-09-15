importScripts('PapaParse-4.1.2/papaparse.min.js');
importScripts('api.js');


let dataLoaded = false;


console.log('worker loaded!');
console.log(self);

console.log(Papa);
Papa.parse('data/FL_insurance_sample.csv', {
  download: true,
  dynamicTyping: true,
  complete: function (result) {
    console.log(arguments);
    console.log(result.data.length);
    dataLoaded = true;
  }
});





self.onmessage = function (event) {

  if (dataLoaded) {
    console.log('data loaded');
  } else {
    console.log('data not loaded');
  }


  var end = Date.now() + 5000;
  while(Date.now() < end){

  }

  self.postMessage(Date.now() - event.data);

};