
const promisesAplusTests = require("promises-aplus-tests")
const MyPromise = require('../src/promise')
promisesAplusTests(MyPromise, function (err) {
    // All done; output is in the console. Or check `err` for number of failures.
})