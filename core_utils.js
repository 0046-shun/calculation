// Core utilities (UMD) - number formatting, normalization, similarity
(function (global) {
  'use strict';

  function toHalfWidth(input) {
    if (input == null) return '';
    var str = String(input);
    return str
      .replace(/\u3000/g, ' ')
      .replace(/[\uFF01-\uFF5E]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
      });
  }

  function normalizeText(input) {
    if (input == null) return '';
    return toHalfWidth(String(input)).trim().toLowerCase();
  }

  function formatNumber(num) {
    if (Number.isInteger(num)) return num.toLocaleString();
    return Number(num).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function normalizeProductName(name) {
    if (!name) return '';
    var s = String(name)
      .replace(/[・\u30fb,、\s]/g, '')
      .replace(/(外|中片|中両)[ｸｸ][ﾗﾗ]|(外|中片|中両)[Kk][Uu][Rr][Aa]|(外|中片|中両)KURA/g, '$1クラ')
      .replace(/外クラ|外ｸﾗ|外KURA|外kura/g, '外クラ')
      .replace(/中両クラ|中両ｸﾗ|中両KURA|中両kura/g, '中両クラ')
      .replace(/中片クラ|中片ｸﾗ|中片KURA|中片kura/g, '中片クラ')
      .replace(/クラ|ｸﾗ|KURA|kura/g, 'クラ')
      .replace(/外基礎/g, '外基礎')
      .replace(/中基礎/g, '中基礎');
    return normalizeText(s);
  }

  function calculateSimilarity(str1, str2) {
    var a = normalizeText(str1);
    var b = normalizeText(str2);
    if (!a || !b) return 0;
    var lenA = a.length, lenB = b.length;
    var matrix = new Array(lenA + 1);
    for (var i = 0; i <= lenA; i++) {
      matrix[i] = new Array(lenB + 1);
      matrix[i][0] = i;
    }
    for (var j = 0; j <= lenB; j++) matrix[0][j] = j;
    for (var i2 = 1; i2 <= lenA; i2++) {
      for (var j2 = 1; j2 <= lenB; j2++) {
        var cost = a.charAt(i2 - 1) === b.charAt(j2 - 1) ? 0 : 1;
        var del = matrix[i2 - 1][j2] + 1;
        var ins = matrix[i2][j2 - 1] + 1;
        var sub = matrix[i2 - 1][j2 - 1] + cost;
        matrix[i2][j2] = Math.min(del, ins, sub);
      }
    }
    var distance = matrix[lenA][lenB];
    var maxLen = Math.max(lenA, lenB);
    return 1 - distance / maxLen;
  }

  global.CoreUtils = {
    toHalfWidth: toHalfWidth,
    normalizeText: normalizeText,
    formatNumber: formatNumber,
    normalizeProductName: normalizeProductName,
    calculateSimilarity: calculateSimilarity
  };
})(window);


