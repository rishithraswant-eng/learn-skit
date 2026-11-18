/* Small fallbacks for older Safari and Android browsers used by students. */
(function () {
  if (!Object.hasOwn) {
    Object.defineProperty(Object, 'hasOwn', {
      value: function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); }
    });
  }
  if (!Array.prototype.at) {
    Object.defineProperty(Array.prototype, 'at', {
      value: function (index) {
        var position = Math.trunc(Number(index)) || 0;
        return this[position < 0 ? this.length + position : position];
      }
    });
  }
  if (!Array.prototype.findLast) {
    Object.defineProperty(Array.prototype, 'findLast', {
      value: function (predicate, scope) {
        for (var i = this.length - 1; i >= 0; i--) {
          if (predicate.call(scope, this[i], i, this)) return this[i];
        }
      }
    });
  }
  if (window.crypto && !window.crypto.randomUUID && window.crypto.getRandomValues) {
    window.crypto.randomUUID = function () {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      return Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, '0'); })
        .join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
    };
  }
  var lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
  var fewCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  if (lowMemory || fewCores) document.documentElement.classList.add('reduced-effects');
})();
