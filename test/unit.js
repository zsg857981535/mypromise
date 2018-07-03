const MyPromise = require('../src/promise')

function test(a, b) {
  return new MyPromise((resolve, reject)=>{
   setTimeout(() => {
      if (a + b > 5) {
        resolve('大于5')
      } else {
        reject('小于5')
      }
   }, 2000)
  })
}

test(1, 3).then(res=>{
  console.log('res', res)
}).catch(e=>{
  console.log('rej', e)
})
