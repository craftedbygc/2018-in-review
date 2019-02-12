function progressPromise( promises, tickCallback ) {
    var len = promises.length
    var progress = 0
    
    function tick(promise) {
      promise.then(function () {
        progress++
        tickCallback(progress, len)
      });
      return promise
    }
    
    return Promise.all(promises.map(tick))
}

export default progressPromise