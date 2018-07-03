
/**
 * new Promise((resolve, reject) =>{
 *  // 这里是同步执行
 *  // 自定义逻辑
 * })
 * 
 * 疑问
 * 1. 为啥then回调要返回新的Promise?
 *    因为Promise是单决议
 *    如果像这种形式: return Promise.reject(), 就不能从fulfilled的状态转变为rejected了
 *    所以统一处理返回新的Promise
 * 2. then回调不能被执行超过一次
 * 3. 为啥then注册的回调要异步执行？
 *    onFulfiled可能是同步的，也可能是异步的，为了与外部代码隔离开，避免产生不必要的竟态作用，then的两个回调都统一
 *    使用异步方式调用
 */
const asyncFn = (fn) => setTimeout(fn, 0)
class Promise {
  constructor (resolver) {
    if (typeof resolver !== 'function') {
      throw new Error('Promise resolver ' + resolver + ' is not a function')
    }
    if (!(this instanceof Promise)) {
      return new Promise(resolver)
    }
    // 当前状态 存在{ pending, fulfilled, rejected }
    this.status = 'pending' // 没有隐藏状态值，可以通过外部改变
    // 当前resolve时的数据
    this.resolveData = null
    // 当reject时的数据
    this.rejectData = null
    // 存放所有回调 实现同步调用
    this.onFulfilledList = []
    this.onRejectedList = []
    // 执行传入任务
    try {
      resolver(this.onResolve.bind(this), this.onReject.bind(this))
    } catch (e) {
      this.onReject(e) // 捕获同步错误并reject当前Promise
    }
  }

  /**
   * 成功
   * @param {any} data resolve数据 
   */
  onResolve (data) {
    asyncFn(() => { // 异步执行回调
      if (this.status === 'pending') {
        this.status = 'fulfilled'
        this.resolveData = data
        this.onFulfilledList.forEach(fn => { // 状态改变依次执行所有then回调
          fn(this.resolveData)
        })
      }
    })
  }

  /**
   * 失败
   * @param {any} data reject数据 
   */
  onReject (data) {
    asyncFn(() => {
      if (this.status === 'pending') {
        this.status = 'rejected'
        this.rejectData = data
        this.onRejectedList.forEach(fn => { // 状态改变依次执行所有then的onRejected回调
          console.log('this.rejectData', this.rejectData)
          fn(this.rejectData)
        })
      }
    })
  }

  /**
   * 
   * @param {Function} onFulfilled 成功回调 
   * @param {Function} onRejected 失败回调
   */
  then (onFulfilled, onRejected) {
    if (typeof onFulfilled !== 'function') {
      onFulfilled = v => v // 值穿透，处理.then().then(v => v) 的情况
    }
    if (typeof onRejected !== 'function') {
      onRejected = v => v
    }

    let promise2
    switch (this.status) {
      case 'pending':
        promise2 = new Promise((resolve, reject) => {
         try {
            this.onFulfilledList.push(() => {
              let x = onFulfilled(this.resolveData) // 执行完onFulfiled回调后的返回值
              this.resolvePromise(promise2, x, resolve, reject)
            })
            this.onRejectedList.push(() => {
              let x = onRejected(this.rejectData) // 执行完onRejected回调后的返回值
              this.resolvePromise(promise2, x, resolve, reject)
            })
          } catch (e) {
            reject(e)
          }
        })
        break
      case 'fulfilled':
        try {
          promise2 = new Promise((resolve, reject) => {
            let x = onFulfilled(this.resolveData)
            this.resolvePromise(promise2, x, resolve, reject)
          })
        } catch (e) {
          reject(e)
        }
        break
      case 'rejected':
        try {
          promise2 = new Promise((resolve, reject) => {
            let x = onRejected(this.rejectData)
            this.resolvePromise(promise2, x, resolve, reject)
          })
        } catch (e) {
          reject(e)
        }
        break
      default:
        throw new Error('promise status error')
    }

    return promise2
  }

  /**
   * 
   * @param {Function} onRejected catch 方法等于reject
   */
  catch (onRejected) {
    return this.then(null, onRejected)
  }

  /**
   * 递归方法，多次then
   * @param {Promise} promise2 第二个promise 
   * @param {any} x 上一次then返回的数据
   * @param {*} resolve 当前成功方法
   * @param {*} reject 当前的失败方法
   */
  resolvePromise (promise2, x, resolve, reject) {
    // 第二个then方法
    let then
    let thenCalledOrThrow = false // 防止多次调用
    // 如果x等于promise2，则是重复调用
    if (promise2 === x) {
      return reject(new TypeError('循环引用'))
    }

    // 如果返回的值是promise
    if (x instanceof Promise) {
      if (x.status === 'pending') {
        x.then(function res (y) {
          /* eslint-disable no-undef */
          resolvePromise(promise2, y, resolve, reject)
        }, reject)
      } else if (x.status === 'fulfilled') {
        resolve(x.resolveData)
      } else if (x.status === 'rejected') {
        reject(x.rejectData)
      }
    } else if (x !== null && (typeof x === 'object' || typeof x === 'function')) { // 返回其他值
      try {
        // 取出下一次then方法
        then = x.then
        // 如果then为fn，递归调用then方法
        if (typeof then == 'function') {
          then.call(x, function res (y) {
            if (thenCalledOrThrow) return
            /* eslint-disable no-undef */
            resolvePromise(promise2, y, resolve, reject)
            thenCalledOrThrow = true // 2.3.3.3.3 即这三处谁先执行就以谁的结果为准
          }, function rej (r) {
            if (thenCalledOrThrow) return
            reject(r)
            thenCalledOrThrow = true // 2.3.3.3.3 即这三处谁先执行就以谁的结果为准
          })
        } else {
          // 如果then 不为fn 则以x为值fulfill promise
          resolve(x)
        }
      } catch (e) {
        if (thenCalledOrThrow) return
        reject(r)
        thenCalledOrThrow = true // 2.3.3.3.3 即这三处谁先执行就以谁的结果为准      
      }
    } else {
      resolve(x)
    }
  }
  
  /**
   * all 方法，传入数组，等待所有promise完成，如果有一个为reject，则返回reject
   * @param {Array} promiseList 
   */
  static all (promiseList) {
    // 如果传入的不是数组， 抛出错误
    if (Array.isArray(promiseList)) {
      new TypeError('must be array')
    }
    return new Promise((resolve, reject) => {
      if (!promiseList.length) { // 如果传入的数组长度为0， 则直接resolve
        resolve([])
      }
      const allData = []

      promiseList.forEach((item, index) => {
        if (item instanceof Promise) {
          item.then(res => {
            allData.push(res)
            resolveAll()
          }, rej => reject(rej)) // 一个promise出错就退出
        } else {
          allData.push(item)
          resolveAll()
        }
      })

      function resolveAll () {
        if (allData.length === promiseList.length) {
          resolve(allData)
        }
      }
    })
  }

  /**
   * race 方法， 当某一个promise完成，则返回
   * @param {Array} promiseList 
   */
  static race (promiseList) {
    // 如果传入的不是数组， 抛出错误
    if (Array.isArray(promiseList)) {
      new TypeError('must be array')
    }
    return new Promise((resolve, reject) => {
      if (!promiseList.length) { // 如果传入的数组长度为0， 则直接resolve
        resolve([])
      }

      promiseList.forEach((item, index) => {
        if (item instanceof Promise) {
          item.then(res => {
            resolve(res)
          }, rej => reject(rej)) // 一个promise出错就退出
        } else {
          resolve(item)
        }
      })
    })
  }

  /**
 * resolve 方法
 * @param {any} value 
 * @return {Promise}
 */
  static resolve (value) {
    return new Promise((resolve, reject) => {
      if (value instanceof Promise) {
        value.then(res => {
          resolve(res)
        })
      } else {
        resolve(value)
      }
    })
  }
  /**
   * reject方法
   * @param {any} reason
   * @return {Promise} 
   */
  static reject (reason) {
    return new Promise((resolve, reject) => {
      reject(reason)
    })
  }

  // 暴露给测试库的静态方法
  static deferred () {
    let dfd = {}
    dfd.promise = new Promise((resolve, reject) => {
      dfd.resolve = resolve
      dfd.reject = reject
    })
    return dfd
  }
}
module.exports = Promise
