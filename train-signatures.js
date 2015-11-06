/* Yolo */
var clarifai;
var nombre = 'example';

$(document).ready(function() {
  clarifai = new Clarifai({
    'clientId': 'AsQWyPg3pRWOeHwCWJWA82LWkFYFU2ASCgGY2OX-',
    'clientSecret': 'YjiIZNB0sgXsnSTqF-zIO41izXF2obMgi3iFRMgm'
  });
});

function setName() {
  nombre = $("#name").val();
}

function positive(imgurl) {
  clarifai.positive(imgurl, nombre, callback).then(
    promiseResolved,
    promiseRejected
  );
}

function negative(imgurl) {
  clarifai.negative(imgurl, nombre, callback).then(
    promiseResolved,
    promiseRejected
  );
}

function train() {
  clarifai.train(nombre, callback).then(
    promiseResolved,
    promiseRejected
  );
}

function predict(imgurl) {
  clarifai.predict(imgurl, nombre, callback)
  .then(function(obj) {
      if (obj.score < 0.6) {
        swal({
          title: 'Nope!',
          text: 'Something is not right with that signature.',
          imageUrl: obj.url
        });
      } else {
        swal({
          title: 'Sweet!',
          text: 'You are all set!',
          imageUrl: obj.url
        });
      }
    },
    promiseRejected
  );
}

function promiseResolved(obj){
  console.log('Promise resolved', obj);
}

function promiseRejected(obj){
  console.log('Promise rejected', obj);
}

function callback(obj){
  console.log('callback', obj);
}

