var app = require ('./index.js');

var context = {
    done: function (err, result) {
        console.log('------------');
        console.log('Context done');
        console.log('   error:', err);
        console.log('   result:', result);
    },
    succeed: function(result) {
        console.log('------------');
        console.log('Success!');
        console.log('result:', result);
    },
    fail: function(result) {
        console.error('------------');
        console.log('Error');
        console.log('result:', result);
    }
};

var callback = function(err, result) {
  if (err) {
    console.console.error(err);
    return;
  }

  console.log("success", result);
}

// var event = {
//
// };
//
// app.handler(event, context, callback);
