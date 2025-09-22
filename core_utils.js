(function (global) {
  if (!global.CoreUtils) {
    global.CoreUtils = {};
  }
  global.CoreUtils.formatNumber = global.CoreUtils.formatNumber || function (value) {
    try { return Number(value).toLocaleString('ja-JP'); } catch (e) { return String(value); }
  };
})(window);
